import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUser, maybeSingle, from } = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser }, from }),
}));

describe('reputation incident status endpoint', () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset();
    maybeSingle.mockReset();
    from.mockReset();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-role-placeholder';

    const query = {
      update: () => query,
      eq: () => query,
      select: () => query,
      maybeSingle,
    };
    from.mockReturnValue(query);
  });

  it('requires an authenticated user', async () => {
    const { handler } = await import('../../netlify/functions/reputation-incident-status.js');
    const response = await handler({ httpMethod: 'POST', headers: {}, body: '{}' });
    expect(response.statusCode).toBe(401);
  });

  it('updates only an incident owned by the authenticated user', async () => {
    getUser.mockResolvedValue({ data: { user: { id: '00000000-0000-4000-8000-000000000001' } }, error: null });
    maybeSingle.mockResolvedValue({
      data: { id: '00000000-0000-4000-8000-000000000010', status: 'resolved' },
      error: null,
    });

    const { handler } = await import('../../netlify/functions/reputation-incident-status.js');
    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer valid-token', origin: 'https://presora.app' },
      body: JSON.stringify({
        incidentId: '00000000-0000-4000-8000-000000000010',
        status: 'resolved',
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(from).toHaveBeenCalledWith('reputation_incidents');
    expect(maybeSingle).toHaveBeenCalledOnce();
  });
});
