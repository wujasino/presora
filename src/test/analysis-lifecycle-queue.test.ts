import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('analysis lifecycle queue', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_SERVICE_KEY = 'test-service-secret';
    process.env.URL = 'https://presora.app';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('queues email work through the background function', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.stubGlobal('fetch', fetchMock);
    const { queueAnalysisLifecycle } = await import('../../netlify/functions/_lib/resendLifecycle.js');

    const result = await queueAnalysisLifecycle({
      userId: '00000000-0000-4000-8000-000000000001',
      email: 'user@example.com',
      brandName: 'Presora',
      trustScore: 72,
      dimensions: { authority: 70 },
    });

    expect(result).toEqual({ queued: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://presora.app/.netlify/functions/analysis-lifecycle-background',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Presora-Signature': expect.stringMatching(/^[a-f0-9]{64}$/) }),
      }),
    );
  });

  it('stops waiting when the background queue is slow', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    })));
    const { queueAnalysisLifecycle } = await import('../../netlify/functions/_lib/resendLifecycle.js');

    const queued = queueAnalysisLifecycle({
      userId: '00000000-0000-4000-8000-000000000001',
      brandName: 'Presora',
      trustScore: 72,
      dimensions: {},
    });
    await vi.advanceTimersByTimeAsync(1500);

    await expect(queued).resolves.toEqual({ error: true });
  });
});
