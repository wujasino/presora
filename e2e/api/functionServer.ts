import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type NetlifyEvent = {
  httpMethod: string;
  headers: Record<string, string>;
  body: string;
  queryStringParameters: Record<string, string>;
};

type NetlifyResult = { statusCode: number; headers?: Record<string, string>; body?: string };
type NetlifyHandler = (event: NetlifyEvent) => Promise<NetlifyResult>;

/**
 * Wraps a Netlify Function's `exports.handler` in a real local HTTP server,
 * so API tests can hit it exactly like Playwright's `request` fixture hits
 * any other endpoint — no `netlify dev` (and no real Supabase/Stripe
 * credentials) required for the contract-level behavior (method checks,
 * payload validation, rate limiting, CORS) these functions implement before
 * ever touching a real backend.
 */
export function startFunctionServer(handler: NetlifyHandler): Promise<{ server: http.Server; url: string }> {
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks).toString('utf8');
    const url = new URL(req.url || '/', 'http://localhost');
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers[key] = value;
    }

    const event: NetlifyEvent = {
      httpMethod: req.method || 'GET',
      headers,
      body,
      queryStringParameters: Object.fromEntries(url.searchParams),
    };

    try {
      const result = await handler(event);
      res.writeHead(result.statusCode, result.headers || {});
      res.end(result.body ?? '');
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'harness caught an uncaught handler exception', message: (err as Error).message }));
    }
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

export function closeServer(server: http.Server | undefined): Promise<void> {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}

/**
 * Loads a Netlify Function's handler using the native ESM loader, matching
 * netlify/functions/package.json ("type": "module").
 *
 * Pass `fresh: true` to force a genuinely new module evaluation (e.g. to
 * pick up a changed `process.env` before the module reads it at load time)
 * — a cache-busting query string is the standard trick since ESM has no
 * `require.cache`-style invalidation.
 */
export async function loadHandler(relativePath: string, opts: { fresh?: boolean } = {}) {
  const absPath = path.resolve(process.cwd(), relativePath);
  const specifier = pathToFileURL(absPath).href + (opts.fresh ? `?t=${Date.now()}-${Math.random()}` : '');
  const mod = await import(/* @vite-ignore */ specifier);
  const handler = mod.handler ?? mod.default?.handler;
  if (typeof handler !== 'function') {
    throw new Error(`No exports.handler found in ${relativePath}`);
  }
  return handler as (event: NetlifyEvent) => Promise<NetlifyResult>;
}
