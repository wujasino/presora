import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { OPENROUTER_MODELS, runBrandScan } from './_lib/runScan.js';
import { fireWebhooksForEvent } from './_lib/webhookDelivery.js';
import { getScanSettings } from './_lib/appSettings.js';
import { syncReputationIncidents } from './_lib/reputationIncidents.js';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = ws;
}

// Netlify Scheduled Function (see the `[functions."check-score-alerts"]`
// schedule in netlify.toml) — re-scans due brand_monitors and writes an
// in-app notification when a monitor's alert_metric drops below its
// alert_threshold. This is the piece that actually makes brand_monitors'
// frequency/alert_metric/alert_threshold columns do something: until now
// they were only ever written by chat.js's set_alert/set_schedule tools and
// never read back.

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const createAdminClient = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service role configuration');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { params: { eventsPerSecond: 0 } },
  });
};

const FREQUENCY_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

// Cap per invocation so one run can't time out chasing a large backlog —
// the rest simply become due again (or already were) on the next run.
const MAX_MONITORS_PER_RUN = 50;

const isDue = (monitor, now) => {
  if (!monitor.last_checked_at) return true;
  const intervalMs = FREQUENCY_MS[monitor.frequency] ?? FREQUENCY_MS.weekly;
  return now - new Date(monitor.last_checked_at).getTime() >= intervalMs;
};

// alert_metric ('sentiment' | 'visibility' | 'mentions') -> analyses column.
// 'visibility' means the overall score, i.e. trust_score.
const METRIC_COLUMN = { sentiment: 'sentiment', visibility: 'trust_score', mentions: 'mentions' };

const METRIC_LABEL = { sentiment: 'Sentiment', visibility: 'Visibility score', mentions: 'Mention rate' };

export const handler = async () => {
  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.error('check-score-alerts: admin client failed:', err.message);
    return { statusCode: 500, body: 'Missing Supabase configuration' };
  }

  const { data: monitors, error: monitorsError } = await admin
    .from('brand_monitors')
    .select('id, user_id, brand, models, frequency, alert_metric, alert_threshold, last_checked_at')
    .eq('enabled', true)
    .not('brand', 'is', null);

  if (monitorsError) {
    console.error('check-score-alerts: failed to load brand_monitors:', monitorsError.message);
    return { statusCode: 500, body: 'Failed to load brand_monitors' };
  }

  // Scheduled re-scans respect the same kill-switch: leave last_checked_at
  // untouched so every monitor is simply picked up on a later run.
  const scanSettings = await getScanSettings(admin);
  if (!scanSettings.enabled) {
    console.log('check-score-alerts: scanning disabled by admin, skipping this run');
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skipped: 'scanning_disabled' }) };
  }

  const now = Date.now();
  const due = (monitors || []).filter((m) => isDue(m, now)).slice(0, MAX_MONITORS_PER_RUN);

  let scanned = 0;
  let notified = 0;
  let incidentsDetected = 0;

  for (const monitor of due) {
    try {
      const models = (Array.isArray(monitor.models) ? monitor.models : [])
        .map((code) => OPENROUTER_MODELS.find((m) => m.shortCode === code))
        .filter(Boolean);
      const modelsToQuery = models.length > 0 ? models : OPENROUTER_MODELS.filter((m) => m.tier === 0);

      const { data: previous } = await admin
        .from('analyses')
        .select('trust_score, sentiment, mentions')
        .eq('user_id', monitor.user_id)
        .eq('brand_name', monitor.brand)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const result = await runBrandScan({
        supabaseAdmin: admin,
        target: monitor.brand,
        models: modelsToQuery,
        userId: monitor.user_id,
        openrouterEnabled: scanSettings.openrouterEnabled,
      });

      // A fallback result is fabricated (deterministic, not from any real
      // model) — recording it as a real analysis, or worse, alerting the
      // user off a fake score drop, is actively misleading. Skip this
      // monitor's cycle entirely and leave last_checked_at untouched so
      // it's retried on the next scheduled run instead of waiting a full
      // frequency period.
      if (result.isFallback) {
        console.warn(`check-score-alerts: monitor ${monitor.id} (${monitor.brand}) got a fallback result, skipping this cycle`);
        continue;
      }
      scanned += 1;

      const { data: savedAnalysis, error: analysisError } = await admin
        .from('analyses')
        .insert({
          user_id: monitor.user_id,
          brand_name: monitor.brand,
          trust_score: result.trustScore,
          authority: result.authority,
          sentiment: result.sentiment,
          recency: result.recency,
          mentions: result.mentions,
          accuracy: result.accuracy,
          sources: result.sources,
        })
        .select('id')
        .single();
      if (analysisError || !savedAnalysis?.id) {
        throw new Error(`Could not save scheduled analysis: ${analysisError?.message || 'missing analysis id'}`);
      }

      try {
        const incidents = await syncReputationIncidents({
          admin,
          monitor,
          analysisId: savedAnalysis.id,
          previous,
          result,
        });
        incidentsDetected += incidents.length;
      } catch (incidentError) {
        // Reputation Guard is additive. A migration/configuration issue here
        // must not make the core scheduled scan retry and save duplicates.
        console.error(`check-score-alerts: reputation guard failed for monitor ${monitor.id}:`, incidentError.message);
      }

      fireWebhooksForEvent(admin, {
        userId: monitor.user_id,
        event: 'analysis.completed',
        payload: { brandName: monitor.brand, ...result },
      }).catch((err) => console.error('check-score-alerts: webhook firing failed:', err.message));

      // ≥5 pts — a couple of points of natural LLM-output noise between
      // re-scans shouldn't fire a webhook every single time.
      if (previous && Math.abs(result.trustScore - previous.trust_score) >= 5) {
        fireWebhooksForEvent(admin, {
          userId: monitor.user_id,
          event: 'score.changed',
          payload: { brandName: monitor.brand, trustScore: result.trustScore, previousTrustScore: previous.trust_score },
        }).catch((err) => console.error('check-score-alerts: webhook firing failed:', err.message));
      }

      const column = METRIC_COLUMN[monitor.alert_metric];
      if (column) {
        const currentValue = column === 'trust_score' ? result.trustScore : result[column];
        const previousValue = previous ? previous[column] : null;
        const threshold = monitor.alert_threshold ?? 60;

        // Edge-triggered: fire once when it *crosses* below the threshold, not
        // on every check while it stays below — otherwise a monitor left below
        // threshold would notify on every single re-check forever.
        const justCrossed = currentValue < threshold && (previousValue === null || previousValue >= threshold);

        if (justCrossed) {
          await admin.from('notifications').insert({
            user_id: monitor.user_id,
            type: 'score_alert',
            title: `${METRIC_LABEL[monitor.alert_metric]} dropped below ${threshold}`,
            body: `${monitor.brand}'s ${METRIC_LABEL[monitor.alert_metric].toLowerCase()} is now ${currentValue} (your alert threshold is ${threshold}).`,
            brand_name: monitor.brand,
            metric: monitor.alert_metric,
            data: { currentValue, previousValue, threshold },
          });
          notified += 1;

          if (monitor.alert_metric === 'sentiment') {
            fireWebhooksForEvent(admin, {
              userId: monitor.user_id,
              event: 'sentiment.dropped',
              payload: { brandName: monitor.brand, currentValue, previousValue, threshold },
            }).catch((err) => console.error('check-score-alerts: webhook firing failed:', err.message));
          }
        }
      }

      await admin.from('brand_monitors').update({ last_checked_at: new Date().toISOString() }).eq('id', monitor.id);
    } catch (err) {
      console.error(`check-score-alerts: monitor ${monitor.id} failed:`, err.message);
      // Keep going — one bad monitor shouldn't block the rest of the batch.
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dueCount: due.length, scanned, notified, incidentsDetected }),
  };
};
