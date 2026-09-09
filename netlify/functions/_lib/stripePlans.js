// Single source of truth mapping a Stripe Price ID to our internal plan name.
// Shared by create-checkout.js (to validate/allowlist incoming priceIds) and
// stripe-webhook.js (to decide which plan to grant on checkout.session.completed
// and customer.subscription.updated). Previously the webhook had its own
// `priceId === SOLO ? 'solo' : 'growth'` ternary that silently mis-assigned
// every other price — including Starter — to the most expensive plan.
export const PLAN_BY_PRICE_ID = {
  ...(process.env.VITE_STRIPE_STARTER_PRICE_ID        ? { [process.env.VITE_STRIPE_STARTER_PRICE_ID]:        'starter' } : {}),
  ...(process.env.VITE_STRIPE_STARTER_YEARLY_PRICE_ID ? { [process.env.VITE_STRIPE_STARTER_YEARLY_PRICE_ID]: 'starter' } : {}),
  ...(process.env.VITE_STRIPE_SOLO_PRICE_ID           ? { [process.env.VITE_STRIPE_SOLO_PRICE_ID]:           'solo'    } : {}),
  ...(process.env.VITE_STRIPE_SOLO_YEARLY_PRICE_ID    ? { [process.env.VITE_STRIPE_SOLO_YEARLY_PRICE_ID]:    'solo'    } : {}),
  // Env var is named BUSINESS (the plan's actual display name — see
  // src/lib/plans.ts, id 'growth' / name 'Business') to match what's set in
  // Netlify and GitHub Actions secrets; the internal plan id stays 'growth'
  // since that's also load-bearing in enforce_analysis_limit()'s CASE and
  // VALID_PLANS (admin-update-user.js) — renaming the id itself would touch
  // a live DB trigger for no reason.
  ...(process.env.VITE_STRIPE_BUSINESS_PRICE_ID         ? { [process.env.VITE_STRIPE_BUSINESS_PRICE_ID]:         'growth'  } : {}),
  ...(process.env.VITE_STRIPE_BUSINESS_YEARLY_PRICE_ID  ? { [process.env.VITE_STRIPE_BUSINESS_YEARLY_PRICE_ID]:  'growth'  } : {}),
  // Same naming note as BUSINESS above: env var says AGENCY (the plan's
  // display name), internal plan id stays 'enterprise' — that's what
  // enforce_analysis_limit()'s CASE and VALID_PLANS (admin-update-user.js)
  // actually key on.
  ...(process.env.VITE_STRIPE_AGENCY_PRICE_ID           ? { [process.env.VITE_STRIPE_AGENCY_PRICE_ID]:           'enterprise' } : {}),
  ...(process.env.VITE_STRIPE_AGENCY_YEARLY_PRICE_ID    ? { [process.env.VITE_STRIPE_AGENCY_YEARLY_PRICE_ID]:    'enterprise' } : {}),
};

export const planForPriceId = (priceId) => PLAN_BY_PRICE_ID[priceId] || null;
