# Presora

AI brand-visibility SaaS. React + TypeScript + Vite + Tailwind + shadcn/ui,
Netlify serverless functions, Supabase (Postgres + Auth + Storage).

## Brand palette (dark mode, app-wide)

- Background `#0B0F19` · Card `#111827` · Border `#334155`
- Text `#F8FAFC` · Muted text `#94A3B8`
- Primary / CTA / logo `#6366F1`, hover `#4F46E5`
- Secondary button (e.g. login) `#1E293B` bg + `#F8FAFC` text

Tokens live in `src/index.css` under `.dark`.

Decorative/repeating chrome (`.hero`, `.badge`, `.cta-box` gradients in
`src/index.css`, and `GradientMeshBg`'s hero orbs) was deliberately toned
down from indigo/violet to neutral graphite — indigo stayed reserved for
actionable elements: `--primary` (buttons, links, focus rings, the 1/2/3
step-number circles on Landing) and `.ai-presence-accent` (the chromatic
hero accent, the one signature moment — on "ChatGPT recommends" since the
headline was rewritten again to lead with the product name, having
previously been on "Find out if it's yours."). Don't casually re-add
indigo tints to background/wash classes; that's undoing an intentional
"vivid identity in some places, neutral everywhere else" split.

One deliberate second exception, added alongside that headline rewrite:
the hero's eyebrow tag ("New in SEO: Generative Engine Optimization
(GEO)") uses a one-off indigo border/tint (inline Tailwind classes, not
the shared `.badge` class every other tag on the page still uses) — it's
the "new category, pay attention" moment introducing GEO before the rest
of the page assumes the reader already knows the term.

## Logo mark

New as of the "ribbon P" redesign (replaced the old solid-indigo glyph).
The source files the user provided (`public/presora-icon-512-dark.png`,
`public/presora-icon-512-white.png`) are flat opaque squares with the
glyph baked in at a dark charcoal color (~`rgb(50,51,56)`) — not directly
usable as an app icon, and that charcoal reads at under 2:1 contrast
against the app's dark backgrounds (effectively invisible).

Derived, actually-used assets:
- `public/presora-mark.png` — copy of `presora-icon-512-white.png`,
  used only for the JSON-LD Organization `"logo"` field in `index.html`
  (expects a plain/light background).
- `public/presora-mark-new.png` — the glyph alpha-masked out to a
  transparent PNG, original charcoal color. For light backgrounds.
- `public/presora-mark-new-dark.png` — same transparent glyph, recolored
  to `--foreground` (`#F8FAFC`). For dark backgrounds.
- `Wordmark.tsx` renders both of the last two, toggled via Tailwind's
  `dark:` variant (no theme hook needed) — mirrors `useFaviconTheme.ts`'s
  light/dark favicon swap, which now also uses the new mark (composited
  onto `#0F0F23` for the `-dark` favicon sizes, replacing the old
  indigo-era ones).

If new master logo files ever replace these again: re-extract the
transparent variants the same way (alpha = luminance-based masking
against the flat background) rather than trying to reuse the opaque
squares directly — see git history around "Use the new logo mark in the
navbar" for the exact approach.

## Landing page (`src/pages/Landing.tsx`)

Defaults to dark (via `ThemeProvider`'s `defaultTheme="dark"` in
`main.tsx`, same as the rest of the app) but is now toggleable — the
`Navbar` takes a `showThemeToggle` prop (only Landing passes it; other
pages using the shared `Navbar` like Terms/Privacy have dark-hardcoded
inline content and would break if toggled). Uses the same palette as the
rest of the app (see Brand palette above, incl. the indigo-vs-neutral
split) plus the `"mono"` `GradientMeshBg` orb variant for the hero
(grayscale — was `"indigo"`, changed together with the palette toning).
`.font-landing` sets Plus Jakarta Sans for body/paragraph text only;
headings (`.font-display`) deliberately fall through to the app-wide
Space Grotesk instead of being overridden, so headings read as the same
family as the wordmark next to the logo mark.

Landing-specific CSS classes with hand-picked colors (`.hero`, `.badge`,
`.cta-box`, `.ai-presence-accent*` in `src/index.css`) each need both a
base (light) and `.dark` override — previously they were dark-only since
the page force-applied `.dark` regardless of the resolved theme.
`useForceDarkTheme()` was removed when the toggle was added; don't
re-add hardcoded dark-only colors on Landing without a light pairing.

The hero input was replaced with `GuestScanWidget` (`src/components/
GuestScanWidget.tsx`) — it used to navigate away to `/brand-visibility`
and show a guest the full result immediately (up to the per-IP guest
limit); it now runs the same real scan inline on the Landing page itself,
blurs 4 of 5 dimensions plus the aggregate score, and gates the full
result behind an email (reusing `newsletter.js`/`newsletter_subscribers`,
no new backend). `/brand-visibility`'s own guest flow is untouched and
still shows a full result directly — About/Agencies/Onboarding/the app's
own nav all still link there, so the two entry points currently behave
differently on purpose pending a decision on whether to unify them.

The live-analysis strip right under the widget (small colored dots +
model names) reuses the same `AI_MODELS` array as the "AI models we
query" section further down the page — deliberately not a second,
separately-typed list, so it can't drift out of sync the way the
four-places-must-agree plan values did (see below).

## Hidden GEO keyword block — removed, don't re-add

`index.html` used to end with an off-screen div (`position:absolute;
width:1px;height:1px;clip:rect(0,0,0,0)`) marked `aria-hidden="true"`,
holding its own `<h1>` plus paragraphs listing the models, the five
dimensions, every pricing tier and a keyword list. It was labelled "GEO
content: visible to AI crawlers, hidden visually".

Removed, and it should stay removed:

- It's precisely what Google's spam policies list under **"Hidden text
  and links"** — text positioned off-screen so crawlers read it and
  people don't. `aria-hidden="true"` meant screen readers couldn't reach
  it either, so it wasn't serving accessibility; it existed only for
  bots. That's a demotion/manual-action risk, not a ranking boost.
- Its `<h1>` was a **second h1 on every page**, competing with the real
  one each React page renders (`Landing.tsx`, `About.tsx`, `Pricing.tsx`
  each have their own).

Nothing was lost: the same facts (description, the six models, the five
dimensions, the ~15s timing, all pricing tiers, the contact address,
GEO/AIO context) are already stated legitimately in the JSON-LD
`Organization` / `SoftwareApplication` / `FAQPage` blocks in the same
file — the format Google actually asks for. Put new crawler-facing facts
there, not in hidden markup.

## Per-page `lang` attribute

`seo-config.json` entries take an optional `lang` (BCP-47). The three
Polish legal pages (`/regulamin`, `/polityka-prywatnosci`,
`/regulamin-newslettera`) set `"lang": "pl"`; everything else inherits
`index.html`'s `en`. Applied in both places that matter:
`scripts/prerender-seo.mjs` rewrites `<html lang>` at build time (for
non-JS crawlers), and `useSeo.ts` sets `document.documentElement.lang`
on SPA navigation — falling back to `'en'` explicitly, so leaving a
Polish page doesn't strand `lang="pl"` on the next English one.

## Landing-page copy rules

Two claims were deliberately left out of the marketing copy and must not be
reintroduced casually:

- **No usage numbers.** "X brands scanned this week" was requested and
  declined: the real figure is single-digit (4 scans in the last 7 days, 14
  total), so publishing it signals the opposite of traction. The hero trust
  bar carries product facts (models queried, ~15s) instead — see the "real
  product facts, not invented usage stats" comment there.
- **No unbuilt integrations.** The "Powered by leading AI models" strip used
  to list Slack, HubSpot, Zapier, Google Analytics, Semrush and Notion.
  Nothing in `netlify/functions` talks to any of them. It now lists the six
  models `runScan.js` actually queries.
- **No unsourced market stats.** A hero-subtitle rewrite asked for "even 40%
  of customers already search in AI instead of Google" — dropped for the
  same reason as the usage-number rule above: it's not a number this
  codebase has any source for, and inventing one is the exact kind of claim
  the rest of this section exists to keep out. The subtitle states the
  trend qualitatively ("more and more customers...") instead. Re-add a real
  figure only with an actual citation, not because it makes the copy punchier.

**The audit takes ~15 seconds**, and that figure is repeated in a lot of
copy: `seo-config.json` (`/` and `/register`), `index.html` (meta
description, twitter:description, and two JSON-LD blocks), `src/lib/faq.ts`,
`locales/en.ts` + `pl.ts` (`profile_empty_desc`), `Landing.tsx` (hero
microcopy, trust bar, feature list), `Pricing.tsx`, `About.tsx`,
`Agencies.tsx`, `Register.tsx`, `GuestScanWidget.tsx` and
`ScrollAuditDemo.tsx`. It had drifted into three different claims (10s in
the FAQ, 15s in the app, 30s in the meta descriptions) before being
reconciled — if the real duration changes, grep for the number rather than
fixing the one place you noticed. Note two unrelated "30 seconds" that are
**not** the audit and shouldn't be swept up: account creation
(`Register.tsx`) and generating an API key (`ApiDocs.tsx`).

Model tiering is stated in four places and they must agree: `src/lib/plans.ts`
(authoritative), `AI_MODELS` in `Landing.tsx`, `src/lib/faq.ts`, and the
JSON-LD in `index.html`. Free = ChatGPT; Starter and Solo add Claude and
Gemini; Business = all six.

The before/after figures (`BEFORE`/`AFTER` in `Landing.tsx`) are illustrative
and labelled as such both in the section badge and in a caption under the
numbers. Don't relabel them as a case study without a real, attributable
customer.

`contact.presora@gmail.com` is still the live address. A switch to
`hello@presora.app` is wanted but deferred until that mailbox actually
receives mail — changing it early loses customer email silently.

## Wordmark font

`.font-wordmark` (in `src/index.css`) uses **Space Grotesk** at semibold
(600) — chosen to pair with the new "ribbon P" logo mark's geometric-but-
fluid shape; Michroma's rigid, blocky letterforms (the previous choice,
matched to the old Rimac-Nevera-style glyph) read as too robotic next to
it. Space Grotesk is already loaded app-wide for `.font-display`
(headings), so this doesn't add a new font fetch, and it now also drives
the Landing hero headline (see Landing page section above) for a
consistent mark+wordmark+headline family. Rendered uppercase via
`Wordmark.tsx` (`uppercase tracking-wide font-semibold`). Loaded via the
main Google Fonts `<link>` in `index.html`. Previously tried Michroma,
Fraunces (Casko substitute) and Satoshi (via Fontshare) — all replaced.

## Social assets

`public/social/presora-avatar.png` (1024×1024, solid indigo gradient bg)
and `presora-banner.png` (1500×500, X/Twitter header size, dark navy +
dot-grid + glow, wordmark in Unbounded font) — regenerate via a Playwright
HTML render (see git history around the "Add social media avatar and
banner assets" commit for the approach) if the palette or copy changes.

## Enterprise SSO (SAML 2.0)

Foundation only — no UI entry point is wired up yet (removed on purpose,
"sam kod, bez przycisku"). `src/lib/samlAuth.ts` exports
`signInWithSSODomain(domain)`, and `Login.tsx` has a ready `sso` mode panel
(domain input → redirects to the IdP) that isn't linked from anywhere in
the visible UI — re-add a button/link calling `switchMode('sso', 1)` when
this is ready to ship.

Supabase Auth acts as the SAML Service Provider. Presora's SP metadata URL
(give this to a customer's IdP admin to set up trust) is:
`https://wxwdymchrmhxeiccnzg.supabase.co/auth/v1/sso/saml/metadata`

To actually register a connection for a customer's domain: the Supabase
project needs the SSO add-on enabled (Team/Enterprise), then run
`supabase sso add --type saml --metadata-url <their IdP metadata URL>
--domains their-company.com` via the Supabase CLI with project-linked
credentials — not doable from this sandbox (no CLI auth, no real project
ref access beyond what's hardcoded in `netlify.toml`'s redirect).

## Feature flags (`app_settings`)

Runtime toggles an admin flips without a redeploy, in `public.app_settings`
(key/jsonb, migration `20240133`). RLS is on with **no policies** — it's
unreachable with an anon/authenticated JWT; only service-role Functions
touch it.

- `scanning_enabled` — master kill-switch for brand scanning. Read via
  `netlify/functions/_lib/appSettings.js`'s `isScanningEnabled()` in
  `analyze.js`, `api-analyze.js` and `check-score-alerts.js`; written only
  by `toggle-scanning.js` (verifies `profiles.is_admin`). UI at
  `/admin/settings`.
- `isScanningEnabled()` **fails open** on a missing row or query error —
  it's a deliberate off-switch, not a security control, so a DB hiccup must
  never take scanning down by itself.
- In `analyze.js` the check sits *before* the guest-limit RPC on purpose, so
  a paused scanner never burns a visitor's free allowance. Verified: with
  the flag off, zero OpenRouter calls and the guest counter untouched.
- **`openrouter_enabled`** (checkbox in `/admin/settings`, independent of the
  main switch) — skips OpenRouter entirely and goes straight to the direct
  provider fallbacks in `runScan.js`. Use it when OpenRouter is known-broken
  (e.g. empty balance): otherwise every scan still pays its ~20s timeout
  across 6 models before falling through anyway, and buries the real signal
  under six 402s per scan in `provider_failures.lastError`. It does **not**
  create a working provider — it only helps if `ANTHROPIC_API_KEY` or
  `GEMINI_API_KEY` is actually valid on the deploy.
- **Auto-pause is OFF by default** (`auto_disable_enabled`, checkbox in
  `/admin/settings`), on the owner's explicit instruction: for an outage that
  lasts rather than a blip, auto-pausing turned every scan into "temporarily
  paused" and only an admin could undo it. Failures are still counted and
  recorded; the flag only controls whether the switch flips by itself.
- **Watchdog**: `recordScanOutcome()` counts consecutive all-models-failed
  scans in `provider_failures` and flips `scanning_enabled` off at
  `AUTO_DISABLE_THRESHOLD` (3), recording why in `scanning_disabled_reason`
  (`source: 'auto' | 'manual'`). A success resets the streak. It never
  re-enables itself — auto-recovery would flap (enable → fail → disable) and
  each cycle costs real users a broken scan; an admin turns it back on once
  the cause is fixed, which also clears the counter.
- `getScanSettings()` reads all three keys in one query and hands the count
  to `recordScanOutcome()`, so the happy path adds no extra round-trip.

## `SECURITY DEFINER` does not change what `auth.role()` returns

The gotcha behind a past outage, worth keeping because it's easy to
reintroduce: `SECURITY DEFINER` changes which Postgres role executes a
function body, **not** what `auth.role()` reports — that reads the
request's JWT claim regardless. So a trigger guarding on
`auth.role() = 'service_role'` will also block the app's own internal
writes, even from a `SECURITY DEFINER` function.

Live mechanism: `protect_plan_changes()` guards `plan`/`credits`/
`is_admin`/`custom_plan_price_*`/`analyses_this_month`/
`analyses_reset_at` on `profiles`. `enforce_analysis_limit()` needs to
bump the two usage counters itself, so it sets a transaction-local GUC
(`presora.internal_usage_write`, migration `20240136`) that
`protect_plan_changes()` accepts *in addition to* the `service_role`
check — scoped to those two columns only. `set_config(..., true)` is
transaction-local and no exposed RPC calls it, so the client can't spoof
it.

When it broke, the symptom was misleading: scans appeared to work
(`analyze.js` returned real results) but every client-side insert into
`analyses` failed with a generic 400, so nothing saved and `/audit/:id`
was unreachable — the bug was in the trigger, not the audit page. Check
`edge_logs` for non-2xx on `/rest/v1/*` when a write silently no-ops.

## Plan values must agree in three places

`enforce_analysis_limit()`'s CASE, `VALID_PLANS` in
`netlify/functions/admin-update-user.js`, and `PLAN_LIMITS` in
`src/hooks/useAccountInfo.ts`. A plan value missing from the trigger's CASE
hits its `ELSE 3` — the account is capped at 3 analyses a month with no
error and no sign of it in the UI.

This drifted once already: migration `20240126` removed the `solo_brew` and
`growth_roast` branches as dead code, but `VALID_PLANS` kept accepting them,
so an admin could set a plan that silently capped the account at 3. Fixed —
the live list is free / starter / solo / growth / enterprise / agency.

Running the old full-migration script from the Supabase SQL editor will
re-add those dead branches (it predates `20240126`) — it is not a safe
"re-sync" tool; prefer the numbered migrations in `supabase/migrations/`.

## Distinct-brand cap (migration `20240143`)

Pricing-page feedback needed a real answer to "how many brands/domains can I
monitor at this price?" — `analyses_this_month` only ever capped total scan
*volume*, not how many different brands a user spreads it across. Free /
Starter / Solo: 1 brand, Business: 5, Agency: 25 (`maxBrands` in
`src/lib/plans.ts`, shown as its own pill on the pricing cards).

Enforced the same way as the monthly limit — inside `enforce_analysis_limit()`
(the `BEFORE INSERT ON analyses` trigger), not in application code, since
that's a real security boundary regardless of insert path (`useBrewing.ts`'s
client-side insert with the user's own JWT, or `api-analyze.js`'s
`supabaseAdmin` insert for API-key scans both go through it). A new
`public.brand_key()` SQL function mirrors `src/lib/analyses.ts`'s
`brandKey()` step-for-step, so "presora", "Presora.app" and
"https://www.presora.app/" count as one brand in the trigger exactly like
they already do client-side.

Re-scanning a brand the user already has at least one analysis for is always
allowed regardless of the cap — only *starting* a brand-new one once already
at the limit is blocked (`RAISE EXCEPTION 'Brand limit reached for plan: ...'`,
caught in `useBrewing.ts` the same way `'Analysis limit reached'` already
is). An account that already exceeded its plan's cap before this shipped
keeps every existing brand fully queryable/re-scannable; only adding another
new one going forward is affected.

`api-analyze.js` doesn't distinguish this trigger's exception from any other
insert failure (same pre-existing gap as `'Analysis limit reached'` there —
it only logs and still returns a 200 with `id: null`); not fixed here since
neither this change nor the feedback that prompted it touched the API-key
path.

## Diagnosing a failed scan

`runBrandScan()` returns `failures` (per-model rejection messages) and
`keyConfigured` alongside the result. `analyze.js` and `api-analyze.js` build
the error from them, `recordScanOutcome()` stores it in
`app_settings.provider_failures.lastError` (1000 chars), and
`/admin/settings` renders it under the failure count — while a streak is
building, not only after the watchdog has already paused scanning.

The point is that a single collapsed message can't tell apart a missing key
(401), an empty balance (402), a retired model id (400) and a rate limit
(429) — four problems with four different fixes. Keep provider errors
specific; the same reasoning applies to any other vendor call
(`create-checkout.js` surfaces Stripe's real message for this reason too).

Note the sandbox proxy blocks `openrouter.ai`, and `OPENROUTER_API_KEY` only
exists in Netlify's environment, so the provider cannot be tested from here —
read the recorded `lastError` instead of guessing.

## Anthropic responses: never assume `content[0]` is the text block

Both `queryAnthropicDirect()` in `runScan.js` and `callClaude()` in
`generate-audit-summary.js` read `data.content?.[0]?.text` — wrong whenever
the first content block isn't type `"text"` (a `"thinking"` block ahead of
it, on a model with extended thinking, is the common case). The call
succeeds (`res.ok` true), so this wasn't a fetch/auth bug: it silently
produced an empty string that either threw a useless "empty response" (scan
path) or fell straight through to the deterministic template with no error
anywhere (audit-summary path) — which is why every generated summary in the
database matched the template exactly even with a valid key.

Both now scan every block in `data.content` for the first one with a
non-empty `.text`, and the scan path's error names `stop_reason` and the
block types actually returned when none qualifies, so a genuine refusal is
still distinguishable from this bug.

Verified against three response shapes: text-only, thinking-then-text (the
real bug — now handled), and a genuine empty `content: []` refusal, which
correctly still produces a fallback rather than a fabricated result.

## Provider redundancy in `runBrandScan()`

OpenRouter was a single point of failure with a single balance: when its
credits ran out every model returned 402 and brand scanning — the product —
stopped.

`runBrandScan()` now falls back to **two direct providers in parallel**
when OpenRouter produced no result at all: Anthropic
(`api.anthropic.com/v1/messages`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODELS`)
and Gemini (`generativelanguage.googleapis.com`, `GEMINI_API_KEY`,
`GEMINI_MODELS`), both dispatched through the shared `runProvider()` helper
so adding a third is one more call, not another branch. Successes from
either are merged before `buildResult()`. Same prompt, same JSON contract —
a genuine scan, not a degraded one; `usedFallbackProvider: true` marks it.

The fallback sits *outside* the `OPENROUTER_API_KEY` branch on purpose, so
it also covers that key being absent entirely. It only runs when OpenRouter
returned nothing, so a healthy scan never pays for a second provider, and a
partial OpenRouter result is left alone.

Only the case where *every* provider fails still produces `isFallback`, so
the watchdog can only trip on a real outage rather than one vendor's
billing.

## A missing report must say so

A failed `loadStoredAnalysis()` lookup sets `notFound` plus an explanatory
error, and `Dashboard` renders it with the same neutral treatment as the
paused state — clock icon, no "Try again" (retrying cannot help), links to
Reports and Home. It used to fail silently to `idle`, which rendered a
near-empty page indistinguishable from the app being broken. A deleted
report and one belonging to another account look the same here on purpose
(RLS).

Worth remembering after any cleanup of `analyses`: deleting rows invalidates
every bookmark and history entry pointing at them.

## Which provider keys are actually configured

A quick, non-invasive check without access to the Netlify environment: the
stored `audit_summary` headlines. `generate-audit-summary.js` only falls back
to `deterministicSummary()` when `ANTHROPIC_API_KEY` is unset, and that
template always reads `"<brand>'s AI visibility is <tier> — trust score
<n>/100"`. Every stored summary matching that shape means the key is missing,
not that Claude wrote a dull headline. (It read as missing on 2026-08-16;
re-check rather than assuming that still holds.) `runBrandScan` also records
"No fallback provider: ANTHROPIC_API_KEY is not set on this deploy" rather
than skipping the fallback in silence.

## Read-only mode when scanning is paused

`netlify/functions/scan-status.js` is a **public** GET returning only
`{ enabled }` — `app_settings` is service-role-only and `toggle-scanning.js`
requires `is_admin`, so the UI had no way to know the switch was off until a
scan had already failed. It deliberately never returns the failure count,
the provider's error text, or who flipped it: those quote OpenRouter's
billing messages and belong behind the admin check.

`useScanStatus()` fails open — a blip must never make the app claim scanning
is down when it isn't. `analyze.js` re-checks the real flag server-side on
every scan, so this is advisory only.

While paused, HomeHub shows a banner pointing at stored reports, the "Run
new scan" CTA becomes an inert "Scanning paused" chip, the re-scan section
and the per-model "Enable & rescan" actions are replaced with static text,
and the scan screen offers "View your saved reports" instead of a dead-end
error. Everything already scanned keeps working — the app degrades to
read-only rather than looking broken.

**The deterministic fallback is never surfaced as a real result.** When every
model fails, `analyze.js` errors rather than showing fabricated scores; that
is the point of the `isFallback` check and must not be relaxed to "keep the
product usable" during an outage.

## `app_settings.value` is `jsonb NOT NULL`

Never write JS `null` to it — PostgREST turns that into SQL NULL and the
insert fails with `23502`. "No value" is expressed by **deleting the row**;
`getScanSettings()` and `toggle-scanning`'s GET both read a missing key as
`null`, and rows still holding the seeded JSON `null` read the same way.

This bit once, silently: `toggle-scanning` wrote the counter reset and
`scanning_disabled_reason: null` as **one array upsert** whose result was
never checked. Enabling scanning therefore left `provider_failures.count`
at 3, so the next failed scan immediately re-tripped the threshold and
switched scanning back off — the exact flapping the watchdog exists to
prevent. `/admin/settings` hid it further by setting the counter to 0
optimistically instead of trusting the response.

Found in `edge_logs`: `POST | 400 | .../rest/v1/app_settings?on_conflict=key`.
Worth grepping those logs for non-2xx after touching any Function — a
swallowed PostgREST error is invisible everywhere else.

## Admin account management

All three admin pages (`/admin/announcements`, `/admin/settings`,
`/admin/pricing`) are linked from the sidebar's Admin section, shown only
when `useIsAdmin()` is true. `/admin/settings` and `/admin/pricing` existed
as routes for a while with **no nav entry at all** — reachable only by typing
the URL, which is why the credit editor looked missing. If you add an admin
route, add its `NavItem` in `Sidebar.tsx` in the same change.

`/admin/settings` (`AdminSettings.tsx`) → `admin-update-user.js`: look an
account up by email and change `plan`, `credits`, or reset the monthly usage
counter. All three are service-role-only writes gated on the caller's
`profiles.is_admin`.

**Why they're service-role-only** (migration `20240134`): `profiles`' UPDATE
policy is `USING (auth.uid() = id)` with no column restriction, and
`protect_plan_changes()` originally guarded only `plan`/`is_admin`/the price
columns. `credits` (bought via Stripe payment links, granted by referrals)
and `analyses_this_month`/`analyses_reset_at` (what
`enforce_analysis_limit()` meters against) were left open — any signed-in
user could grant themselves credits or zero their usage from the browser
console. The trigger now guards all of them. Don't add a new paid-usage
column to `profiles` without adding it to that trigger too.

## Client-ready audit (`/audit/:id`)

The Agency-plan deliverable agencies mail to their own clients as a PDF, so
it has to stand on its own without the reader ever seeing Presora.

- **White-label** (migration `20240135`, applied to the live DB):
  `profiles.agency_{name,logo_url,contact_email,website}` drive the
  letterhead, the "Prepared by" line and the closing CTA — without them a
  forwarded PDF sends the agency's client to `contact.presora@gmail.com`,
  i.e. to us, not to them. Edited at **`/audit-branding`**
  (`AuditBranding.tsx`, its own page under the sidebar's *Tools* section,
  next to Reports — it configures a deliverable, not an account preference,
  so it deliberately isn't a Settings tab), read by `useAuditBranding.ts`.
  RLS and the 60-char `agency_name_length` CHECK are in place and verified.
- `useAuditBranding` is deliberately **not** folded into the shared
  `['profile-flags']` select: selecting a column that doesn't exist is a hard
  Postgres error (42703), and a missing migration must only downgrade the
  letterhead to Presora's, never break the report. The `/audit-branding` page surfaces
  that same error loudly instead, since that's where it's actionable.
- `agency_logo_url`/`agency_website` are http(s)-only on read (`safeHttpUrl`)
  — they land in an `<img src>`/`<a href>` on a page that gets printed and
  mailed onward.
- The branding columns are intentionally **not** in
  `protect_plan_changes()`: they're display fields like `avatar_url`, with no
  billing or quota meaning.
- **Print**: `@page { margin: 16mm 14mm }` and heading `break-after: avoid`
  live in `src/index.css`; individual cards opt out of splitting via the
  `NO_SPLIT` class in `AuditReport.tsx`. Verified no no-split block exceeds
  one A4 page (the tallest, the methodology card, is ~493px of ~1002px
  usable) — an oversized one would force a blank page.
- The methodology + limitations section is load-bearing, not filler: a
  professional reader's first question is where the number comes from, and
  stating what the method *can't* do is what makes the rest credible.

## Verifying a change — don't run the e2e suite unprompted

**Owner's instruction: run the Playwright e2e suite only when explicitly
asked.** It takes ~7 minutes, which is too slow to spend on every edit.

Default verification instead: `npx tsc -p tsconfig.app.json --noEmit`,
`npm run build`, and a targeted check of the thing actually changed
(a Playwright screenshot against a dev server, or grepping the built
`dist/` output). When a change touches what the suite really covers —
login, register, settings, dashboard, the command palette — say so and let
the owner decide whether it's worth a run.

## Hosting split: static site on Cloudflare Workers, backend stays on Netlify

Netlify's account-level build/deploy credits ran out (see `.github/workflows/
deploy.yml`'s comment and `netlify.toml`'s `ignore = "exit 0"`), and don't
reset until the 23rd of the month, which is too long a blackout for the
static site to sit on. The frontend build (`dist/`) moved to a **Cloudflare
Worker using Static Assets** (deployed via `wrangler deploy` in
`.github/workflows/deploy-cloudflare.yml`, config in `wrangler.toml`) — a
plain Worker, not a Cloudflare Pages project (Pages projects get a
`*.pages.dev` domain; this one's dashboard-created preview domain was
`*.workers.dev`, which is how the distinction surfaced). `netlify/functions/
*.js` stays on Netlify unchanged.

This was deliberately **not** a full migration off Netlify. A survey of
every function's dependencies found a real, non-cosmetic blocker:
`netlify/functions/_lib/ssrfGuard.js` calls `dns.promises.lookup()` (Node's
built-in DNS resolver) to check a user-supplied URL's real IP isn't
internal/private before the app ever fetches it (used for
`agency_logo_url`/`agency_website` on the client-ready audit, among others).
Cloudflare Workers have no DNS resolution API at all — no `dns` module, no
polyfill, because Workers isolates don't get raw socket access. Porting that
function means redesigning the SSRF check, not adapting it — a security-
critical piece not worth touching under time pressure just to change
hosts. `jsdom` (`seo-audit.js`), `@sentry/node`, and the two scheduled
functions (`check-score-alerts` hourly, `billing-status` monthly — Cron
Triggers are a separate Worker concern, not something a Pages/Static-Assets
project gets for free) would have needed similar real rework, not just an
adapter layer.

Mechanism: `worker/index.js` is a real fetch handler (`main` in
`wrangler.toml`), not a declarative `_redirects` file — Workers Static
Assets' `_redirects` only supports proxy (200) rules to *relative* paths,
confirmed by a failed deploy ("Proxy (200) redirects can only point to
relative paths"), unlike classic Cloudflare Pages which allows external
targets. So `worker/index.js` proxies `/.netlify/functions/*` and the
`/api/v1/*` aliases itself, via `fetch()`, to the Netlify site
(`https://presora-app.netlify.app`, the Netlify-owned subdomain —
deliberately not the `presora.app` custom domain, which points at
Cloudflare instead and would loop back on itself as a proxy target) and to
Supabase for `/auth/callback`; everything else falls through to
`env.ASSETS.fetch(request)`, which serves `dist/` (SPA fallback via
`wrangler.toml`'s `not_found_handling = "single-page-application"`). No
fetch call anywhere in the rest of the app needed to change — same-origin
paths, same as before. `public/_headers` (security headers) is unaffected
and still works the declarative way.

If a real full migration off Netlify Functions is wanted later, Vercel is
the lower-risk target — its serverless functions are actual Node.js
runtimes, so `dns`/`net`/`jsdom` all run unchanged and `ssrfGuard.js`
ports as-is; only the handler signature (`event/context` → `req/res`)
needs adapting, not the internals.

## Typechecking gotcha

`npx tsc --noEmit` **silently checks nothing** — the root `tsconfig.json`
has `"files": []` and only project references. Use
`npx tsc -p tsconfig.app.json --noEmit`. (This is how a missing
`Label` import slipped into `Onboarding.tsx` earlier.) Three pre-existing
errors in `ai-prompt-box.tsx` and `cookie-banner-1.tsx` are expected noise.

## Scan integrity (`useBrewing.ts`)

Duplicate rows once got written because `startBrewing` had no in-flight
guard and three call sites could reach it (the `brandFromUrl` effect, the
re-scan button, a `setTimeout` retry). The historical duplicates were
cleaned up; these rules are what keep new ones from appearing.

- `inFlight` is a **ref**, not state: two calls in the same tick must not
  both read a stale `false`. Released in a `finally` (so a failed scan
  doesn't wedge the hook) and in `reset()`.
- `canonicalBrandName()` is applied on save; `brandKey()` is the comparison
  key that makes "presora", "Presora.app" and "https://www.presora.app/" one
  brand. `brandKey` strips protocol, `www.`, path and TLD.
- `brandKey()`, `canonicalBrandName()` and `dedupeAnalyses()` live in
  `src/lib/analyses.ts` — pure functions, no React or Supabase imports.
  `dedupeAnalyses` used to be exported from `HomeHub.tsx`, which meant
  `Reports.tsx` importing it dragged recharts and the whole Home screen into
  the Reports chunk (8kB now, and no `HomeHub-*.js` chunk at all — HomeHub
  merges into `Dashboard`, its only renderer).

**A stack trace naming a chunk is not naming a file.** The console error
`Analyze request failed ... at HomeHub-*.js` came from `useBrewing.ts`,
which Rollup had placed in a chunk it happened to name after HomeHub.
Confirm with `grep -c "netlify/functions/analyze" dist/assets/<chunk>.js`
before trusting the name.
- **Deltas compare against the previous scan of the same brand**, not the
  previous row. Comparing `analyses[0]` to `analyses[1]` regardless of brand
  is why one score showed two different deltas on two different days. The
  sparkline is filtered the same way.
- `dedupeAnalyses()` is the read-side safety net and stays regardless of
  the in-flight guard; the guard prevents new duplicates, dedupe hides any
  that slip through.
- Deleting scans does **not** decrement `profiles.analyses_this_month` — the
  trigger only ever increments it. After any cleanup of `analyses`, realign
  the counters by hand or the account keeps being metered for rows that no
  longer exist.

Score bands live in **one** place: `src/lib/dimensionBands.ts` (`bandOf`,
`BAND_LABEL`, `BAND_STYLE`, `BAND_HEX`) — four bands at 90/75/60, imported
by `HomeHub.tsx`, `ResultsBreakdown.tsx`, `AuditReport.tsx`,
`ScrollAuditDemo.tsx` and `GuestScanWidget.tsx`. Every screen used to invent
its own thresholds and words, so the same score could read "Strong" on one
and something implying trouble on another. Don't reintroduce a local
threshold — import from there.

## Locale dictionaries (`src/lib/locales/*.ts`)

~248 of the 396 keys in `en.ts` (and their counterparts in the five other
languages) are currently unreferenced — mostly `settings_*`, `pricing_*`,
`tier_*`, `cookie_*`, `footer_*`, `newsletter_*`, `credits_*`. **This is
intentional; do not "clean them up".** Those sections were rewritten with
English copy inlined in the components, so the keys went dead because the
pages stopped being translated, not because the content disappeared. They
are finished translations in six languages, kept for whenever those pages
get localised again — deleting them means retranslating from scratch.

The `faq_q*`/`faq_a*` keys *were* removed (commit `04e67eb`): the FAQ now
has a single source of truth in `src/lib/faq.ts`, so those were true
duplicates rather than shelved translations.

Note when auditing usage: `t()` is also called with template literals, so
any key starting with `dim_`, `rec_`, `sentiment_` or `source_` is live
even though no string literal in the codebase matches it.

## Known sandbox limitations

- No real internet in this dev/test sandbox except through the proxy —
  `fonts.googleapis.com` and `fonts.gstatic.com` work fine via `curl` and
  in Playwright/Chromium. If a webfont looks wrong in a screenshot, don't
  assume proxy flakiness — check for a stale/corrupted cached font file in
  `/tmp` first (re-`curl` it fresh) before suspecting the network.
- Supabase MCP has **write** access (verified: `apply_migration` applied
  20240133/20240134 successfully). It's been read-only in some earlier
  sessions when the connector wasn't authorised — if `list_tables` errors,
  fall back to handing the user SQL for the Dashboard editor, but try
  first rather than assuming.
- Useful pattern for proving an RLS/trigger hole before and after a fix:
  `BEGIN; SET LOCAL request.jwt.claims = '{"sub":"...","role":"authenticated"}';
  <attack>; ROLLBACK;`. Note `auth.role()` reads the **JWT claim**, not the
  Postgres session role — `SET LOCAL ROLE service_role` alone won't make
  `auth.role()` return `service_role`, and a leftover claim from an earlier
  statement in the same transaction will silently skew the next test.
- GitHub PR for this branch has been merged mid-session more than once —
  always check `git log origin/main` before pushing; if merged, restart
  from `origin/main` and cherry-pick any unmerged commits back on top.

## AI Action Plan (`generate-action-plan.js` / `AiActionPlan.tsx`)

A Claude-generated remediation checklist, separate from `ResultsBreakdown`'s
older deterministic Action Plan (`rec_${dim}` locale-key driven — that one
stays, this is additive). Renders directly under Dashboard's red "AI
recommends your competitors — not you" alert (`score < 60` only).

- Two-column layout: left (~70%) "🛑 Dlaczego AI Cię pomija?" + a 3-step
  checklist (each step has a priority badge — High/Medium/Low — a category
  tag, an interactive checkbox, and click-to-expand for the description);
  right (~30%) a pinned "⚡ Quick Win" card.
- Grounded only in real per-scan data (the 5 dimension scores and each
  model's `association` text) — the prompt explicitly forbids inventing a
  specific competitor, publication, or page not actually named in that
  data, since no citation/URL data exists anywhere in this codebase (see
  Provider redundancy section above on `sources[].association`).
- Cached on `analyses.action_plan` (jsonb, migration `20240139`), same
  cache-once pattern as `audit_summary`. Available to **all signed-in
  users** (not gated to Agency/Enterprise, unlike `generate-audit-summary.js`
  — this is framed as a free "(Beta)" feature).
- **Free/Starter accounts get a blur-gate**: a fixed, non-brand-specific
  placeholder rendered blurred, with an "Unlock Premium" overlay → `/pricing`.
  No API call happens for a gated account at all — a CSS blur only hides
  content *visually*, the text is still in the DOM, so the real plan is
  never fetched or rendered for someone who shouldn't see it yet.
- Per-step checkboxes are persisted to **localStorage**
  (`src/lib/actionPlanProgress.ts`, keyed by `analysisId:stepIndex`) —
  originally spec'd as purely decorative, but Home's "Tasks status" tile
  (next to the dimension-health pie chart in `HomeHub.tsx`) needed a real
  completed count, so this exists to back that. Same per-browser-only
  trade-off as `loadVoicePrefs`/`loadModelPrefs` — no migration, no
  cross-device sync. The tile only renders once `total > 0` (never a
  misleading `0/0`).
- **`/action-plan`** (`ActionPlanHub.tsx`, new sidebar entry) is an index
  over every scan below the low-visibility threshold — each row links to
  its report where the real checklist renders; the hub itself never
  generates or duplicates that content.
- **Home's "Recent Alerts" bar** (above "Recent reports" in `HomeHub.tsx`)
  surfaces the single most urgent thing on the page: first a real
  week-over-week confidence drop for one model (same brand, vs. the
  previous scan), else the highest-priority step of the most recent
  already-cached plan. Never a filler alert when nothing's actually wrong.

## Competitor Tracker (`/competitor-tracker`, `tracked_competitors` table)

Growth/Agency-gated (`tierOf(plan) >= 2`, matching "Competitor comparison"
in `plans.ts`). Two distinct, real signals — never a fabricated "AI
recommends X over Y" statistic:

1. **Mention rate**: a user names competitors per tracked brand
   (`tracked_competitors`, migration `20240140`, RLS-owned, max 10 per
   brand). The percentage shown is a literal, case-insensitive substring
   count of the competitor's name inside that brand's own
   `analyses.sources[].association` text — real stored model output, not
   a synthetic comparison (this app has no infrastructure anywhere that
   asks a model to directly compare two brands).
2. **Head-to-head score**: `netlify/functions/scan-competitor.js` runs the
   **same scan pipeline** `analyze.js` uses (`runBrandScan`) against the
   competitor's name — a real, freshly-measured score, stored on
   `tracked_competitors.last_score`/`last_scanned_at`/`last_scan_error`
   (migration `20240141`). Rate-limited (5/10min — a manual "Scan now"
   click, never automatic; a real scan is expensive, up to 6 model calls).
   Deliberately does **not**: touch `analyses_this_month` or the
   `analyses` table (this is a benchmark measurement, not "your brand was
   scanned"); call `recordScanOutcome()`/trip the auto-disable watchdog (a
   competitor's own visibility failing to resolve isn't a signal that
   Presora's own scanning is broken); pass the caller's `userId` into
   `runBrandScan` (never pulls the account's own brand-knowledge RAG
   context under the competitor's name). A fallback (all-providers-failed)
   result is never stored as a real score — the caller gets a real error
   instead.
   Home's "Recent reports" shows the same head-to-head (e.g. "60 vs 78")
   next to any brand with at least one already-scanned rival; falls back
   to the plain score otherwise.

## Client Branding (formerly "Audit Branding")

`/audit-branding`'s sidebar label and page heading were renamed to
"Client Branding" — same Agency-only gate (`isAgencyPlan`), same route,
just a clearer name for what it actually configures (the white-label
identity on the client-ready audit — see the "Client-ready audit" section
above). No functional change.

## Landing page engagement/retention pieces

- **`MouseSpotlight`** (`src/components/ui/mouse-spotlight.tsx`): a soft
  neutral-graphite radial glow that follows the cursor, fixed + `z-0`
  behind all real content. CSS-custom-property + `requestAnimationFrame`
  lerp, no React re-renders; skips the animation loop under
  `prefers-reduced-motion`; fades in only after the first real pointer
  move so it never flashes at a stale position on touch devices.
- **`ScrollProgressBar`** (`src/components/ui/scroll-progress-bar.tsx`): a
  3px bar at the very top tracking scroll depth (`framer-motion`'s
  `useScroll`/`useSpring`) — purely an orientation cue, no data, nothing
  that can go stale.
- **`StickyCtaPill`** (`src/components/ui/sticky-cta-pill.tsx`): a
  "Check my brand" pill that appears once scrolled past the hero and
  hides again near the footer. Clicking it scrolls **back up** to
  `#hero-input` (same target the mid-page CTAs already use) rather than
  navigating away — the point is to bring a scrolling-but-undecided reader
  back to the one action that matters without ever leaving the page.
  Positioned `bottom-24 left-4`, mirroring `SalesChatWidget`'s
  `bottom-24 right-6` (both clear the cookie consent bar the same way;
  opposite corners so the two floating elements never compete).
- **`SalesChatWidget`'s `hideUntilScrolled` prop** (on `ChatWidgetShell`,
  default off): the floating chat launcher used to sit at a fixed
  `bottom-24 right-6` from first paint, which lands directly on top of the
  hero's "TRY: Tesla/Apple/Nike" example chips on common mobile viewport
  heights (~375×812) — "Nike" was almost entirely hidden underneath it
  before any scroll. Now fades in only once scrolled past ~60% of the
  viewport height. `result-chat-widget` (used on report pages, never over
  a hero) is unaffected — the prop defaults to off.
- **`<main id="main-content">` needs `pt-16 md:pt-28`.** Every other page
  using `<Navbar />` sets `pt-28` on its `<main>` to clear the fixed `h-16`
  navbar — Landing's didn't. The "AI models are already shaping brand
  reputations" urgency strip was the first flow element in `<main>` and
  rendered **entirely behind** the fixed navbar (measured with Playwright:
  0–65px, fully covered; 0–109px on desktop once `SectionNav` — fixed
  `top-16`, desktop-only — stacks underneath it too). Not merely dimmed by
  the navbar's 80%-opacity blur — 0% on-screen on every breakpoint until
  fixed.
- A one-off `MouseSpotlight`-driven trim also removed two sections
  ("Who is it for", "Features bento") that had drifted redundant with
  content elsewhere on the page (891→726 lines at the time).

## Google Sheets mirror for form submissions (`_lib/googleSheets.js`)

`contact.js` and `newsletter.js` both mirror their submission to a Google
Sheet as an extra, human-browsable copy — Supabase (`contact_messages`,
`newsletter_subscribers`) stays the real record either way; the Sheets
write is wrapped in try/catch and never fails the user-facing request.

No `googleapis` SDK dependency — a service-account JWT (signed with
Node's built-in `crypto`, RS256) is exchanged for an OAuth token via a
plain `fetch()` to `oauth2.googleapis.com`, then the row is appended via
the Sheets v4 REST API directly. Matches this codebase's existing style
of calling third-party APIs (Mailchimp, Resend, Stripe) without their SDKs.

Needs three Netlify env vars, all optional — a missing `GOOGLE_SHEETS_ID`
makes `appendRow()` no-op silently, same as the Mailchimp/Resend gating
elsewhere: `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. The spreadsheet must be shared
(Editor) with the service account's email — a service account has no
Drive access of its own — and needs two tabs created ahead of time, named
exactly `Contact` and `Newsletter` (Sheets creates neither the
spreadsheet nor a missing tab on append). Not verifiable from this
sandbox — no real GCP service account credentials are configured here.

## Notes vault

`notes/` is also set up as an Obsidian vault (paired with the Obsidian Git
plugin on the user's machine) for longer-form/browsable notes. This file
(`CLAUDE.md`) is for things Claude should remember automatically every
session — use `notes/` for anything meant to be read as prose in Obsidian.
