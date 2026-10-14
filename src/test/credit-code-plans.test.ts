import { describe, expect, it } from 'vitest';
import { planAcceptsCreditCode } from '../../netlify/functions/_lib/creditCodePlans.js';

describe('planAcceptsCreditCode', () => {
  it('accepts codes for Business and Agency only', () => {
    expect(planAcceptsCreditCode('growth')).toBe(true);
    expect(planAcceptsCreditCode('enterprise')).toBe(true);
    expect(planAcceptsCreditCode('starter')).toBe(false);
    expect(planAcceptsCreditCode('solo')).toBe(false);
    expect(planAcceptsCreditCode(null)).toBe(false);
  });
});
