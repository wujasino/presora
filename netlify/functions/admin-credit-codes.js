const { createClient } = require('@supabase/supabase-js');

const ALLOWED_ORIGINS = new Set(['https://presora.app', 'https://www.presora.app']);
const headersFor = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://presora.app',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
  Vary: 'Origin',
});

const createAdminClient = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
};

const json = (statusCode, headers, body) => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  const headers = headersFor(event.headers.origin || '');
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  if (!['GET', 'POST', 'PATCH'].includes(event.httpMethod)) {
    return json(405, headers, { error: 'Method not allowed' });
  }
  if (event.body && event.body.length > 4096) {
    return json(413, headers, { error: 'Payload too large' });
  }

  try {
    const supabase = createAdminClient();
    if (!supabase) return json(500, headers, { error: 'Server misconfiguration' });

    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json(401, headers, { error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json(401, headers, { error: 'Unauthorized' });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) return json(500, headers, { error: 'Could not verify admin access' });
    if (!profile?.is_admin) return json(403, headers, { error: 'Admin access required' });

    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase
        .from('credit_codes')
        .select('id, code, credits_per_redemption, max_redemptions, redemption_count, is_active, created_at')
        .order('created_at', { ascending: false });
      if (error) return json(500, headers, { error: 'Could not load credit codes' });
      return json(200, headers, { codes: data });
    }

    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return json(400, headers, { error: 'Invalid JSON' });
    }

    if (event.httpMethod === 'POST') {
      const code = typeof payload.code === 'string' ? payload.code.trim().toUpperCase() : '';
      const credits = payload.credits;
      const maxRedemptions = payload.maxRedemptions;
      if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
        return json(400, headers, { error: 'Code must be 3–32 letters, numbers, hyphens, or underscores' });
      }
      if (!Number.isInteger(credits) || credits < 1 || credits > 100000) {
        return json(400, headers, { error: 'Credits must be an integer between 1 and 100000' });
      }
      if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 1000000) {
        return json(400, headers, { error: 'Usage limit must be an integer between 1 and 1000000' });
      }

      const { data, error } = await supabase
        .from('credit_codes')
        .insert({
          code,
          credits_per_redemption: credits,
          max_redemptions: maxRedemptions,
          created_by: user.id,
        })
        .select('id, code, credits_per_redemption, max_redemptions, redemption_count, is_active, created_at')
        .single();
      if (error?.code === '23505') return json(409, headers, { error: 'That code already exists' });
      if (error) return json(500, headers, { error: 'Could not create credit code' });
      return json(201, headers, { code: data });
    }

    if (typeof payload.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.id)) {
      return json(400, headers, { error: 'Invalid code id' });
    }
    if (payload.isActive !== false) {
      return json(400, headers, { error: 'Credit codes can only be deactivated here' });
    }
    const { data, error } = await supabase
      .from('credit_codes')
      .update({ is_active: false })
      .eq('id', payload.id)
      .select('id')
      .maybeSingle();
    if (error) return json(500, headers, { error: 'Could not deactivate credit code' });
    if (!data) return json(404, headers, { error: 'Credit code not found' });
    return json(200, headers, { ok: true });
  } catch (error) {
    console.error('admin-credit-codes handler error:', error.message);
    return json(500, headers, { error: 'Could not process credit code request' });
  }
};
