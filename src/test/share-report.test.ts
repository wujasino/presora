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

  it('returns the three highest measured competitors for a shared brand', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'report_shares') {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({
            data: {
              analysis_id: '00000000-0000-4000-8000-000000000010',
              owner_id: '00000000-0000-4000-8000-000000000001',
            },
            error: null,
          }),
        };
        return query;
      }

      if (table === 'analyses') {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({
            data: {
              id: '00000000-0000-4000-8000-000000000010',
              brand_name: 'Presora.app',
              trust_score: 61,
            },
            error: null,
          }),
        };
        return query;
      }

      if (table === 'tracked_competitors') {
        let filters = 0;
        const query = {
          select: () => query,
          eq: () => {
            filters += 1;
            if (filters < 2) return query;
            return Promise.resolve({
              data: [
                { competitor_name: 'Fourth', last_score: 12, last_scanned_at: null },
                { competitor_name: 'Leader', last_score: 88, last_scanned_at: '2026-10-14T10:00:00Z' },
                { competitor_name: 'Unmeasured', last_score: null, last_scanned_at: null },
                { competitor_name: 'Second', last_score: 75, last_scanned_at: '2026-10-14T10:00:00Z' },
                { competitor_name: 'Third', last_score: 54, last_scanned_at: '2026-10-14T10:00:00Z' },
              ],
              error: null,
            });
          },
        };
        return query;
      }

      if (table === 'profiles') {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({
            data: {
              agency_name: 'Example Agency',
              agency_logo_url: 'https://example.com/logo.png',
              agency_contact_email: 'hello@example.com',
              agency_website: 'https://example.com',
            },
            error: null,
          }),
        };
        return query;
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { handler } = await import('../../netlify/functions/share-report.js');
    const response = await handler({
      httpMethod: 'GET',
      headers: { origin: 'https://presora.app' },
      queryStringParameters: { token: 'a'.repeat(64) },
    });

    expect(response.statusCode).toBe(200);
    const report = JSON.parse(response.body).report;
    expect(report.competitors).toEqual([
      { competitor_name: 'Leader', last_score: 88, last_scanned_at: '2026-10-14T10:00:00Z' },
      { competitor_name: 'Second', last_score: 75, last_scanned_at: '2026-10-14T10:00:00Z' },
      { competitor_name: 'Third', last_score: 54, last_scanned_at: '2026-10-14T10:00:00Z' },
    ]);
    expect(report.branding).toMatchObject({
      name: 'Example Agency',
      contactEmail: 'hello@example.com',
      isWhiteLabeled: true,
    });
  });
});
