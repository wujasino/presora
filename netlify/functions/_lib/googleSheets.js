/**
 * Minimal Google Sheets v4 client — a service-account JWT exchanged for an
 * OAuth access token, then a plain `fetch()` against the Sheets REST API.
 * No `googleapis` SDK dependency, matching this codebase's existing style
 * of calling third-party REST APIs directly (Mailchimp, Resend, Stripe).
 *
 * Used to log form submissions (contact.js, newsletter.js) to a Google
 * Sheet as an extra, human-browsable copy — Supabase stays the source of
 * truth either way; this is best-effort and never blocks or fails the
 * user-facing request.
 *
 * Setup (Netlify env vars):
 *   GOOGLE_SHEETS_ID                  — the spreadsheet ID from its URL
 *                                       (.../spreadsheets/d/<THIS>/edit)
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL      — a GCP service account's email
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY — that service account's private key
 *                                       (paste the full "-----BEGIN
 *                                       PRIVATE KEY-----...END PRIVATE
 *                                       KEY-----" block; literal "\n"
 *                                       sequences are unescaped below, so
 *                                       it's safe to store on one line)
 *
 * The service account itself needs the Sheets API enabled on its GCP
 * project, and the spreadsheet must be shared with the service account's
 * email (Editor access) — a service account has no Drive access of its
 * own otherwise. Create two tabs in the sheet named exactly "Contact" and
 * "Newsletter" (with header rows of your choosing) before the first
 * append; Sheets creates neither the spreadsheet nor a missing tab.
 *
 * All three env vars are optional — every caller in this codebase treats
 * a missing GOOGLE_SHEETS_ID as "not configured yet" and skips silently,
 * the same way Mailchimp/Resend integrations degrade elsewhere.
 */
import crypto from 'node:crypto';

const base64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Cached across warm invocations of the same function instance — Google's
// tokens are valid for an hour, so this avoids a token exchange on every
// single form submission.
let cachedToken = null;

async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const privateKey = rawKey.replace(/\\n/g, '\n');
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: HTTP ${res.status} — ${await res.text()}`);
  }
  const data = await res.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.accessToken;
}

/**
 * Appends one row to the given tab. `sheetName` is just the tab's name
 * (e.g. "Contact") — Sheets appends after the last row with data in that
 * tab regardless of exactly how many columns it has.
 *
 * No-ops silently when GOOGLE_SHEETS_ID isn't set (not configured yet).
 * Throws on a real API failure — callers wrap this in try/catch and log
 * rather than fail the request, since this is a convenience copy, not
 * the record of truth.
 */
async function appendRow(sheetName, values) {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) return;

  const accessToken = await getAccessToken();
  if (!accessToken) return;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) {
    throw new Error(`Sheets append to "${sheetName}" failed: HTTP ${res.status} — ${await res.text()}`);
  }
}

export { appendRow };
