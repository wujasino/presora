/**
 * GET or POST /.netlify/functions/unsubscribe-newsletter?email=...&sig=...
 * Link target from the newsletter welcome email — verifies the signature
 * (so a stranger can't unsubscribe someone else just by knowing their email)
 * and marks the subscriber as unsubscribed. Renders a small HTML page since
 * this is opened directly in a browser from an email client, not called by
 * the app.
 */
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const ws = require('ws');

if (!globalThis.WebSocket) {
  globalThis.WebSocket = ws;
}

// Matches the fallback pattern used by the other functions — must resolve to
// the same value newsletter.js used to sign the link, or every link 404s.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Same secret/scheme used to sign the link in newsletter.js's buildWelcomeEmail
// — must stay identical between the two functions or every link 404s.
const UNSUBSCRIBE_SECRET = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET || SUPABASE_SERVICE_KEY;
const sign = (email) =>
  crypto.createHmac('sha256', UNSUBSCRIBE_SECRET).update(email).digest('hex');

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const page = (title, body) => ({
  statusCode: 200,
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
  body: `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8" /><title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#0B0F19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0B0F19;min-height:100vh;"><tr><td align="center" style="padding:48px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:420px;background-color:#111827;border-radius:16px;border:1px solid #334155;padding:40px;text-align:center;">
<div style="font-size:18px;font-weight:700;color:#F8FAFC;margin-bottom:16px;">Presora</div>
<p style="font-size:14px;line-height:1.6;color:#94A3B8;margin:0;">${body}</p>
</table></td></tr></table></body></html>`,
});

exports.handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return { statusCode: 405, headers: { Allow: 'GET, POST' }, body: 'Method not allowed' };
  }

  const { email, sig } = event.queryStringParameters || {};
  if (!email || !sig) {
    return page('Nieprawidłowy link', 'Ten link do wypisania jest niekompletny.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const expected = sign(normalizedEmail);
  // Constant-time comparison — a plain !== leaks timing information that,
  // in principle, could help an attacker guess a valid signature byte by
  // byte. Buffers must be equal length or timingSafeEqual throws.
  const validSig =
    typeof sig === 'string' &&
    sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!validSig) {
    return page('Nieprawidłowy link', 'Nie udało się zweryfikować tego linku.');
  }

  const { error } = await supabase
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('email', normalizedEmail);

  if (error) {
    console.error('Unsubscribe DB error');
    return page('Coś poszło nie tak', 'Spróbuj ponownie później albo napisz do nas.');
  }

  // RFC 8058 mailbox providers expect an empty success response after their
  // one-click POST. Human visitors using the footer link still receive a page.
  if (event.httpMethod === 'POST') {
    return { statusCode: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
  }

  return page('Wypisano', `Adres <strong style="color:#F8FAFC;">${escapeHtml(normalizedEmail)}</strong> został wypisany z newslettera Presora.`);
};
