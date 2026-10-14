import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { sendAnalysisLifecycle } from './_lib/resendLifecycle.js';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const signaturesMatch = (received, expected) => {
  if (!/^[a-f0-9]{64}$/i.test(received || '')) return false;
  const left = Buffer.from(received, 'hex');
  const right = Buffer.from(expected, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!event.body || Buffer.byteLength(event.body) > 16 * 1024) return json(400, { error: 'Invalid payload' });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return json(500, { error: 'Server misconfiguration' });

  const receivedSignature = event.headers?.['x-presora-signature'] || event.headers?.['X-Presora-Signature'] || '';
  const expectedSignature = crypto.createHmac('sha256', secret).update(event.body).digest('hex');
  if (!signaturesMatch(receivedSignature, expectedSignature)) return json(401, { error: 'Unauthorized' });

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const issuedAt = Number(payload.issuedAt);
  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > 5 * 60 * 1000) {
    return json(401, { error: 'Expired request' });
  }
  if (!/^[0-9a-f-]{36}$/i.test(String(payload.userId || ''))) {
    return json(400, { error: 'Invalid user' });
  }

  const supabaseAdmin = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await sendAnalysisLifecycle({
    supabaseAdmin,
    userId: payload.userId,
    email: payload.email,
    brandName: payload.brandName,
    trustScore: payload.trustScore,
    dimensions: payload.dimensions,
  });

  return json(200, { ok: true });
};
