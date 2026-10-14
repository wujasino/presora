import { createClient } from '@supabase/supabase-js';
import net from 'node:net';
import ws from 'ws';

import { OPENROUTER_MODELS, runBrandScan, summariseFailures } from './_lib/runScan.js';
import { fireWebhooksForEvent } from './_lib/webhookDelivery.js';
import { getScanSettings, recordScanOutcome } from './_lib/appSettings.js';
import { sendAnalysisLifecycle } from './_lib/resendLifecycle.js';

// supabase-js reaches for a global WebSocket (realtime) that Node doesn't
// provide — without this the client construction throws in the Netlify
// runtime before any of the logic below ever runs.
if (!globalThis.WebSocket) {
  globalThis.WebSocket = ws;
}

// === ENV ===
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// Was SUPABASE_SERVICE_ROLE_KEY only — every scan failed with "Authentication
// failed. Please try again." (createAdminClient() throwing before any real
// auth check ran) whenever the deploy's env var was actually named
// SUPABASE_SERVICE_KEY, the name ~20 other functions in this codebase accept.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const MAX_REQUESTS_PER_WINDOW = Number(process.env.MAX_REQUESTS_PER_WINDOW || 10);
const MAX_REQUESTS_PER_DAY = Number(process.env.MAX_REQUESTS_PER_DAY || 200);
const GUEST_LIMIT = Number(process.env.GUEST_LIMIT || 3);

const ALLOWED_HOST_SUFFIXES = (process.env.ALLOWED_HOST_SUFFIXES || '')
  .split(',')
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);

const BLOCKED_HOST_SUFFIXES = (process.env.BLOCKED_HOST_SUFFIXES || '')
  .split(',')
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);

// === Helpers ===
const jsonResponse = (statusCode, payload, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...extraHeaders,
  },
  body: JSON.stringify(payload),
});

const now = () => Date.now();

const requestStore = new Map();

const shouldRateLimit = (key) => {
  const current = now();
  const entry = requestStore.get(key) || {
    count: 0,
    windowStart: current,
    dailyCount: 0,
    dailyReset: current + 24 * 60 * 60 * 1000,
    lastRequest: current,
  };

  if (current > entry.dailyReset) {
    entry.dailyCount = 0;
    entry.dailyReset = current + 24 * 60 * 60 * 1000;
    entry.windowStart = current;
    entry.count = 0;
  }

  if (current - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.windowStart = current;
    entry.count = 0;
  }

  entry.count += 1;
  entry.dailyCount += 1;
  entry.lastRequest = current;
  requestStore.set(key, entry);

  return entry.count > MAX_REQUESTS_PER_WINDOW || entry.dailyCount > MAX_REQUESTS_PER_DAY;
};

// Only x-nf-client-connection-ip is set by Netlify itself and can't be
// spoofed by the caller; x-forwarded-for can be pre-populated by whoever
// makes the request, so it's a last-resort fallback only.
const getRequestIp = (headers = {}) => {
  const candidates = [
    headers['x-nf-client-connection-ip'],
    headers['X-NF-Client-Connection-IP'],
    headers['x-forwarded-for'],
    headers['X-Forwarded-For'],
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      const ip = value.split(',')[0].trim();
      if (ip) return ip;
    }
  }

  return 'unknown';
};

const isPrivateOrLocalHostname = (hostname) => {
  if (!hostname) return true;

  const h = hostname.toLowerCase();

  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0' || h === '::1' || h === '[::1]') return true;

  if (h.endsWith('.internal') || h.endsWith('.local') || h.endsWith('.lan')) return true;

  const ipVersion = net.isIP(h);
  if (ipVersion === 4 || ipVersion === 6) {
    // IPv4 private/reserved ranges
    if (ipVersion === 4) {
      const parts = h.split('.');
      const [a, b] = parts.map(Number);

      if (a === 10) return true;
      if (a === 127) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
      if (a === 0) return true;
    }

    // IPv6 loopback / link-local / unique-local
    if (ipVersion === 6) {
      if (h === '::1') return true;
      if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
    }
  }

  return false;
};

const matchesAllowlist = (hostname) => {
  if (!ALLOWED_HOST_SUFFIXES.length) return true;

  const h = hostname.toLowerCase();

  return ALLOWED_HOST_SUFFIXES.some((suffix) => {
    const clean = suffix.trim();

    if (!clean) return false;

    if (clean.startsWith('*.')) {
      const base = clean.slice(2);
      return h === base || h.endsWith(`.${base}`);
    }

    return h === clean || h.endsWith(`.${clean}`);
  });
};

const matchesBlockedList = (hostname) => {
  const h = hostname.toLowerCase();

  return BLOCKED_HOST_SUFFIXES.some((suffix) => {
    if (!suffix) return false;

    if (suffix.startsWith('*.')) {
      const base = suffix.slice(2);
      return h === base || h.endsWith(`.${base}`);
    }

    return h === suffix || h.endsWith(`.${suffix}`);
  });
};

// The scan target is usually a plain brand name ("Tesla", "Nike") — see the
// landing page's example chips and Dashboard's placeholder — and only
// sometimes a URL ("yourbrand.com"). So URL parsing/SSRF rules are applied
// only to inputs that actually look like a URL; a bare brand name is
// validated as text instead. (Validating everything as a URL would reject
// every plain brand name with a 400 and break scanning entirely.)
const looksLikeUrl = (value) =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || (/\./.test(value) && !/\s/.test(value));

const isValidTargetUrl = (rawUrl) => {
  if (typeof rawUrl !== 'string') return false;

  const url = rawUrl.trim();
  if (!url) return false;

  try {
    // Bare domains ("nike.com") have no protocol — assume https so they
    // still get parsed and SSRF-checked rather than silently skipped.
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`);

    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (!parsed.hostname) return false;

    const host = parsed.hostname.toLowerCase();

    if (isPrivateOrLocalHostname(host)) return false;
    if (matchesBlockedList(host)) return false;
    if (!matchesAllowlist(host)) return false;

    if (parsed.username || parsed.password) return false;

    return true;
  } catch {
    return false;
  }
};

// A brand name is free text, so this only rejects what can't be a real
// brand: empty, absurdly long, or containing control characters.
const isValidBrandName = (value) => {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v || v.length > 500) return false;
  if (/[\u0000-\u001F\u007F]/.test(v)) return false;
  return true;
};

const createAdminClient = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service role configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 0,
      },
    },
  });
};

const safeFireWebhook = async (supabaseAdmin, userId, eventName, payload) => {
  try {
    await fireWebhooksForEvent(supabaseAdmin, {
      userId,
      event: eventName,
      payload,
    });
  } catch (err) {
    console.error(`Webhook failed: ${eventName}`, err?.message || err);
  }
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  // Check the real body length, not just the declared Content-Length header
  // — the header can be absent or understate the actual payload.
  const declaredLength = Number(event.headers?.['content-length'] || 0);
  const actualLength = event.body ? Buffer.byteLength(event.body) : 0;
  if (declaredLength > 16 * 1024 || actualLength > 16 * 1024) {
    return jsonResponse(413, { error: 'Payload too large' });
  }

  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const token = typeof authHeader === 'string'
    ? authHeader.replace(/^Bearer\s+/i, '').trim()
    : '';

  let authedUser = null;
  let supabaseAdmin = null;
  // Fetched once with the enabled-flag, then reused by recordScanOutcome()
  // so the happy path costs no extra read.
  let scanSettings = { enabled: true, failureCount: 0 };

  try {
    supabaseAdmin = createAdminClient();

    // Checked before the guest-limit counter below, so a disabled scanner
    // never burns someone's free allowance on a scan that can't run.
    scanSettings = await getScanSettings(supabaseAdmin);
    if (!scanSettings.enabled) {
      return jsonResponse(503, {
        error: 'Scanning is temporarily paused. Please check back shortly.',
        scansDisabled: true,
      });
    }

    if (token) {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (authError || !user) {
        return jsonResponse(401, { error: 'Unauthorized' });
      }

      authedUser = user;

      if (shouldRateLimit(`user:${user.id}`)) {
        return jsonResponse(429, {
          error: 'Too many requests. Spróbuj ponownie później.',
        });
      }
    } else {
      const ip = getRequestIp(event.headers || {});

      if (!ip || ip === 'unknown') {
        return jsonResponse(403, {
          error: 'Could not verify request. Please sign in.',
          guestLimitReached: true,
        });
      }

      const { data: guestCount, error: guestError } = await supabaseAdmin.rpc('increment_guest_limit', {
        p_ip: ip,
      });

      if (guestError) {
        console.error('Guest limit RPC error:', guestError?.message || guestError);
        return jsonResponse(503, {
          error: 'Rate limit service unavailable. Please try again later.',
          guestLimitReached: true,
        });
      }

      if ((guestCount ?? 0) > GUEST_LIMIT) {
        return jsonResponse(403, {
          error: 'Guest limit reached. Sign up for more free analyses.',
          guestLimitReached: true,
        });
      }
    }
  } catch (err) {
    console.error('Auth / rate-limit failed:', err?.message || err);
    return jsonResponse(500, { error: 'Authentication failed. Please try again.' });
  }

  let target = 'unknown brand';

  try {
    let payload = {};

    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON payload' });
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return jsonResponse(400, { error: 'Invalid payload format' });
    }

    const rawTarget = typeof payload.url === 'string' ? payload.url.trim() : '';

    // URL-shaped input gets the full SSRF treatment; anything else is
    // treated as a brand name (the common case).
    if (looksLikeUrl(rawTarget)) {
      if (!isValidTargetUrl(rawTarget)) {
        return jsonResponse(400, { error: 'Invalid target URL' });
      }
    } else if (!isValidBrandName(rawTarget)) {
      return jsonResponse(400, { error: 'Invalid brand name' });
    }

    target = rawTarget.slice(0, 500);

    let requestedModelIds = [];
    if (Array.isArray(payload.models)) {
      requestedModelIds = payload.models.filter((m) => typeof m === 'string');
    }

    let planTier = 0;

    if (authedUser) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('plan')
        .eq('id', authedUser.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError?.message || profileError);
      }

      const PLAN_TIER = {
        free: 0,
        starter: 1,
        solo: 1,
        growth: 2,
        enterprise: 2,
        agency: 2,
      };

      planTier = PLAN_TIER[String(profile?.plan || 'free').toLowerCase()] ?? 0;
    }

    const allowedModels = OPENROUTER_MODELS.filter((m) => m.tier <= planTier);
    // User's model picks from Settings, intersected with what their plan
    // actually allows — never let a client-supplied list escalate past tier.
    const requestedSet = new Set(requestedModelIds);
    const selectedModels = requestedSet.size > 0
      ? allowedModels.filter((m) => requestedSet.has(m.id))
      : allowedModels;
    const modelsToQuery = selectedModels.length > 0 ? selectedModels : allowedModels;

    const result = await runBrandScan({
      supabaseAdmin,
      target,
      models: modelsToQuery,
      userId: authedUser?.id || null,
      openrouterEnabled: scanSettings.openrouterEnabled,
    });

    // A fallback result is fabricated (deterministic, not from any real
    // model) — never present that to the user as a genuine analysis.
    if (result?.isFallback) {
      // Say which of the two very different causes this is, and quote the
      // provider's own words per model. "All providers failed" alone sent
      // whoever read it hunting through Netlify logs to find out whether the
      // key was missing, the balance empty, or a model id retired.
      const reason = result.keyConfigured === false
        ? 'OPENROUTER_API_KEY is not configured on this deploy'
        : result.failures?.length
          ? `All ${result.failures.length} model call(s) rejected — ${summariseFailures(result.failures)}`
          : 'All model providers failed (no error detail returned)';
      const { autoDisabled } = await recordScanOutcome(supabaseAdmin, {
        ok: false,
        knownFailureCount: scanSettings.failureCount,
        error: reason,
        autoDisable: scanSettings.autoDisable,
      });
      // Once the watchdog trips, tell this caller it's paused rather than
      // handing them a generic failure — they'd otherwise be the one user
      // seeing an error where everyone after them sees the honest notice.
      if (autoDisabled) {
        return jsonResponse(503, {
          error: 'Scanning is temporarily paused. Please check back shortly.',
          scansDisabled: true,
        });
      }
      // Distinct from a transient scan failure: no provider could serve this
      // request at all, so "try again" is advice that cannot work. The flag
      // carries that to the UI; the reason itself stays server-side, since it
      // quotes the provider's billing messages.
      return jsonResponse(503, {
        error: 'Scanning is unavailable right now. This is on our side, not yours.',
        providerUnavailable: true,
      });
    }

    // A scan that only completed because the direct-provider fallback ran is
    // still a successful scan for the user, but it means the primary provider
    // is down — worth a log line, not a failure count.
    if (result?.usedFallbackProvider) {
      console.warn(`analyze: OpenRouter unavailable, "${target}" served by the direct-provider fallback.`);
    }

    // Clears a partial streak so unrelated flaky moments don't accumulate
    // toward the auto-disable threshold.
    await recordScanOutcome(supabaseAdmin, { ok: true, knownFailureCount: scanSettings.failureCount });

    if (authedUser) {
      safeFireWebhook(supabaseAdmin, authedUser.id, 'analysis.completed', {
        brandName: target,
        ...result,
      });
      await sendAnalysisLifecycle({
        supabaseAdmin,
        userId: authedUser.id,
        email: authedUser.email,
        brandName: target,
        trustScore: result.trustScore,
        dimensions: result,
      });
    }

    return jsonResponse(200, result);
  } catch (error) {
    console.error('analyze handler error:', error?.message || error);

    if (authedUser && supabaseAdmin) {
      safeFireWebhook(supabaseAdmin, authedUser.id, 'analysis.failed', {
        brandName: target,
        error: error?.message || 'Unknown error',
      });
    }

    return jsonResponse(500, {
      error: 'Analysis failed. Please try again.',
    });
  }
};
