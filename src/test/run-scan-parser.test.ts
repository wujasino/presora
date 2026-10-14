import { describe, expect, it } from 'vitest';
import { parseModelJson, summariseFailures } from '../../netlify/functions/_lib/runScan.js';

describe('scan provider response parsing', () => {
  const result = {
    authority: 71,
    sentiment: 68,
    recency: 64,
    mentions: 59,
    accuracy: 73,
    trustScore: 67,
    association: 'A useful brand',
  };

  it('accepts a raw JSON response', () => {
    expect(parseModelJson(JSON.stringify(result))).toEqual(result);
  });

  it('accepts JSON wrapped in prose and a markdown fence', () => {
    const response = `Here is the requested analysis:\n\`\`\`json\n${JSON.stringify(result)}\n\`\`\``;
    expect(parseModelJson(response)).toEqual(result);
  });

  it('still rejects a response with no valid JSON object', () => {
    expect(() => parseModelJson('Analysis unavailable')).toThrow('invalid JSON response');
  });

  it('keeps the real provider error in diagnostics', () => {
    expect(summariseFailures([
      'Claude Opus: HTTP 401 — invalid x-api-key',
      'Claude Sonnet: HTTP 401 — invalid x-api-key',
    ])).toBe('2 models: HTTP 401 — invalid x-api-key');
  });
});
