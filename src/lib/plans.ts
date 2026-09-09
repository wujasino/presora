import type { PricingTierCard } from '@/components/ui/pricing-cards';

/**
 * Single source of truth for subscription pricing.
 *
 * Extracted from Pricing.tsx once the landing page started showing plans
 * too: two hand-maintained copies of the same numbers drift the moment a
 * price changes, and a landing page quoting a price the checkout doesn't
 * honour is the worst possible place for that to happen.
 *
 * `id` matches the Stripe price-ID lookup in Pricing.tsx's handlePlanSelect
 * and the plan values in netlify/functions/admin-update-user.js's
 * VALID_PLANS — note "Business" is `growth` and "Agency" is `enterprise`
 * internally, so don't rename ids to match the display names.
 */
export const USD = {
  starter_monthly: '$39',
  starter_yearly: '$374',
  solo_monthly: '$59',
  solo_yearly: '$566',
  growth_monthly: '$89.99',
  growth_yearly: '$863.99',
  enterprise_monthly: '$199',
  enterprise_yearly: '$1910',
  credits_20: '$29',
  credits_50: '$55',
  credits_120: '$99',
} as const;

const PERIOD_MONTH = '/month';
const PERIOD_YEAR = '/year';

export const PLANS: PricingTierCard[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Start with three free brand analyses, no credit card required.',
    priceMonthly: 'Free',
    priceYearly: 'Free',
    periodMonthly: '',
    periodYearly: '',
    isPopular: false,
    buttonLabel: 'Start for free',
    features: [
      { name: '3 free brand analyses', isIncluded: true },
      { name: 'Overall AI Visibility Score', isIncluded: true },
      { name: 'Perception radar (5 dimensions)', isIncluded: true },
      { name: 'AI Verdict — actionable summary', isIncluded: true },
      { name: 'Sentiment trend (30 days)', isIncluded: false },
      { name: 'Brand knowledge context (RAG)', isIncluded: false },
      { name: 'Competitor comparison', isIncluded: false },
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'For creators taking their first steps into AI visibility.',
    priceMonthly: USD.starter_monthly,
    priceYearly: USD.starter_yearly,
    periodMonthly: PERIOD_MONTH,
    periodYearly: PERIOD_YEAR,
    isPopular: false,
    buttonLabel: 'Choose plan',
    features: [
      { name: '5 brand analyses per month', isIncluded: true },
      { name: '3 LLM sources (GPT-4o, Claude, Gemini)', isIncluded: true },
      { name: 'Sentiment trend (30 days)', isIncluded: true },
      { name: 'AI Verdict — actionable summary', isIncluded: true },
      { name: 'Brand knowledge context (RAG)', isIncluded: false },
      { name: 'Competitor comparison', isIncluded: false },
    ],
  },
  {
    id: 'solo',
    name: 'Solo',
    description: 'For indie founders and solo marketers tracking their brand.',
    priceMonthly: USD.solo_monthly,
    priceYearly: USD.solo_yearly,
    periodMonthly: PERIOD_MONTH,
    periodYearly: PERIOD_YEAR,
    isPopular: false,
    buttonLabel: 'Choose plan',
    features: [
      { name: '10 brand analyses per month', isIncluded: true },
      { name: '3 LLM sources (GPT-4o, Claude, Gemini)', isIncluded: true },
      { name: 'Sentiment trend (30 days)', isIncluded: true },
      { name: 'Source breakdown chart', isIncluded: true },
      { name: 'Brand knowledge context (RAG)', isIncluded: true },
      { name: 'CSV export', isIncluded: true },
      { name: 'Competitor comparison', isIncluded: false },
    ],
  },
  {
    id: 'growth',
    name: 'Business',
    description: 'For growing teams who need deeper competitive insights. Perfect for small boutique agencies and in-house teams.',
    priceMonthly: USD.growth_monthly,
    priceYearly: USD.growth_yearly,
    periodMonthly: PERIOD_MONTH,
    periodYearly: PERIOD_YEAR,
    isPopular: true,
    buttonLabel: 'Choose plan',
    features: [
      { name: '50 brand analyses per month', isIncluded: true },
      { name: 'All 6 LLM sources + Perplexity', isIncluded: true },
      { name: 'Full source table with confidence', isIncluded: true },
      { name: 'Competitor comparison', isIncluded: true },
      { name: '1-year history & weekly digest', isIncluded: true },
      { name: 'API access', isIncluded: true },
      { name: 'Priority email support', isIncluded: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'Agency',
    description: 'For marketing, SEO, and PR agencies managing multiple client accounts. Includes white-label PDF reports.',
    priceMonthly: USD.enterprise_monthly,
    priceYearly: USD.enterprise_yearly,
    periodMonthly: PERIOD_MONTH,
    periodYearly: PERIOD_YEAR,
    isPopular: false,
    buttonLabel: 'Choose plan',
    features: [
      { name: 'Unlimited analyses', isIncluded: true },
      { name: 'Custom LLM sources + private models', isIncluded: true },
      { name: 'Real-time monitoring & alerts', isIncluded: true },
      { name: 'Unlimited history + webhooks', isIncluded: true },
      { name: 'Slack & Teams integration', isIncluded: true },
      { name: 'Dedicated account manager', isIncluded: true },
      { name: 'White-label PDF reports', isIncluded: true },
      { name: 'SLA guarantee (99.9%, contract-based)', isIncluded: true },
    ],
  },
];
