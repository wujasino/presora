import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeBrandReputation } from '../../netlify/functions/_lib/brandReputation.js';

describe('analyzeBrandReputation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('skips the optional review when no Groq key is configured', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(analyzeBrandReputation({
      brandName: 'Presora',
      llmResponseSnippet: 'A brand association.',
    })).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends the snippet to Groq and returns its analysis and usage', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Możliwe ryzyko reputacyjne.' } }],
        usage: { total_tokens: 42 },
      }),
    });
    vi.stubGlobal('fetch', fetch);

    await expect(analyzeBrandReputation({
      brandName: 'Presora',
      llmResponseSnippet: 'Wzmianka do sprawdzenia.',
    })).resolves.toEqual({
      analysis: 'Możliwe ryzyko reputacyjne.',
      usage: { total_tokens: 42 },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body).messages[1].content)
      .toContain('Wzmianka do sprawdzenia.');
  });

  it('surfaces provider errors instead of returning an empty analysis', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(analyzeBrandReputation({
      brandName: 'Presora',
      llmResponseSnippet: 'Wzmianka do sprawdzenia.',
    })).rejects.toThrow('Groq API request failed (429)');
  });
});
