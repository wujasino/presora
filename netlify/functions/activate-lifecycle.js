import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { claimLifecycleEvent, lifecycleLinks, personalizeFirstName, safeSendLifecycleEvent } from './_lib/resendLifecycle.js';

if (!globalThis.WebSocket) globalThis.WebSocket = ws;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_ORIGINS = new Set(['https://presora.app', 'https://www.presora.app']);

const headersFor = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://presora.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type': 'application/json',
  Vary: 'Origin',
});

export const handler = async (event) => {
  const headers = headersFor(event.headers?.origin || '');
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Missing Supabase configuration');
    const token = String(event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.email) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

    const email = user.email.trim().toLowerCase();
    const marketingConsent = user.user_metadata?.marketing_consent === true;
    if (marketingConsent) {
      const { error } = await supabase.from('newsletter_subscribers').upsert({
        email,
        subscribed_at: new Date().toISOString(),
        unsubscribed_at: null,
      }, { onConflict: 'email' });
      if (error) console.error('activate-lifecycle consent:', error.message);
    }

    const { data: profile } = await supabase.from('profiles').select('plan, full_name').eq('id', user.id).maybeSingle();
    const payload = {
      first_name: personalizeFirstName(profile?.full_name),
      plan: String(profile?.plan || 'free'),
      ...lifecycleLinks(email),
    };
    const activationClaimed = await claimLifecycleEvent(supabase, {
      userId: user.id,
      eventName: 'presora.user.activated',
      key: 'account',
      days: 36500,
    });
    if (activationClaimed) {
      await safeSendLifecycleEvent({ event: 'presora.user.activated', email, payload });
    }
    if (marketingConsent) {
      const nurtureClaimed = await claimLifecycleEvent(supabase, {
        userId: user.id,
        eventName: 'presora.nurture.started',
        key: 'account',
        days: 30,
      });
      if (nurtureClaimed) {
        await safeSendLifecycleEvent({ event: 'presora.nurture.started', email, payload });
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error('activate-lifecycle:', error?.message || error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not start onboarding emails' }) };
  }
};
