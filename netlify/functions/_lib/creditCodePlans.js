const CREDIT_CODE_PLANS = new Set(['growth', 'enterprise']);

export const planAcceptsCreditCode = (plan) => CREDIT_CODE_PLANS.has(plan);
