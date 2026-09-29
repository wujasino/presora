import type { Server } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test, expect } from '@playwright/test';
import { startFunctionServer, closeServer, loadHandler } from './functionServer';

const execFileAsync = promisify(execFile);

const MODULE_PATH = 'netlify/functions/newsletter-preference.js';

test.describe('/.netlify/functions/newsletter-preference — contract', () => {
  let server: Server;
  let baseURL: string;

  test.beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://e2e-placeholder.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'e2e-placeholder-key';
    const handler = await loadHandler(MODULE_PATH, { fresh: true });
    ({ server, url: baseURL } = await startFunctionServer(handler));
  });

  test.afterAll(async () => { await closeServer(server); });

  test('OPTIONS preflight returns 204', async ({ request }) => {
    const res = await request.fetch(baseURL, { method: 'OPTIONS' });
    expect(res.status()).toBe(204);
  });

  test('rejects unsupported methods with 405', async ({ request }) => {
    const res = await request.fetch(baseURL, { method: 'DELETE' });
    expect(res.status()).toBe(405);
  });

  test('GET without a Bearer token is unauthorized', async ({ request }) => {
    const res = await request.get(baseURL);
    expect(res.status()).toBe(401);
  });

  test('POST without a Bearer token is unauthorized, even with a valid body', async ({ request }) => {
    const res = await request.post(baseURL, { data: { subscribed: true } });
    expect(res.status()).toBe(401);
  });
});

test.describe('/.netlify/functions/newsletter-preference — misconfigured environment', () => {
  // Regression test for this session's actual fix: createClient() throws
  // synchronously on a missing/malformed Supabase URL, and that used to
  // happen at module load — before the handler's try/catch could ever run —
  // so Netlify couldn't invoke the function at all and returned a bare 502.
  //
  // This needs a genuinely fresh module evaluation with the env vars unset,
  // including transitive dependencies — so this spawns a real child
  // process instead, exactly like a fresh Netlify cold start would.
  test('a missing Supabase URL/key degrades to a clean 500, not a crash', async () => {
    const { stdout } = await execFileAsync('node', ['e2e/api/fixtures/checkMisconfigured.mjs']);
    const result = JSON.parse(stdout);
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toMatch(/misconfiguration/i);
  });
});
