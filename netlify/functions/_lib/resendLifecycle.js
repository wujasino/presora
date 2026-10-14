import crypto from 'node:crypto';
import { Resend } from 'resend';

const SITE_URL = (process.env.URL || 'https://www.presora.app').replace(/\/$/, '');
const configuredLowScore = Number(process.env.RESEND_LOW_SCORE_THRESHOLD || 60);
const LOW_VISIBILITY_SCORE = Number.isFinite(configuredLowScore)
  ? Math.max(1, Math.min(100, configuredLowScore))
  : 60;

let client;
const getClient = () => {
  if (!process.env.RESEND_API_KEY) return null;
  client ||= new Resend(process.env.RESEND_API_KEY);
  return client;
};

export const lifecycleLinks = (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const signature = secret && normalizedEmail
    ? crypto.createHmac('sha256', secret).update(normalizedEmail).digest('hex')
    : '';

  return {
    dashboard_url: `${SITE_URL}/dashboard`,
    pricing_url: `${SITE_URL}/pricing`,
    unsubscribe_url: signature
      ? `${SITE_URL}/.netlify/functions/unsubscribe-newsletter?email=${encodeURIComponent(normalizedEmail)}&sig=${signature}`
      : `${SITE_URL}/settings`,
  };
};

export async function sendLifecycleEvent({ event, email, payload = {} }) {
  const resend = getClient();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!resend || !normalizedEmail) return { skipped: true };

  const { data, error } = await resend.events.send({
    event,
    email: normalizedEmail,
    payload,
  });
  if (error) throw new Error(`Resend event ${event} failed: ${error.message}`);
  return data;
}

export async function safeSendLifecycleEvent(input) {
  try {
    return await sendLifecycleEvent(input);
  } catch (error) {
    // Lifecycle email must never break registration, scanning, or billing.
    console.error('resend-lifecycle:', error?.message || error);
    return { error: true };
  }
}

/**
 * Hands post-scan email work to a Netlify Background Function. A completed
 * AI scan must not wait for profile lookups, frequency caps or Resend before
 * its report reaches the browser.
 */
export async function queueAnalysisLifecycle(payload) {
  const secret = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !payload?.userId) return { skipped: true };

  const body = JSON.stringify({ ...payload, issuedAt: Date.now() });
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const siteUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://presora.app').replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(`${siteUrl}/.netlify/functions/analysis-lifecycle-background`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Presora-Signature': signature,
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`resend-lifecycle queue: background function returned ${response.status}`);
      return { error: true };
    }
    return { queued: true };
  } catch (error) {
    console.error('resend-lifecycle queue:', error?.name === 'AbortError' ? 'queue request timed out' : error?.message || error);
    return { error: true };
  } finally {
    clearTimeout(timeout);
  }
}

export const personalizeFirstName = (fullName) => {
  const first = String(fullName || '').trim().split(/\s+/)[0] || '';
  return first && !first.includes('@') && /^[\p{L}\p{M}'’-]{1,40}$/u.test(first) ? first : 'there';
};

const periodBucket = (days) => Math.floor(Date.now() / (days * 24 * 60 * 60 * 1000));

export async function claimLifecycleEvent(supabaseAdmin, { userId, eventName, key, days = 1 }) {
  const dedupeKey = `${String(key).slice(0, 260)}:${periodBucket(days)}`;
  const { error } = await supabaseAdmin.from('lifecycle_email_events').insert({
    user_id: userId,
    event_name: eventName,
    dedupe_key: dedupeKey,
  });
  if (!error) return true;
  if (error.code === '23505') return false;
  // Keep email functional during a rolling deploy where Functions may land
  // just before the migration, but make the missing cap visible in logs.
  console.error('resend-lifecycle frequency cap:', error.message);
  return true;
}

export async function getLifecycleRecipient(supabaseAdmin, userId, emailHint) {
  let email = String(emailHint || '').trim().toLowerCase();
  if (!email) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    email = String(data?.user?.email || '').trim().toLowerCase();
  }
  if (!email) return null;

  const [{ data: profile }, { data: subscriber }] = await Promise.all([
    supabaseAdmin.from('profiles').select('plan, full_name').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('newsletter_subscribers').select('unsubscribed_at').eq('email', email).maybeSingle(),
  ]);

  return {
    email,
    plan: String(profile?.plan || 'free').toLowerCase(),
    firstName: personalizeFirstName(profile?.full_name),
    marketingConsent: Boolean(subscriber && !subscriber.unsubscribed_at),
  };
}

const DIMENSION_GUIDANCE = {
  authority: {
    label: 'Authority',
    action: 'Add one verifiable proof point—customer result, expert citation, or original data—to the page that best answers the buyer question.',
  },
  sentiment: {
    label: 'Sentiment',
    action: 'Strengthen the page with a clear customer outcome and directly address the most common objection or negative association.',
  },
  recency: {
    label: 'Recency',
    action: 'Refresh your strongest relevant page with current facts, a visible update date, and one recent example.',
  },
  mentions: {
    label: 'Mentions',
    action: 'Publish one focused answer to the exact buyer question and support it through a credible third-party mention.',
  },
  accuracy: {
    label: 'Accuracy',
    action: 'Make your core offer, audience, and differentiator explicit and consistent on your homepage and strongest supporting page.',
  },
};

const brandKey = (raw) => String(raw || '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/^www\./, '')
  .replace(/\/.*$/, '')
  .replace(/\.(com|net|org|io|app|co|ai|dev|xyz|pl|eu|de|fr|es|it|uk)$/, '')
  .replace(/\s+/g, ' ')
  .trim();

const weakestDimension = (dimensions = {}) => {
  const ranked = Object.keys(DIMENSION_GUIDANCE)
    .map((key) => ({ key, score: Number(dimensions[key]) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => a.score - b.score);
  const weakest = ranked[0] || { key: 'authority', score: 0 };
  return { ...weakest, ...DIMENSION_GUIDANCE[weakest.key] };
};

async function getMeasuredCompetitorGap(supabaseAdmin, userId, brandName, score) {
  const key = brandKey(brandName);
  if (!key) return null;
  const { data, error } = await supabaseAdmin
    .from('tracked_competitors')
    .select('competitor_name, last_score, last_scanned_at')
    .eq('user_id', userId)
    .eq('brand_key', key)
    .not('last_score', 'is', null)
    .order('last_score', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('resend-lifecycle competitor lookup:', error.message);
    return null;
  }
  const competitorScore = Number(data?.last_score);
  if (!data?.competitor_name || !Number.isFinite(competitorScore) || competitorScore <= score) return null;
  return {
    competitor_name: String(data.competitor_name).slice(0, 60),
    competitor_score: Math.round(competitorScore),
    score_gap: Math.round(competitorScore - score),
  };
}

export async function sendAnalysisLifecycle({ supabaseAdmin, userId, email, brandName, trustScore, dimensions }) {
  try {
    const recipient = await getLifecycleRecipient(supabaseAdmin, userId, email);
    if (!recipient) return;
    const links = lifecycleLinks(recipient.email);
    const payload = {
      first_name: recipient.firstName,
      brand_name: String(brandName || 'Your brand').slice(0, 500),
      visibility_score: Math.max(0, Math.min(100, Math.round(Number(trustScore) || 0))),
      plan: recipient.plan,
      ...links,
    };

    const resultClaimed = await claimLifecycleEvent(supabaseAdmin, {
      userId,
      eventName: 'presora.analysis.completed',
      key: brandKey(payload.brand_name),
      days: 1,
    });
    if (resultClaimed) {
      await safeSendLifecycleEvent({ event: 'presora.analysis.completed', email: recipient.email, payload });
    }
    if (recipient.marketingConsent) {
      if (payload.visibility_score < LOW_VISIBILITY_SCORE) {
        const weak = weakestDimension(dimensions);
        const diagnosticPayload = {
          ...payload,
          weakest_dimension: weak.label,
          weakest_score: Math.max(0, Math.min(100, Math.round(weak.score))),
          quick_win: weak.action,
        };
        const competitorGap = await getMeasuredCompetitorGap(
          supabaseAdmin,
          userId,
          payload.brand_name,
          payload.visibility_score,
        );
        const eventName = competitorGap ? 'presora.analysis.competitor_gap' : 'presora.analysis.low_score';
        const diagnosticKey = competitorGap
          ? `${brandKey(payload.brand_name)}:${competitorGap.competitor_name.toLowerCase()}:${weak.key}`
          : `${brandKey(payload.brand_name)}:${weak.key}`;
        const claimed = await claimLifecycleEvent(supabaseAdmin, {
          userId,
          eventName,
          key: diagnosticKey,
          days: 14,
        });
        if (claimed) {
          await safeSendLifecycleEvent({
            event: eventName,
            email: recipient.email,
            payload: competitorGap ? { ...diagnosticPayload, ...competitorGap } : diagnosticPayload,
          });
        }
      } else if (recipient.plan === 'free') {
        const claimed = await claimLifecycleEvent(supabaseAdmin, {
          userId,
          eventName: 'presora.analysis.nurture_started',
          key: brandKey(payload.brand_name),
          days: 14,
        });
        if (claimed) {
          await safeSendLifecycleEvent({ event: 'presora.analysis.nurture_started', email: recipient.email, payload });
        }
      }
    }
  } catch (error) {
    console.error('resend-lifecycle analysis:', error?.message || error);
  }
}
