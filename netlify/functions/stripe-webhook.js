import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { planForPriceId } from './_lib/stripePlans.js';
import { planAcceptsCreditCode } from './_lib/creditCodePlans.js';
import { captureCriticalError } from './_lib/sentry.js';
import { getLifecycleRecipient, lifecycleLinks, safeSendLifecycleEvent } from './_lib/resendLifecycle.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CREDIT_LINKS = {
  [process.env.VITE_STRIPE_CREDITS_20]:  20,
  [process.env.VITE_STRIPE_CREDITS_50]:  50,
  [process.env.VITE_STRIPE_CREDITS_120]: 120,
};

// `session.payment_link` on checkout.session.completed is always the
// Payment Link's *id* (`plink_...`) — never the hosted checkout URL Stripe's
// dashboard actually shows you to copy. Pricing.tsx/pricing-modal.tsx send
// the browser straight to that hosted URL (VITE_STRIPE_CREDITS_20 etc., set
// to the full https://buy.stripe.com/... links), so comparing against a
// slug parsed out of the configured URL — the previous approach — could
// never match: every credit-pack purchase silently granted 0 credits.
// Resolving the id via the Stripe API and comparing the real `.url` it
// returns works regardless of whether a given env var holds the id or the
// full URL.
async function creditsFromPaymentLink(paymentLinkId) {
  if (!paymentLinkId) return 0;
  for (const [configured, credits] of Object.entries(CREDIT_LINKS)) {
    if (configured && configured === paymentLinkId) return credits;
  }
  let link;
  try {
    link = await stripe.paymentLinks.retrieve(paymentLinkId);
  } catch (err) {
    console.error('Could not resolve payment_link', paymentLinkId, err.message);
    return 0;
  }
  for (const [configured, credits] of Object.entries(CREDIT_LINKS)) {
    if (configured && configured === link.url) return credits;
  }
  return 0;
}

// Maps a Stripe Subscription object to our `profiles` columns. Single place
// that translates Stripe's subscription state into our state — used by both
// checkout.session.completed (first purchase) and customer.subscription.*
// (every subsequent change: renewal, dunning, cancellation, pause).
function profileFieldsFromSubscription(sub) {
  const priceId = sub.items?.data?.[0]?.price?.id || null;
  const plan = planForPriceId(priceId);
  const status = sub.pause_collection
    ? 'paused'
    : sub.cancel_at_period_end
      ? 'canceled'   // access continues until current_period_end, but it WILL lapse
      : sub.status;  // active | past_due | unpaid | incomplete | trialing ...

  return {
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    ...(plan ? { plan } : {}), // only touch `plan` when we recognize the price
    subscription_status: status,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
  };
}

async function sendBillingLifecycle(userId, eventName, extraPayload = {}) {
  if (!userId) return;
  try {
    const recipient = await getLifecycleRecipient(supabase, userId);
    if (!recipient) return;
    await safeSendLifecycleEvent({
      event: eventName,
      email: recipient.email,
      payload: { first_name: recipient.firstName, plan: recipient.plan, ...lifecycleLinks(recipient.email), ...extraPayload },
    });
  } catch (error) {
    console.error('stripe lifecycle event failed:', error?.message || error);
  }
}

export const handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Dedupe every event type by id via the table's UNIQUE constraint — this
  // insert is the atomic "claim" of the event, safe against two concurrent
  // deliveries of the same id. If processing below throws, we delete this
  // row again so a genuine Stripe retry can still reprocess the event
  // instead of the failure being silently swallowed forever.
  const { error: claimError } = await supabase
    .from('webhook_events')
    .insert({ stripe_event_id: stripeEvent.id });

  if (claimError) {
    // Unique violation (Postgres code 23505) — another delivery already
    // claimed this event id. Anything else is a real DB error; ack anyway
    // since we can't safely record dedupe state, and Stripe will retry.
    if (claimError.code === '23505') {
      return { statusCode: 200, body: JSON.stringify({ received: true, duplicate: true }) };
    }
    captureCriticalError(new Error(claimError.message), { context: 'stripe-webhook: could not claim event', eventType: stripeEvent.type, eventId: stripeEvent.id });
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not record webhook event' }) };
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;
        const creditsToAdd = await creditsFromPaymentLink(session.payment_link);

        if (creditsToAdd > 0 && userId) {
          const { error } = await supabase.rpc('increment_credits', {
            p_user_id: userId,
            p_amount: creditsToAdd,
          });

          if (error) {
            console.error('increment_credits RPC error:', error.message);
            const { data: profile } = await supabase
              .from('profiles')
              .select('credits')
              .eq('id', userId)
              .single();

            await supabase
              .from('profiles')
              .update({ credits: (profile?.credits ?? 0) + creditsToAdd })
              .eq('id', userId);
          }
          break;
        }

        // Subscription checkout — pull the full Subscription object rather
        // than trusting fields on the Session, then persist everything we
        // need to manage it later (cancel/pause/resume, dunning, renewal).
        if (session.mode === 'subscription' && session.subscription && userId) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          const plan = planForPriceId(sub.items?.data?.[0]?.price?.id);

          const creditCode = session.custom_fields
            ?.find((field) => field.key === 'credit_code')
            ?.text?.value
            ?.trim()
            ?.toUpperCase();
          if (creditCode && session.payment_status === 'paid' && planAcceptsCreditCode(plan)) {
            const checkoutEmail = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', userId)
              .maybeSingle();
            if (profileError) throw profileError;

            if (profile?.email && checkoutEmail === profile.email.trim().toLowerCase()) {
              const { data: redemption, error: redemptionError } = await supabase.rpc('redeem_credit_code', {
                p_code: creditCode,
                p_user_id: userId,
                p_checkout_session_id: session.id,
              });
              if (redemptionError) throw redemptionError;
              if (redemption?.status === 'redeemed') {
                console.info(`Credit code redeemed for account ${userId}: ${redemption.credits} credits`);
              } else {
                console.info(`Credit code not applied (${redemption?.status || 'unknown status'}), event ${stripeEvent.id}`);
              }
            } else {
              console.warn(`Credit code not applied due to checkout email mismatch, event ${stripeEvent.id}`);
            }
          }

          await supabase
            .from('profiles')
            .update(profileFieldsFromSubscription(sub))
            .eq('id', userId);
          await sendBillingLifecycle(userId, 'presora.subscription.started', {
            plan: planForPriceId(sub.items?.data?.[0]?.price?.id) || 'paid',
          });
        }
        break;
      }

      // 'created' fires the moment Stripe creates the subscription object —
      // normally redundant with checkout.session.completed's own
      // stripe.subscriptions.retrieve() call above for anything bought
      // through our own Checkout flow, but it's the only sync path for a
      // subscription created some other way (Stripe Dashboard, direct API
      // call), so it shares the same handling as 'updated' rather than
      // being left unhandled.
      //
      // Fires on renewal, plan change, dunning status changes, and when a
      // cancellation is scheduled/undone — the single ongoing sync path.
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = stripeEvent.data.object;
        const userId = sub.metadata?.userId;
        if (userId) {
          await supabase
            .from('profiles')
            .update(profileFieldsFromSubscription(sub))
            .eq('id', userId);
        } else {
          // Fallback for subscriptions created before subscription_data.metadata
          // was set — look the profile up by the Stripe customer id instead.
          const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
          if (customerId) {
            await supabase
              .from('profiles')
              .update(profileFieldsFromSubscription(sub))
              .eq('stripe_customer_id', customerId);
          }
        }
        break;
      }

      // Terminal state — the subscription is gone (period ended after
      // cancel_at_period_end, or was deleted directly). Revert to Free.
      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        const userId = sub.metadata?.userId;

        const match = userId ? { id: userId } : customerId ? { stripe_customer_id: customerId } : null;
        if (match) {
          await supabase
            .from('profiles')
            .update({
              plan: 'free',
              subscription_status: 'inactive',
              cancel_at_period_end: false,
              current_period_end: null,
            })
            .match(match);
        }
        break;
      }

      // Renewal invoice failed — Stripe will already be retrying per its
      // dunning schedule and will emit customer.subscription.updated with
      // status=past_due, but we set it here too in case that event is
      // delayed, so the grace-period UI reacts immediately.
      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        const subId = invoice.subscription;
        if (subId) {
          await supabase
            .from('profiles')
            .update({ subscription_status: 'past_due' })
            .eq('stripe_subscription_id', subId);
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, plan')
            .eq('stripe_subscription_id', subId)
            .maybeSingle();
          await sendBillingLifecycle(profile?.id, 'presora.payment.failed', {
            plan: String(profile?.plan || 'paid'),
          });
        }
        break;
      }

      case 'charge.dispute.created': {
        const dispute = stripeEvent.data.object;
        console.error('Stripe dispute created:', dispute.id, 'charge:', dispute.charge, 'reason:', dispute.reason);
        // No automated evidence submission yet — this at least gets it into
        // logs/alerting so it isn't missed before the response deadline.
        break;
      }

      default:
        break;
    }
  } catch (err) {
    captureCriticalError(err, { context: 'stripe-webhook: processing failed', eventType: stripeEvent.type, eventId: stripeEvent.id });
    // Release the claim so Stripe's retry (it retries non-2xx responses on
    // an exponential backoff for several days) can actually reprocess this
    // event instead of hitting the dedupe path and being silently dropped.
    await supabase.from('webhook_events').delete().eq('stripe_event_id', stripeEvent.id);
    return { statusCode: 500, body: JSON.stringify({ error: 'Webhook processing failed' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
