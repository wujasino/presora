import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from, getUser, upsert } = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser },
    from,
  }),
}));

describe('share-report', () => {
  beforeEach(() => {
    vi.resetModules();
    from.mockReset();
    getUser.mockReset();
    upsert.mockReset();

    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-role-placeholder';

    getUser.mockResolvedValue({
      data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
      error: null,
    });
    upsert.mockResolvedValue({ error: null });

    from.mockImplementation((table: string) => {
      if (table === 'analyses') {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({
            data: { id: '00000000-0000-4000-8000-000000000010' },
            error: null,
          }),
        };
        return query;
      }

      if (table === 'report_shares') return { upsert };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('exports a Netlify handler and creates a public report URL', async () => {
    const { handler } = await import('../../netlify/functions/share-report.js');
    expect(typeof handler).toBe('function');

    const response = await handler({
      httpMethod: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
        origin: 'https://presora.app',
      },
      body: JSON.stringify({ analysisId: '00000000-0000-4000-8000-000000000010' }),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).url).toMatch(
      /^https:\/\/presora\.app\/shared-report\/[a-f0-9]{64}$/,
    );
    expect(upsert).toHaveBeenCalledOnce();
  });
});
