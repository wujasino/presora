# Presora — Production SaaS & Quality Engineering

[![E2E Tests](https://github.com/wujasino/presora/actions/workflows/e2e.yml/badge.svg)](https://github.com/wujasino/presora/actions/workflows/e2e.yml)
![Node](https://img.shields.io/badge/node-22.x-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-tests-2EAD33?logo=playwright&logoColor=white)

[Live product →](https://presora.app) · [Production repository](https://github.com/wujasino/presora) · [E2E test project](https://github.com/wujasino/project-presora) · [Test runs →](https://github.com/wujasino/presora/actions)

[Presora](https://presora.app) is a production SaaS for tracking brand visibility in
AI-generated answers. This repository contains the React application, serverless
backend, Supabase migrations, and automated tests for the product.

**App stack:** React · TypeScript · Supabase · Netlify Functions · Stripe
**Test stack:** Playwright · TypeScript · GitHub Actions

## Reviewer quick start

Requirements: Node.js 22.x and npm. From the repository root:

```bash
npm ci --legacy-peer-deps
npm run lint
npm test
npx playwright install chromium
npm run e2e
```

Playwright supplies placeholder Supabase settings and the tests mock external
services, so these checks need no production credentials or test account. To start
the frontend manually, create `.env.local` with placeholder values:

```bash
VITE_SUPABASE_URL=https://placeholder.supabase.co
VITE_SUPABASE_ANON_KEY=placeholder
```

Then run `npm run dev`. The placeholders allow the app to start; real integrations
require separately configured service credentials. See
[Environment variables](#environment-variables) before running Netlify Functions.

---

## What it does

- **Brand visibility audits** — scores a brand across authority, sentiment, recency, mentions and accuracy, with per-model breakdowns
- **RAG-grounded analysis** — brand knowledge is embedded (Voyage `voyage-3.5`) and stored in Supabase pgvector, then retrieved into the prompt so results stay specific instead of generic
- **AI setup assistant with tool calling** — proposes monitoring changes (brand, competitors, cadence, alert thresholds) through structured tools; the user reviews and confirms before changes are saved
- **Automations & monitoring** — recurring brand monitors with alert metrics and thresholds, one config per user
- **Embeddable score badge** — a public SVG endpoint (`/.netlify/functions/badge?brand=…`) that any site can drop in
- **Reports & PDF viewer** — audits rendered as reports with tokenized public share links
- **Voice playback** — report narration via ElevenLabs multilingual TTS
- **Full account layer** — email + Google OAuth sign-in, OTP password reset, recovery codes, avatars, newsletter preferences
- **Billing** — Stripe checkout for monthly/yearly plans and credit packs, with webhook-driven plan sync and admin-managed Agency credit codes with redemption limits
- **6 UI languages** — EN, PL, DE, ES, FR, IT
- **Public status page** — live health check of the app and Supabase Auth/DB reachability, no fabricated uptime numbers
- **Contact page** — a real form (name, email, subject, message) backed by its own rate-limited serverless endpoint

## Tech stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), React Router, TanStack Query |
| Visualisation | Recharts, three.js / react-force-graph-3d, Framer Motion |
| Backend | Node.js on Netlify serverless functions |
| Data & Auth | Supabase — PostgreSQL, pgvector, Auth, Row-Level Security, Storage |
| AI | Anthropic Claude (brand analysis + separate monitoring setup assistant), Voyage AI embeddings, ElevenLabs TTS |
| Payments | Stripe — checkout, customer portal, webhook-driven plan upgrades |
| Email | Resend (transactional), Mailchimp (newsletter) |
| Testing | Vitest + Testing Library (unit), Playwright (E2E + API contract) |
| Infra | Netlify CI/CD, custom domain & DNS, Google OAuth proxy redirect |

## Engineering highlights

- **RAG pipeline end-to-end** — ingestion function, chunking, Voyage embeddings, pgvector similarity search, context injection into the analysis prompt
- **Separate assistant boundaries** — brand scans use retrieved pgvector context (RAG); the monitoring setup assistant uses Claude tool-calling and static instructions, not RAG. Proposed setting changes are confirmed by the user before persistence.
- **Tool-calling assistant** — monitoring changes are staged as proposals, then validated and saved by the serverless function using the JWT-verified user id
- **Defense in depth on data access** — RLS policies on every user-owned table (analyses, monitors, recovery codes, newsletter, rate limits), plus service-role functions that never trust a client-supplied user id
- **Layered rate limiting** — per-user windows and daily caps enforced in Postgres, with an in-memory limiter as a secondary guard, and a separate guest quota path for unauthenticated trials
- **Auth hardening** — OTP-based password reset with attempt lockout, one-time recovery codes, Google OAuth routed through a Netlify proxy so the Supabase project ref never leaks into the browser
- **Production security headers** — strict CSP with an explicit allow-list, HSTS preload, frame denial, MIME sniff protection, scoped Permissions-Policy
- **Cache strategy tuned per asset class** — immutable hashing for build output, revalidation for images, no-store for HTML
- **Versioned SQL migrations** covering schema, policies, triggers and storage buckets
- **Shipped and debugged in production** across auth, serverless runtime limits, Stripe webhooks and third-party API failures
- **Error monitoring & analytics ready, opt-in** — Sentry and Plausible are wired up but inert until `VITE_SENTRY_DSN` / `VITE_PLAUSIBLE_DOMAIN` are set, so nothing ships half-configured or points at a fake project
- Anthropic per-request token usage and cost are not currently persisted or calculated.
## Reviewer guide

- Start with `src/` for the frontend and `netlify/functions/` for serverless API
  handlers; database schema, access policies, and triggers live in
  `supabase/migrations/`.
- `e2e/` contains browser and API contract tests. Browser tests mock external
  services; API tests exercise the local function handlers without production
  credentials.
- The GitHub Actions E2E workflow is manually triggered or scheduled nightly. It
  is not currently a merge or deployment gate.
- For security reporting and scope, see [SECURITY.md](SECURITY.md).

## Project structure

```
netlify/functions/   Serverless endpoints (analyze, chat, ingest-knowledge,
                     stripe-webhook, badge, tts, auth/OTP, newsletter, …)
src/pages/           Routes — Landing, Dashboard, Reports, Automations,
                     Pricing, Developers, ApiDocs, Settings, auth flows
src/lib/             Supabase client, auth, brand scoring, i18n + 6 locales
src/components/      shadcn/ui-based component layer
supabase/migrations/ schema, RLS policies, triggers, storage buckets
```

## Running locally

```bash
git clone https://github.com/wujasino/presora.git
cd presora
npm install --legacy-peer-deps
```

Create `.env.local` with the required values from the table below, then start
the app and its serverless functions:

```bash
npx netlify dev           # app on :8888, functions included
```

Frontend-only (`npm run dev`, port 4000) works, but any route hitting
`/.netlify/functions/*` needs `netlify dev`.

### Environment variables

| Group | Variables |
|-------|-----------|
| Supabase | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| AI | `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `ELEVENLABS_API_KEY` |
| Payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_*_PRICE_ID` |
| Auth | `VITE_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Email | `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_MARKETING_FROM`, `RESEND_REPLY_TO`, `NEWSLETTER_UNSUBSCRIBE_SECRET`, `RESEND_LOW_SCORE_THRESHOLD`, `MAILCHIMP_API_KEY`, `MAILCHIMP_LIST_ID` |
| Limits | `RATE_LIMIT_WINDOW_MS`, `MAX_REQUESTS_PER_WINDOW`, `MAX_REQUESTS_PER_DAY` |
| Observability *(optional)* | `VITE_SENTRY_DSN` (error monitoring, off until set), `VITE_PLAUSIBLE_DOMAIN` (cookieless analytics, off until set) |

### Resend lifecycle automations

Presora emits lifecycle events after account activation, successful scans,
subscription checkout, and failed payments. Marketing sequences start only for
users who selected the optional email consent during registration; transactional
account, result, and billing messages do not depend on that consent.

Create the event schemas, published templates, and seven disabled automations in
Resend with:

```bash
npm run resend:setup
```

Review them in Resend, then either enable them there or create and enable them in
one command with `npm run resend:setup -- --enable`. The command is idempotent by
event, template, and automation name. Production also needs
`NEWSLETTER_UNSUBSCRIBE_SECRET` so every sales email gets a one-click signed
unsubscribe URL. Apply `20240145_lifecycle_email_events.sql` before deploying
the Functions so the server-side frequency caps are active from the first send.

Every message uses the recipient's first name when available and falls back to
a neutral greeting when it is not. The emails deliberately use a simple,
personal letter layout, a real reply address through `RESEND_REPLY_TO`, and one
clear action instead of a promotional card full of buttons. Set
`RESEND_MARKETING_FROM` to a separate marketing sender while keeping
`RESEND_FROM` for account, result, and billing messages. The signed unsubscribe
endpoint supports both the human-facing GET link and an RFC 8058-compatible POST
request; the production sender still needs `List-Unsubscribe` and
`List-Unsubscribe-Post` enabled in Resend for mailbox-native one-click UI.

Low-score messaging is emitted only for opted-in users whose scan score is
below `RESEND_LOW_SCORE_THRESHOLD` (defaults to `60`). It includes the weakest
measured dimension and one matching action. Competitive-risk copy is used only
when a saved competitor has a real `last_score` above the user's result; the
email shows both scores and the measured gap. Without that evidence, Presora
sends the quick win without naming or implying a competitor. Both flows wait
three days and exit without sending if a subscription starts first. Scan-result
messages are capped to one per brand per day, personalized diagnostic messages
to one matching result per 14 days, and generic nurture messages to one start
per 14 days. This prevents repeated scans from creating a burst of near-identical
mail.

### Tests

```bash
npm test    # Vitest unit tests
npm run e2e # Playwright E2E — see "Testing" below for what's covered and how it's set up
```

The optional live monitoring-assistant prompt evaluation is separate from the
mocked E2E suite. It checks 20 curated requests against expected Claude tool calls
and arguments; it does not score answer quality. It makes paid Anthropic API
requests and prints provider-reported token totals without storing them:

```bash
npm run evaluate:monitoring-assistant -- --confirm-cost
```

Set `ANTHROPIC_API_KEY` before running it. It is not part of CI.

## Testing

The test suite covers core UI flows, serverless API behavior, and shared frontend logic. Run the commands above to see the current test inventory and results for this checkout; `npm run test:coverage` reports current unit-test coverage.

| Layer | Tool |
|-------|------|
| End-to-end (UI) | Playwright + TypeScript, Page Object Model |
| API contract | Playwright's `request` fixture against the real Netlify Function handlers |
| Unit | Vitest + Testing Library |
| CI | GitHub Actions, 2-way sharded, manual dispatch + nightly schedule — never gates a merge or deploy |

**Coverage areas** (`e2e/`)

- **Authentication** — successful login, rejection of bad credentials, required-field validation, the forgot-password → OTP-code flow, signup (success, password-mismatch validation, "already registered" failure), and unauthenticated visitors getting redirected off protected routes.
- **Dashboard** — the real per-model AI confidence data (`analyses.sources`) rendering correctly, a `–` placeholder instead of a fabricated number when that data is missing, and the account menu/sign-out flow.
- **Settings** — a canceled subscription showing its status and a working *Resume* button, an active subscription showing no cancellation banner, the referral panel (happy path and a failed lookup degrading to an inline error instead of a crash), and tab navigation.
- **Command palette** — the ⌘K/Ctrl+K global search opens, filters, navigates, and closes on Escape, with an assertion that it never trips a Radix accessibility warning.
- **Public pages** — Landing, Pricing, About, Contact, Status render with zero console errors.
- **API contracts** (`e2e/api/`) — request validation, method and authentication requirements, rate limiting, CORS behavior, and graceful handling of backend failures.

**Design decisions**

- **No live backend or test account required.** UI tests mock Supabase Auth/REST and the Netlify Functions layer at the network level (`e2e/mocks/supabase.ts`) instead of hitting a real Supabase project — deterministic, runs in CI with zero secrets, and lets edge cases (a canceled subscription, a 500 from an API) be asserted directly rather than reproduced by hand. `auth.setup.ts` still drives the real login form once, against a mocked `/auth/v1/token` response, and persists the resulting session via `storageState` for every other UI spec to reuse.
- **API tests run the real function code, not a mock.** `e2e/api/functionServer.ts` wraps each Netlify Function's actual `exports.handler` in a throwaway local HTTP server, so Playwright's `request` fixture hits genuine code — no `netlify dev`, no real Supabase/Stripe credentials, since the contracts under test (validation, rate limiting, method/CORS handling) all run before any real backend call. Where a test needs to see how the *real* backend call fails (an unreachable Supabase host), it points at one and lets the real network error happen.
- **PostgREST-shape-aware mocks.** supabase-js sends a different `Accept` header for `.single()`/`.maybeSingle()` queries and expects a bare object back, not an array — the UI mocks inspect that header and respond with the shape the caller actually expects.
- **Role-based locators first.** `getByRole` / `getByLabel` over CSS selectors, so the tests survive refactors and surface accessibility problems as failures — this is how two of the bugs below were found.
- **No `waitForTimeout` anywhere.** Tests wait on element state, URL changes, and network responses (real or mocked) rather than fixed delays.
- **Console-error fixture.** A shared `consoleIssues` fixture (`e2e/fixtures.ts`) collects uncaught page errors and `console.error` calls per test, so regressions that don't fail an assertion but do throw silently still get caught.
- **Failures are debuggable.** Traces on first retry, screenshots and video on failure, all uploaded as CI artifacts.

**Bugs found and fixed while building the suite**

- `Login.tsx`/`Register.tsx` had `<Label>` elements never associated to their `<Input>` via `htmlFor`/`id` — invisible to `getByLabel()` and to screen readers alike, despite looking correctly labeled.
- Signing out from a protected page could silently land on `/login` instead of the landing page: `signOut()` fires an auth-state-change partway through its own promise chain, which `ProtectedRoute` (still mounted at that moment) reacts to with its own redirect — a race the explicit `navigate('/')` call could lose non-deterministically.
- `netlify/functions/*.js` is written in CommonJS (`exports.handler`), but the repo root's `package.json` says `"type": "module"` — Netlify's own bundler tolerates the mix, but any plain Node tooling (including this test suite's own function-server harness) tried to load the files as ES modules and got back an object with no `.handler`. Fixed with a nested `netlify/functions/package.json` declaring `{"type": "commonjs"}`, which is the standard fix for exactly this split and makes the functions loadable outside Netlify's bundler too.

**Running locally**

```bash
npm install
npx playwright install --with-deps chromium

# The suite never calls a real backend, so any non-empty Supabase URL/key
# unblocks the app's own startup check:
echo 'VITE_SUPABASE_URL=https://placeholder.supabase.co
VITE_SUPABASE_ANON_KEY=placeholder' > .env.local

npm run e2e                        # everything: UI (chromium + mobile-chrome) + API contracts
npm run e2e -- --project=api       # just the API contract tests — no browser, no dev server needed
npm run e2e:ui                     # interactive runner
npm run e2e:report                 # open the last HTML report
```

Set `BASE_URL` to point the UI projects at a deployed preview instead of the local dev server — the `api` project is unaffected, since it never talks to a URL at all, only to the function handlers directly.

## Security

Security policy and disclosure process: [SECURITY.md](SECURITY.md).

---

## About

Built by **Patryk Rybacki** — Full-Stack Developer (React · TypeScript · Node.js · Supabase).

- Live product: [presora.app](https://presora.app)
- LinkedIn: [patryk-rybacki](https://linkedin.com/in/patryk-rybacki-503599355)
