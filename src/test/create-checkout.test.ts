import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createSession } = vi.hoisted(() => ({
  createSession: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: class Stripe {
    checkout = { sessions: { create: createSession } };
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => {
    const profileQuery = {
      select: () => profileQuery,
      eq: () => profileQuery,
      maybeSingle: async () => ({ data: { stripe_customer_id: 'cus_test' }, error: null }),
    };
    return {
      auth: {
        getUser: async () => ({
          data: { user: { id: '00000000-0000-4000-8000-000000000001', email: 'buyer@example.com' } },
          error: null,
        }),
      },
      from: () => profileQuery,
    };
  },
}));

describe('create-checkout', () => {
  beforeEach(() => {
    vi.resetModules();
    createSession.mockReset();
    createSession.mockResolvedValue({ url: 'https://checkout.stripe.com/test' });
    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-role-placeholder';
    process.env.VITE_STRIPE_STARTER_PRICE_ID = 'price_starter_monthly';
    process.env.VITE_STRIPE_BUSINESS_PRICE_ID = 'price_business_monthly';
    process.env.VITE_STRIPE_AGENCY_YEARLY_PRICE_ID = 'price_agency_yearly';
  });

  it('collects billing data and offers a credit code for Business', async () => {
    const { handler } = await import('../../netlify/functions/create-checkout.js');
    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer valid-token', origin: 'https://presora.app' },
      body: JSON.stringify({ priceId: 'price_business_monthly' }),
    });

    expect(response.statusCode).toBe(200);
    expect(createSession).toHaveBeenCalledOnce();
    const [checkout] = createSession.mock.calls[0];
    expect(checkout).toMatchObject({
      mode: 'subscription',
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer: 'cus_test',
      customer_update: { address: 'auto', name: 'auto' },
      metadata: { plan: 'growth', billingCycle: 'monthly', source: 'presora_checkout' },
      subscription_data: {
        metadata: { plan: 'growth', billingCycle: 'monthly', source: 'presora_checkout' },
      },
    });
    expect(checkout.custom_fields?.[0]?.key).toBe('credit_code');
  });

  it('does not show the credit-code field for Starter', async () => {
    const { handler } = await import('../../netlify/functions/create-checkout.js');
    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer valid-token', origin: 'https://presora.app' },
      body: JSON.stringify({ priceId: 'price_starter_monthly' }),
    });

    expect(response.statusCode).toBe(200);
    const [checkout] = createSession.mock.calls[0];
    expect(checkout.custom_fields).toBeUndefined();
    expect(checkout.metadata.plan).toBe('starter');
  });
});
