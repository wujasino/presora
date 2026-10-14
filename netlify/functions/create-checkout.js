import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

import { PLAN_BY_PRICE_ID, planForPriceId } from './_lib/stripePlans.js';

const ALLOWED_PRICE_IDS = new Set(Object.keys(PLAN_BY_PRICE_ID));

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (event.body && event.body.length > 10 * 1024) {
    return { statusCode: 413, body: JSON.stringify({ error: 'Payload too large' }) };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfiguration' }) };
  }

  const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { priceId } = body;
  if (!priceId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing priceId' }) };
  }

  if (ALLOWED_PRICE_IDS.size > 0 && !ALLOWED_PRICE_IDS.has(priceId)) {
    // Price ids aren't secret — they're already embedded in the client
    // bundle (Pricing.tsx reads them via import.meta.env) and visible in
    // this very request. Echoing the rejected value + how many the
    // function actually has configured is what makes a Netlify env-var
    // scope mismatch (set for Builds but not Functions, or a stale value
    // in one scope) diagnosable from the browser console alone.
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: `Invalid priceId: '${priceId}' is not one of the ${ALLOWED_PRICE_IDS.size} price id(s) this function has configured.`,
      }),
    };
  }

  const creditCode = typeof body.creditCode === 'string' ? body.creditCode.trim().toUpperCase() : '';
  if (creditCode && !/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(creditCode)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid credit code format' }) };
  }
  if (creditCode && planForPriceId(priceId) !== 'enterprise') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Credit codes are only available for Agency subscriptions' }) };
  }

  const allowedOrigins = ['https://presora.app', 'https://www.presora.app'];
  let origin = process.env.URL || 'https://presora.app';
  try {
    const reqOrigin = event.headers?.origin;
    if (reqOrigin && allowedOrigins.includes(reqOrigin)) {
      origin = reqOrigin;
    } else if (event.headers?.referer) {
      const ref = new URL(event.headers.referer).origin;
      if (allowedOrigins.includes(ref)) origin = ref;
    }
  } catch {
    // use default
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    // Reuse the existing Stripe Customer if this user already has one —
    // otherwise `customer_email` makes Stripe mint a new Customer object on
    // every checkout, fragmenting one person's history across duplicates.
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    const customerParams = profile?.stripe_customer_id
      ? { customer: profile.stripe_customer_id }
      : { customer_email: user.email };

    // Idempotency key derived from the business operation (who, what price,
    // coarse time window) rather than a fresh random value per call — a
    // double-click or network retry within the window resolves to the same
    // Checkout Session instead of creating a duplicate one.
    const idempotencyBucket = Math.floor(Date.now() / (2 * 60 * 1000));
    const idempotencyKey = `checkout-${user.id}-${priceId}-${creditCode || 'no-code'}-${idempotencyBucket}`;

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        ...customerParams,
        ...(planForPriceId(priceId) === 'enterprise'
          ? {
              custom_fields: [{
                key: 'credit_code',
                label: { type: 'custom', custom: 'Credit code — credits after payment' },
                type: 'text',
                optional: true,
                text: {
                  maximum_length: 32,
                  minimum_length: 3,
                  ...(creditCode ? { default_value: creditCode } : {}),
                },
              }],
            }
          : {}),
        client_reference_id: user.id,
        metadata: {
          userId: user.id,
          priceId,
        },
        subscription_data: {
          metadata: { userId: user.id, priceId },
        },
        success_url: `${origin}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/pricing?canceled=true`,
      },
      { idempotencyKey }
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    console.error('Stripe checkout error:', error.message);
    // Stripe's own SDK error messages are written to be shown to an end
    // user (e.g. "No such price: 'price_xxx'", "No such customer: 'cus_xxx'")
    // and don't leak secrets — surfacing the real one here instead of a
    // single generic string is the same fix already applied to the scan
    // pipeline's provider errors (analyze.js/runScan.js), for the same
    // reason: a collapsed error message makes a real, specific failure
    // (wrong price id, stale/deleted customer, expired key) indistinguishable
    // from every other one, both for the user and for anyone debugging it.
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Checkout creation failed. Please try again.' }),
    };
  }
};
