/**
 * POST /.netlify/functions/newsletter
 * Body: { email: string }
 */
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import ws from 'ws';
import { appendRow } from './_lib/googleSheets.js';

// Node < 22 has no native WebSocket — supabase-js inits Realtime eagerly.
if (!globalThis.WebSocket) {
  globalThis.WebSocket = ws;
}

// Matches the fallback pattern used by the other functions (analyze.js,
// chat.js, send-reset-otp.js) — the project's Netlify env has used both
// naming conventions at different times.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Dedicated signing secret — was previously a plain SHA-256 of the service
// role key, meaning a leak of one weakened the other. Falls back to the
// service role key only until NEWSLETTER_UNSUBSCRIBE_SECRET is set in
// Netlify; set it and every link signed after that uses the real HMAC key.
// Same secret/scheme verified by unsubscribe-newsletter.js.
const UNSUBSCRIBE_SECRET = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET || SUPABASE_SERVICE_KEY;
const signUnsubscribe = (email) =>
  crypto.createHmac('sha256', UNSUBSCRIBE_SECRET).update(email).digest('hex');

// Inlined branded email — keeps the function self-contained (no filesystem reads).
// Visual language matches the other transactional emails (src/email-templates/*.html).
const buildWelcomeEmail = (unsubscribeUrl) => `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#0B0F19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0B0F19;"><tr><td align="center" style="padding:48px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#111827;border-radius:16px;border:1px solid #334155;overflow:hidden;">
      <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #334155;text-align:center;">
        <img src="data:image/png;base64,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" alt="Presora" width="48" height="48" style="display:inline-block;margin-bottom:12px;" />
        <div style="font-size:20px;font-weight:700;color:#F8FAFC;letter-spacing:-0.3px;">Presora</div>
        <div style="font-size:11px;color:#94A3B8;margin-top:2px;text-transform:uppercase;letter-spacing:1px;">AI Brand Intelligence</div>
      </td></tr>
      <tr><td style="padding:36px 40px 28px;">
        <div style="text-align:center;margin-bottom:28px;"><div style="display:inline-block;width:56px;height:56px;border-radius:14px;background-color:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);text-align:center;line-height:56px;"><span style="font-size:26px;">✉️</span></div></div>
        <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#F8FAFC;text-align:center;letter-spacing:-0.3px;">Jesteś zapisany!</h1>
        <p style="margin:0 0 28px;font-size:14px;line-height:1.65;color:#94A3B8;text-align:center;">Dzięki za dołączenie do newslettera Presora.<br/>Będziemy wysyłać Ci najważniejsze aktualizacje o widoczności marek w AI.</p>
        <div style="text-align:center;margin-bottom:28px;"><a href="https://www.presora.app/dashboard" style="display:inline-block;padding:13px 32px;background-color:#6366F1;color:#F8FAFC;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">Przejdź do Presora →</a></div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
          <tr><td style="padding:12px 14px;background-color:#1E293B;border-radius:10px;border:1px solid #334155;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="28" style="vertical-align:top;padding-top:1px;"><span style="font-size:15px;">📊</span></td>
            <td><div style="font-size:12px;font-weight:600;color:#F8FAFC;">Nowości o widoczności w AI</div><div style="font-size:11px;color:#94A3B8;margin-top:2px;">Co się zmienia w ChatGPT, Claude i Gemini</div></td>
          </tr></table></td></tr>
          <tr><td style="height:6px;"></td></tr>
          <tr><td style="padding:12px 14px;background-color:#1E293B;border-radius:10px;border:1px solid #334155;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="28" style="vertical-align:top;padding-top:1px;"><span style="font-size:15px;">💡</span></td>
            <td><div style="font-size:12px;font-weight:600;color:#F8FAFC;">Praktyczne wskazówki GEO</div><div style="font-size:11px;color:#94A3B8;margin-top:2px;">Jak zwiększyć rekomendacje marki w modelach AI</div></td>
          </tr></table></td></tr>
        </table>
        <div style="border-top:1px solid #334155;margin:24px 0;"></div>
        <p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;line-height:1.6;">Zmieniłeś zdanie? Możesz zrezygnować w każdej chwili z linku na dole tej wiadomości.</p>
      </td></tr>
      <tr><td style="padding:20px 40px 28px;border-top:1px solid #334155;text-align:center;">
        <p style="margin:0 0 6px;font-size:11px;color:#94A3B8;">Wiadomość wysłana automatycznie przez <a href="https://www.presora.app" style="color:#6366F1;text-decoration:none;">Presora</a></p>
        <p style="margin:0 0 10px;font-size:11px;color:#64748B;">© 2026 Presora · Wszystkie prawa zastrzeżone</p>
        <p style="margin:0;font-size:11px;color:#94A3B8;"><a href="${unsubscribeUrl}" style="color:#94A3B8;text-decoration:underline;">Wypisz się z newslettera</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

const ALLOWED_ORIGINS = new Set(['https://presora.app', 'https://www.presora.app']);

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

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://presora.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Vary': 'Origin',
});

// Stricter email regex: requires TLD of at least 2 chars
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[a-zA-Z]{2,}$/;

export const handler = async (event) => {
  const origin = event.headers.origin || '';
  const headers = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (event.body && event.body.length > 4 * 1024) {
    return { statusCode: 413, headers, body: JSON.stringify({ error: 'Payload too large' }) };
  }

  if (shouldRateLimit(getIp(event))) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests. Please try again later.' }) };
  }

  let email;
  try {
    ({ email } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email' }) };
  }

  const normalizedEmail = email.trim().toLowerCase();

  const { error: dbError } = await supabase
    .from('newsletter_subscribers')
    .upsert(
      { email: normalizedEmail, subscribed_at: new Date().toISOString(), unsubscribed_at: null },
      { onConflict: 'email' }
    );

  if (dbError) {
    console.error('Newsletter DB error');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database error' }) };
  }

  // Optional: mirror to a Google Sheet (see _lib/googleSheets.js for setup).
  // Best-effort — Supabase above is the real subscriber record either way.
  try {
    await appendRow('Newsletter', [new Date().toISOString(), normalizedEmail]);
  } catch (err) {
    console.error('Newsletter Google Sheets log failed:', err.message);
  }

  // Optional: Mailchimp integration
  if (process.env.MAILCHIMP_API_KEY && process.env.MAILCHIMP_LIST_ID) {
    try {
      const dc = process.env.MAILCHIMP_API_KEY.split('-').pop();
      await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${process.env.MAILCHIMP_LIST_ID}/members`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.MAILCHIMP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_address: normalizedEmail, status: 'subscribed' }),
      });
    } catch {
      // Non-fatal — subscriber is already saved in Supabase
    }
  }

  // Welcome email — best-effort, subscription already succeeded either way
  if (process.env.RESEND_API_KEY) {
    try {
      const unsubscribeUrl = `${process.env.URL || 'https://www.presora.app'}/.netlify/functions/unsubscribe-newsletter?email=${encodeURIComponent(normalizedEmail)}&sig=${signUnsubscribe(normalizedEmail)}`;
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'Presora <noreply@presora.app>',
          to: normalizedEmail,
          subject: 'Jesteś zapisany do newslettera Presora',
          html: buildWelcomeEmail(unsubscribeUrl),
        }),
      });
      if (!resendRes.ok) {
        console.error('Resend welcome email error:', await resendRes.text());
      }
    } catch (err) {
      console.error('Resend welcome email failed:', err.message);
    }
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
