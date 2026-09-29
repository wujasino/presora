/**
 * GET  /.netlify/functions/newsletter-preference   -> { subscribed: boolean }
 * POST /.netlify/functions/newsletter-preference    body: { subscribed: boolean }
 *
 * Authenticated (Bearer token) read/write of the logged-in user's own
 * newsletter subscription — lets Settings show and change real state instead
 * of a local-only toggle. Always operates on the verified user's own email,
 * never a client-supplied one.
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = ws;
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// createClient() throws synchronously on a missing/malformed URL or key.
// That happens at module load, before the handler (and its try/catch) ever
// runs — Netlify then can't even invoke the function and returns a bare 502,
// which is indistinguishable from the exact bug this file's try/catch below
// was meant to fix. Guard it so a bad/missing env var surfaces as clean JSON
// instead of a require-time crash.
let supabaseAdmin;
try {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
} catch (err) {
  console.error('newsletter-preference: Supabase client init failed:', err.message);
}

const ALLOWED_ORIGINS = new Set(['https://presora.app', 'https://www.presora.app']);

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://presora.app',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
  'Vary': 'Origin',
});

export const handler = async (event) => {
  const headers = corsHeaders(event.headers.origin || '');

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Unlike its sibling functions (newsletter.js, contact.js), this handler
  // previously had no top-level try/catch — any unexpected exception (e.g.
  // supabaseAdmin.auth.getUser() rejecting on a transient network error)
  // propagated as an unhandled rejection, which Netlify surfaces as a bare
  // 502 instead of a JSON error response. Settings.tsx fires this on every
  // page load (GET), so that failure mode was hit far more than a rare edge
  // case would suggest.
  try {
    if (!supabaseAdmin) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server misconfiguration' }) };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user?.email) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    const email = user.email.toLowerCase();

    if (event.httpMethod === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('newsletter_subscribers')
        .select('unsubscribed_at')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('newsletter-preference GET error:', error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database error' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ subscribed: !!data && !data.unsubscribed_at }) };
    }

    // POST
    let subscribed;
    try {
      ({ subscribed } = JSON.parse(event.body || '{}'));
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    if (typeof subscribed !== 'boolean') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '"subscribed" must be a boolean' }) };
    }

    const { error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .upsert(
        {
          email,
          subscribed_at: new Date().toISOString(),
          unsubscribed_at: subscribed ? null : new Date().toISOString(),
        },
        { onConflict: 'email' }
      );

    if (error) {
      console.error('newsletter-preference POST error:', error.message);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database error' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ subscribed }) };
  } catch (err) {
    console.error('newsletter-preference handler error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Something went wrong. Please try again.' }) };
  }
};
