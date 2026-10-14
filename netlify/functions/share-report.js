import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = new Set(['https://presora.app', 'https://www.presora.app']);
const headersFor = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://presora.app',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
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

const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const brandKey = (raw) => String(raw || '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/^www\./, '')
  .replace(/\/.*$/, '')
  .replace(/\.(com|net|org|io|app|co|ai|dev|xyz|pl|eu|de|fr|es|it|uk)$/, '')
  .replace(/\s+/g, ' ')
  .trim();
const cleanText = (value, max) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, max) : null;
};
const safeHttpUrl = (value, max) => {
  const raw = cleanText(value, max);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return ['http:', 'https:'].includes(parsed.protocol) ? raw : null;
  } catch {
    return null;
  }
};
const PUBLIC_REPORT_FIELDS = 'id, brand_name, trust_score, authority, sentiment, recency, mentions, accuracy, created_at, sources, audit_summary';

export const handler = async (event) => {
  const headers = headersFor(event.headers?.origin || '');
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return json(405, headers, { error: 'Method not allowed' });
  }
  if (event.body && event.body.length > 2048) {
    return json(413, headers, { error: 'Payload too large' });
  }

  try {
    const supabase = createAdminClient();
    if (!supabase) return json(500, headers, { error: 'Server misconfiguration' });

    if (event.httpMethod === 'GET') {
      const token = event.queryStringParameters?.token || '';
      if (!/^[a-f0-9]{64}$/i.test(token)) return json(404, headers, { error: 'Report not found' });

      const { data: share, error: shareError } = await supabase
        .from('report_shares')
        .select('analysis_id, owner_id')
        .eq('token_hash', hashToken(token))
        .maybeSingle();
      if (shareError) return json(500, headers, { error: 'Could not load shared report' });
      if (!share) return json(404, headers, { error: 'Report not found' });

      const { data: report, error: reportError } = await supabase
        .from('analyses')
        .select(PUBLIC_REPORT_FIELDS)
        .eq('id', share.analysis_id)
        .maybeSingle();
      if (reportError) return json(500, headers, { error: 'Could not load shared report' });
      if (!report) return json(404, headers, { error: 'Report not found' });

      // Competitors are scoped to the share owner and this report's brand.
      // A missing/older migration must not make an otherwise valid share fail.
      const { data: competitorRows, error: competitorError } = await supabase
        .from('tracked_competitors')
        .select('competitor_name, last_score, last_scanned_at')
        .eq('user_id', share.owner_id)
        .eq('brand_key', brandKey(report.brand_name));
      const competitors = competitorError ? [] : (competitorRows || [])
        .sort((a, b) => {
          if (a.last_score == null && b.last_score == null) return a.competitor_name.localeCompare(b.competitor_name);
          if (a.last_score == null) return 1;
          if (b.last_score == null) return -1;
          return b.last_score - a.last_score;
        })
        .slice(0, 3);

      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_name, agency_logo_url, agency_contact_email, agency_website')
        .eq('id', share.owner_id)
        .maybeSingle();
      const agencyName = cleanText(profile?.agency_name, 60);
      const branding = {
        name: agencyName,
        logoUrl: safeHttpUrl(profile?.agency_logo_url, 500),
        contactEmail: cleanText(profile?.agency_contact_email, 160) || 'contact.presora@gmail.com',
        website: safeHttpUrl(profile?.agency_website, 200),
        isWhiteLabeled: Boolean(agencyName),
      };
      return json(200, headers, { report: { ...report, competitors, branding } });
    }

    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return json(401, headers, { error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return json(401, headers, { error: 'Unauthorized' });

    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return json(400, headers, { error: 'Invalid JSON' });
    }
    const analysisId = typeof payload.analysisId === 'string' ? payload.analysisId : '';
    if (!/^[0-9a-f-]{36}$/i.test(analysisId)) return json(400, headers, { error: 'Invalid report id' });

    const { data: report, error: reportError } = await supabase
      .from('analyses')
      .select('id')
      .eq('id', analysisId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (reportError) return json(500, headers, { error: 'Could not verify report ownership' });
    if (!report) return json(404, headers, { error: 'Report not found' });

    const token = randomBytes(32).toString('hex');
    const { error: saveError } = await supabase
      .from('report_shares')
      .upsert(
        { analysis_id: analysisId, owner_id: user.id, token_hash: hashToken(token), created_at: new Date().toISOString() },
        { onConflict: 'analysis_id' }
      );
    if (saveError) return json(500, headers, { error: 'Could not create share link' });

    const origin = ALLOWED_ORIGINS.has(event.headers?.origin) ? event.headers.origin : 'https://presora.app';
    return json(200, headers, { url: `${origin}/shared-report/${token}` });
  } catch (error) {
    console.error('share-report handler error:', error.message);
    return json(500, headers, { error: 'Could not process report share request' });
  }
};
