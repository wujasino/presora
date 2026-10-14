import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = new Set(['https://presora.app', 'https://www.presora.app']);
const headersFor = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://presora.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  Vary: 'Origin',
});

const json = (statusCode, headers, body) => ({ statusCode, headers, body: JSON.stringify(body) });

const createAdminClient = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
};

export const handler = async (event) => {
  const headers = headersFor(event.headers?.origin || '');
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return json(405, headers, { error: 'Method not allowed' });
  if (!event.body || event.body.length > 2048) return json(400, headers, { error: 'Invalid payload' });

  try {
    const admin = createAdminClient();
    if (!admin) return json(500, headers, { error: 'Server misconfiguration' });

    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return json(401, headers, { error: 'Unauthorized' });

    const { data: { user }, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !user) return json(401, headers, { error: 'Unauthorized' });

    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch {
      return json(400, headers, { error: 'Invalid JSON' });
    }

    const incidentId = typeof payload.incidentId === 'string' ? payload.incidentId : '';
    const status = typeof payload.status === 'string' ? payload.status : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(incidentId)) {
      return json(400, headers, { error: 'Invalid incident id' });
    }
    if (!['open', 'resolved', 'ignored'].includes(status)) {
      return json(400, headers, { error: 'Invalid incident status' });
    }

    const now = new Date().toISOString();
    const { data: incident, error } = await admin
      .from('reputation_incidents')
      .update({
        status,
        resolved_at: status === 'open' ? null : now,
        updated_at: now,
      })
      .eq('id', incidentId)
      .eq('user_id', user.id)
      .select('id, status, resolved_at')
      .maybeSingle();
    if (error) return json(500, headers, { error: 'Could not update incident' });
    if (!incident) return json(404, headers, { error: 'Incident not found' });

    return json(200, headers, { incident });
  } catch (error) {
    console.error('reputation-incident-status:', error?.message || error);
    return json(500, headers, { error: 'Could not update incident' });
  }
};
