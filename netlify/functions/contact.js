/**
 * POST /.netlify/functions/contact
 * Body: { name, email, subject, message }
 * Saves to Supabase + sends email notification via Resend (optional)
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { appendRow } from './_lib/googleSheets.js';

if (!globalThis.WebSocket) globalThis.WebSocket = ws;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ALLOWED_ORIGINS = new Set(['https://presora.app', 'https://www.presora.app']);
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[a-zA-Z]{2,}$/;

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const requestStore = new Map();
// Only trust Netlify's own connection-IP header — x-forwarded-for can be
// pre-populated by the client itself and isn't a reliable rate-limit key.
const getIp = (event) => event.headers['x-nf-client-connection-ip'] || 'unknown';
const shouldRateLimit = (key) => {
  const current = Date.now();
  const entry = requestStore.get(key) || { count: 0, windowStart: current };
  if (current - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.windowStart = current;
    entry.count = 0;
  }
  entry.count += 1;
  requestStore.set(key, entry);
  return entry.count > MAX_REQUESTS_PER_WINDOW;
};

// Verifies a reCAPTCHA v3 token server-side against Google's siteverify API.
// Fails open (returns true) when RECAPTCHA_SECRET_KEY isn't configured, so
// this doesn't break the contact form before the key is set up in Netlify —
// it's an additive layer on top of the IP rate limit above, not a
// replacement for it.
const RECAPTCHA_MIN_SCORE = 0.5;
async function verifyRecaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();
    return data.success === true && (data.score === undefined || data.score >= RECAPTCHA_MIN_SCORE);
  } catch (err) {
    console.error('reCAPTCHA verify error:', err.message);
    return true; // Google being unreachable must never block real contact submissions.
  }
}

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://presora.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Vary': 'Origin',
});

export const handler = async (event) => {
  const origin = event.headers.origin || '';
  const headers = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  if (event.body && event.body.length > 8 * 1024) return { statusCode: 413, headers, body: JSON.stringify({ error: 'Payload too large' }) };
  if (shouldRateLimit(getIp(event))) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests. Please try again later.' }) };
  }

  let name, email, subject, message, recaptchaToken;
  try {
    ({ name, email, subject, message, recaptchaToken } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!(await verifyRecaptcha(recaptchaToken))) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'reCAPTCHA verification failed.' }) };
  }

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid name' }) };
  }
  if (!email || !EMAIL_RE.test(email.trim())) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email' }) };
  }
  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message too short' }) };
  }

  const payload = {
    name: name.trim().slice(0, 120),
    email: email.trim().toLowerCase(),
    subject: (subject || '').trim().slice(0, 200) || 'Contact form',
    message: message.trim().slice(0, 4000),
    created_at: new Date().toISOString(),
  };

  // Save to Supabase
  const { error: dbError } = await supabase.from('contact_messages').insert(payload);
  if (dbError) {
    console.error('Contact DB error:', dbError.message);
    // Don't fail — still try email notification
  }

  // Optional: mirror to a Google Sheet (see _lib/googleSheets.js for setup).
  // Best-effort — Supabase above is the real record either way.
  try {
    await appendRow('Contact', [payload.created_at, payload.name, payload.email, payload.subject, payload.message]);
  } catch (err) {
    console.error('Contact Google Sheets log failed:', err.message);
  }

  // Optional: Resend email notification
  if (process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Presora <noreply@presora.app>',
          to: ['contact.presora@gmail.com'],
          subject: `[Contact] ${payload.subject}`,
          text: `From: ${payload.name} <${payload.email}>\n\n${payload.message}`,
        }),
      });
    } catch {
      // Non-fatal
    }
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
