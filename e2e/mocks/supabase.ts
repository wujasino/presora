/**
 * Route-mocking helpers for Supabase (auth + REST) and Netlify Functions.
 *
 * The app is a Vite SPA backed by real Supabase Auth/Postgres and Netlify
 * Functions — there's no local test backend to run E2E tests against, so
 * these tests intercept the actual network calls the app makes and return
 * fixture data instead. This keeps the suite fast, deterministic, and
 * runnable in CI without real credentials.
 *
 * PostgREST quirk worth knowing: supabase-js sends
 * `Accept: application/vnd.pgrst.object+json` for `.single()`/`.maybeSingle()`
 * queries and expects a bare JSON object back — not an array. Send an array
 * for one of those and supabase-js silently fails to parse it (discovered
 * the hard way auditing Profile.tsx). `singleAware()` below returns the
 * right shape based on the incoming Accept header so every REST mock behaves
 * like the real thing regardless of which query style the calling code uses.
 */
import type { Page, Route } from '@playwright/test';

export const TEST_USER = {
  id: 'e2e-user-0000-0000-0000-000000000001',
  email: 'e2e.tester@example.com',
};

export type MockSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
    email: string;
    aud: string;
    role: string;
    created_at: string;
    app_metadata: Record<string, unknown>;
    user_metadata: Record<string, unknown>;
  };
};

const base64url = (input: string) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * supabase-js decodes `session.access_token` as a real JWT client-side (e.g.
 * to read the `aal` claim for MFA checks in Login.tsx) — it never verifies
 * the signature, but `decodeJWT()` throws on anything that isn't three
 * base64url segments. A plain string token breaks that call with an
 * uncaught AuthInvalidJwtError, which Login.tsx's try/catch then mis-reports
 * as a failed sign-in. Build a structurally valid (unsigned) JWT instead.
 */
const makeFakeJwt = (userId: string, email: string) => {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    sub: userId,
    email,
    aud: 'authenticated',
    role: 'authenticated',
    aal: 'aal1',
    amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
    exp: Math.floor(Date.now() / 1000) + 3600,
  }));
  const signature = base64url('e2e-fake-signature');
  return `${header}.${payload}.${signature}`;
};

export function buildSession(overrides: Partial<MockSession['user']> = {}): MockSession {
  const id = (overrides.id as string) ?? TEST_USER.id;
  const email = (overrides.email as string) ?? TEST_USER.email;
  return {
    access_token: makeFakeJwt(id, email),
    refresh_token: 'e2e-fake-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id,
      email,
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
      app_metadata: { provider: 'email' },
      user_metadata: {},
      ...overrides,
    },
  };
}

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Returns `body` as-is for `.single()`/`.maybeSingle()` callers, wrapped in an array otherwise. */
const singleAware = (route: Route, row: Record<string, unknown> | null, rows: Record<string, unknown>[]) => {
  const accept = route.request().headers()['accept'] || '';
  const wantsSingle = accept.includes('vnd.pgrst.object');
  return json(route, 200, wantsSingle ? row : rows);
};

/** Auth endpoints: sign in, sign up, sign out, get-user. Call once per test/setup. */
export async function mockAuth(page: Page, session: MockSession) {
  await page.route('**/auth/v1/token*', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    json(route, 200, session);
  });

  await page.route('**/auth/v1/signup*', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    json(route, 200, session);
  });

  await page.route('**/auth/v1/logout*', route => json(route, 204, {}));

  await page.route('**/auth/v1/user*', route => {
    if (route.request().method() === 'GET') {
      return json(route, 200, session.user);
    }
    route.fallback();
  });
}

/** Auth sign-in that always fails with invalid-credentials, for negative-path tests. */
export async function mockAuthLoginFailure(page: Page, message = 'Invalid login credentials') {
  await page.route('**/auth/v1/token*', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    json(route, 400, { error: 'invalid_grant', error_description: message, msg: message });
  });
}

export type ProfileFixture = {
  id: string;
  plan: string;
  subscription_status: 'active' | 'paused' | 'canceled' | 'inactive' | 'past_due';
  current_period_end: string | null;
  avatar_url: string | null;
  credits: number;
};

export function buildProfile(overrides: Partial<ProfileFixture> = {}): ProfileFixture {
  return {
    id: TEST_USER.id,
    plan: 'growth',
    subscription_status: 'active',
    current_period_end: new Date(Date.now() + 86400_000 * 20).toISOString(),
    avatar_url: null,
    credits: 42,
    ...overrides,
  };
}

/** `profiles` table — used by usePlan(), Profile.tsx, Settings.tsx. */
export async function mockProfiles(page: Page, profile: ProfileFixture) {
  await page.route('**/rest/v1/profiles*', route => singleAware(route, profile, [profile]));
}

export type AnalysisFixture = Record<string, unknown>;

export function buildAnalysis(overrides: AnalysisFixture = {}): AnalysisFixture {
  return {
    id: 'e2e-analysis-1',
    user_id: TEST_USER.id,
    brand_name: 'Nike',
    trust_score: 78,
    score: 78,
    authority: 82,
    sentiment: 74,
    recency: 45,
    mentions: 88,
    accuracy: 55,
    created_at: new Date().toISOString(),
    // Labels must match MODEL_CATALOG's `label` exactly (src/lib/models.ts) —
    // HomeHub matches sources to models by label, not id.
    sources: [
      { model: 'GPT-4o', sentiment: 70, association: 80, confidence: 76 },
      { model: 'Claude', sentiment: 78, association: 84, confidence: 81 },
      { model: 'Gemini', sentiment: 65, association: 70, confidence: 69 },
    ],
    results: {},
    ...overrides,
  };
}

/** `analyses` table — supports both list selects and the `count: 'exact', head: true` query. */
export async function mockAnalyses(page: Page, analyses: AnalysisFixture[]) {
  await page.route('**/rest/v1/analyses*', route => {
    if (route.request().method() === 'HEAD') {
      return route.fulfill({
        status: 200,
        headers: { 'content-range': `0-${Math.max(analyses.length - 1, 0)}/${analyses.length}` },
        body: '',
      });
    }
    singleAware(route, analyses[0] ?? null, analyses);
  });
}

/** Empty-table mocks for the remaining REST reads Dashboard/Settings/Profile fire on mount. */
export async function mockEmptyTables(page: Page, tables = ['brand_monitors', 'notifications', 'referrals', 'tracked_competitors']) {
  for (const table of tables) {
    await page.route(`**/rest/v1/${table}*`, route => json(route, 200, []));
  }
}

export type ReferralFixture = {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  milestoneSize: number;
  progressInCurrentMilestone: number;
  milestonesAvailable: number;
  rewardsClaimed: number;
};

export function buildReferral(overrides: Partial<ReferralFixture> = {}): ReferralFixture {
  return {
    referralCode: 'E2E-TEST',
    referralLink: 'https://presora.app/register?ref=E2E-TEST',
    totalReferrals: 2,
    milestoneSize: 5,
    progressInCurrentMilestone: 2,
    milestonesAvailable: 0,
    rewardsClaimed: 0,
    ...overrides,
  };
}

/** `/.netlify/functions/referral` — GET status / POST claim. */
export async function mockReferralFunction(page: Page, referral: ReferralFixture) {
  await page.route('**/.netlify/functions/referral*', route => json(route, 200, referral));
}

/** `/.netlify/functions/newsletter-preference` — GET/POST subscription toggle. */
export async function mockNewsletterPreference(page: Page, subscribed = false) {
  await page.route('**/.netlify/functions/newsletter-preference*', route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { subscribed: boolean };
      return json(route, 200, { subscribed: body.subscribed });
    }
    json(route, 200, { subscribed });
  });
}

/** Convenience bundle: everything a signed-in dashboard/settings test typically needs. */
export async function mockAuthenticatedApp(page: Page, opts: {
  session?: MockSession;
  profile?: ProfileFixture;
  analyses?: AnalysisFixture[];
  referral?: ReferralFixture;
} = {}) {
  const session = opts.session ?? buildSession();
  const profile = opts.profile ?? buildProfile();
  const analyses = opts.analyses ?? [buildAnalysis()];
  const referral = opts.referral ?? buildReferral();

  await mockAuth(page, session);
  await mockProfiles(page, profile);
  await mockAnalyses(page, analyses);
  await mockEmptyTables(page);
  await mockReferralFunction(page, referral);
  await mockNewsletterPreference(page, false);
  await page.route('**/.netlify/functions/scan-status', route => json(route, 200, { enabled: true }));

  return { session, profile, analyses, referral };
}
