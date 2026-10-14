import { describe, expect, it } from 'vitest';
import { deriveReputationIncidents } from '../../netlify/functions/_lib/reputationIncidents.js';

const healthyResult = {
  trustScore: 78,
  accuracy: 82,
  sources: [
    { model: 'Gemini', association: 'A well-known analytics platform.' },
  ],
  isFallback: false,
};

describe('reputation incident detection', () => {
  it('does not use competitor fear when the brand score is healthy', () => {
    const incidents = deriveReputationIncidents({
      brandName: 'Presora',
      previous: { trust_score: 80 },
      result: healthyResult,
      competitor: { competitor_name: 'Rival', last_score: 95 },
    });

    expect(incidents.some((incident) => incident.type === 'competitor_gap')).toBe(false);
    expect(incidents).toEqual([]);
  });

  it('creates evidence-backed incidents for a weak, falling score', () => {
    const incidents = deriveReputationIncidents({
      brandName: 'Presora',
      previous: { trust_score: 72 },
      result: {
        trustScore: 48,
        accuracy: 44,
        sources: [{ model: 'Gemini', association: 'It might be a reporting tool.' }],
        isFallback: false,
      },
      competitor: { competitor_name: 'Rival', last_score: 74 },
    });

    expect(incidents.map((incident) => incident.type)).toEqual([
      'low_visibility',
      'score_drop',
      'low_accuracy',
      'model_uncertainty',
      'competitor_gap',
    ]);
    expect(incidents.find((incident) => incident.type === 'score_drop')?.evidence).toMatchObject({
      previousScore: 72,
      currentScore: 48,
      delta: 24,
    });
  });

  it('never creates an incident from a fabricated fallback result', () => {
    expect(deriveReputationIncidents({
      brandName: 'Presora',
      previous: { trust_score: 90 },
      result: { ...healthyResult, trustScore: 20, isFallback: true },
      competitor: { competitor_name: 'Rival', last_score: 95 },
    })).toEqual([]);
  });
});
