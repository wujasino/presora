/**
 * GET /.netlify/functions/scan-status -> { enabled: boolean }
 *
 * Public, read-only view of the scanning kill-switch, so the UI can say
 * "scanning is paused, here are your existing reports" *before* someone
 * starts a scan — instead of letting them type a brand, watch the progress
 * animation, and land on an error screen.
 *
 * app_settings has RLS on with no policies, so an anon/authenticated JWT
 * can't read it directly, and toggle-scanning.js requires profiles.is_admin.
 * Hence this separate endpoint.
 *
 * It deliberately returns **only** the boolean — never the failure count,
 * the provider's error text, or who flipped the switch. Those name the
 * upstream provider and quote its billing messages; they belong in
 * /admin/settings, behind the admin check, not in an unauthenticated
 * response.
 *
 * Fails OPEN (enabled: true) on any error, matching getScanSettings(): this
 * is a convenience hint for the UI, and analyze.js re-checks the real flag
 * on every scan anyway — a hiccup here must never make the app claim
 * scanning is down when it isn't.
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

if (!globalThis.WebSocket) globalThis.WebSocket = ws;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin;
try {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
} catch (err) {
  console.error('scan-status: Supabase client init failed:', err.message);
}

const ALLOWED_ORIGINS = new Set(['https://presora.app', 'https://www.presora.app']);
const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://presora.app',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  // Short cache: the flag changes rarely, but a stale "paused" would outlive
  // an admin turning it back on.
  'Cache-Control': 'public, max-age=30',
  'Vary': 'Origin',
});

export const handler = async (event) => {
  const headers = corsHeaders(event.headers.origin || '');

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    if (!supabaseAdmin) return { statusCode: 200, headers, body: JSON.stringify({ enabled: true }) };

    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'scanning_enabled')
      .maybeSingle();

    if (error) {
      console.warn('scan-status: query failed, assuming enabled:', error.message);
      return { statusCode: 200, headers, body: JSON.stringify({ enabled: true }) };
    }

    // A missing row means "never configured" -> on.
    const enabled = data === null || data.value === undefined
      ? true
      : data.value !== false && data.value !== 'false';

    return { statusCode: 200, headers, body: JSON.stringify({ enabled }) };
  } catch (err) {
    console.warn('scan-status: unexpected failure, assuming enabled:', err.message);
    return { statusCode: 200, headers, body: JSON.stringify({ enabled: true }) };
  }
};
