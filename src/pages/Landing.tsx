import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Eye, Shield, HelpCircle, Mail, ArrowRight, ShieldCheck, Clock, PenLine, Tag, Wallet, Repeat, UserRound, UsersRound } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HeroProofMockup } from '@/components/HeroProofMockup';
import { SectionNav } from '@/components/SectionNav';
import { ScanResultPreview } from '@/components/ScanResultPreview';
import { CookiePanel } from '@/components/ui/cookie-banner-1';
import { SalesChatWidget } from '@/components/ui/sales-chat-widget';
import { NewsletterSignup } from '@/components/ui/newsletter-signup';
import { ScrollProgressBar } from '@/components/ui/scroll-progress-bar';
import { StickyCtaPill } from '@/components/ui/sticky-cta-pill';
import { FAQ_EN } from '@/lib/faq';
import { PricingCards } from '@/components/ui/pricing-cards';
import { PLANS } from '@/lib/plans';

const GROWTH_LOOP = [
  { Icon: Eye, step: 'Monitor', desc: 'Scheduled scans track how 6 leading AI models describe and recommend your brand.' },
  { Icon: ShieldCheck, step: 'Detect', desc: 'Evidence-backed incidents surface score drops, weak accuracy and uncertain answers.' },
  { Icon: HelpCircle, step: 'Explain', desc: 'See the exact signals behind each risk instead of another unexplained alert.' },
  { Icon: PenLine, step: 'Recover', desc: 'Follow a prioritized action plan, then re-scan to verify that the risk is gone.' },
];

/* ── Trust points ─────────────────────────────────────────────────── */
/* Verifiable facts about how the product actually works — not customer
   quotes. Presora doesn't have public case studies yet, and inventing
   testimonials to fill the space would be dishonest, so this trades a
   "social proof" slot for a "how this actually works" one instead. */
const TRUST_POINTS = [
  {
    Icon: Shield,
    title: 'Your data is walled off from everyone else\'s',
    desc: 'Your scans, notes and account details are separated at the database itself — not just hidden by the app. Another customer cannot reach your data even if something goes wrong in the software.',
    iconBg: 'bg-indigo-400/10 border-indigo-400/20 text-indigo-400',
  },
  {
    Icon: Eye,
    title: 'Your data isn\'t used to train models',
    desc: 'What you tell us about your brand is sent to the AI companies only to produce your result — never to teach their models, and never shared with anyone else.',
    iconBg: 'bg-primary/10 border-primary/20 text-primary',
  },
  {
    Icon: ShieldCheck,
    title: 'Full control over your data',
    desc: 'Download everything, or delete your account for good, whenever you like — straight from Settings. No emailing support to ask.',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
  },
];

/* Sections offered in the sticky in-page nav, in page order. */
const NAV_SECTIONS = [
  { id: 'manifest', label: 'The problem' },
  { id: 'sample-report', label: 'Sample report' },
  { id: 'reputation-guard', label: 'Reputation Guard' },
  { id: 'monetize', label: 'Make money' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
];

const Landing = () => {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [pricingAudience, setPricingAudience] = useState<'individual' | 'team'>('individual');

  return (
    <div className="min-h-screen bg-background font-landing relative">
      {/* Engagement hooks: a top progress bar (orientation — how much is
          left) and a floating "Compare my brand" pill that appears once
          scrolled past the hero and scrolls back UP to the scan input
          rather than navigating away, so a reader who scrolled past the
          first CTA without acting always has the same one back within
          reach. */}
      <ScrollProgressBar />
      <StickyCtaPill />
      <div className="relative z-10">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
      <Navbar showThemeToggle landingCta />
      <SectionNav sections={NAV_SECTIONS} />

      <main id="main-content">
      {/* ── Hero + Why (shared animated background) ───────────────── */}
        <section
          className="hero relative min-h-screen flex items-center pt-24 sm:pt-28 pb-10 px-4 overflow-hidden"
        >
          <div className="relative w-full max-w-6xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* One-off indigo accent on this eyebrow only — not the shared
                  .badge class other tags on this page use, which is
                  deliberately neutral (see CLAUDE.md's Brand palette note on
                  not casually re-adding indigo to background/wash chrome).
                  This is the "new category, pay attention" moment, same
                  spirit as .ai-presence-accent below. */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full mb-5 font-medium border border-primary/20 bg-primary/5 text-primary">
                <ShieldCheck className="w-3 h-3" /> Autonomous AI visibility &amp; reputation management
              </span>
              <h1
                aria-label="Are ChatGPT and Claude hiding your company from customers? Check your AI Visibility Score before your competitors do."
                className="hero-headline max-w-5xl mx-auto text-[1.875rem] sm:text-4xl lg:text-[2.75rem] text-zinc-900 dark:text-zinc-50 mb-5 leading-[1.18] tracking-tight text-balance"
              >
                Are ChatGPT and Claude hiding your company from customers?
                <span className="mt-2 block">
                  Check your{' '}
                  <span className="ai-presence-accent" data-text="AI Visibility Score">
                    <span className="ai-presence-accent-text">AI Visibility Score</span>
                  </span>{' '}before your competitors do.
                </span>
              </h1>
              <p className="text-base sm:text-lg leading-relaxed text-muted-foreground max-w-2xl mx-auto mb-4">
                Built for SEO teams and digital agencies. Presora continuously monitors how leading AI models
                describe and recommend your brand, detects evidence-backed risks, and turns every issue into a prioritized action plan.
              </p>
            </motion.div>

            <motion.div
              id="hero-input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-full max-w-6xl mx-auto"
            >
              <HeroProofMockup />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="mx-auto mt-8 max-w-4xl text-center"
              >
                <h3 className="text-lg font-display text-foreground mb-1">Protection that keeps working after the first scan</h3>
                <p className="text-sm text-muted-foreground mb-5">
                  Monitor → detect → explain → recover. You stay in control while Presora keeps watch.
                </p>
                <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
                  {GROWTH_LOOP.map(({ Icon, step, desc }, index) => (
                    <div
                      key={step}
                      className="rounded-xl border border-[hsl(var(--glass-border))] bg-card/50 p-4"
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="font-data text-[10px] uppercase tracking-wider text-muted-foreground">0{index + 1}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{step}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-4"
            >
              <button
                onClick={() => document.getElementById('sample-report')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-sm text-primary hover:underline inline-flex items-center gap-1.5"
              >
                See your first evidence-backed report <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {/* Risk reversal, at the point of decision. These three used to
                  live only in the closing CTA at the very bottom of the page —
                  i.e. after the visitor had already decided. */}
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-5 text-xs text-muted-foreground">
                {[
                  { icon: Zap, label: 'Free — no credit card' },
                  { icon: ShieldCheck, label: '14-day money-back guarantee' },
                  { icon: Clock, label: 'Cancel anytime, one click' },
                ].map((g) => (
                  <span key={g.label} className="inline-flex items-center gap-1.5">
                    <g.icon className="w-3.5 h-3.5 text-primary" />
                    {g.label}
                  </span>
                ))}
              </div>
            </motion.div>

          </div>
        </section>

        {/* ── Problem: the question agencies can't answer yet ───────── */}
        <section id="manifest" className="py-20 px-4 scroll-mt-28">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-3 py-1 text-xs badge rounded-lg mb-5 font-data uppercase tracking-wider">
                The 2026 problem
              </span>
              <h2 className="text-3xl sm:text-4xl font-display text-foreground leading-[1.15] mb-4">
                Every client meeting now includes a question your stack can't answer.<br />
                <span className="text-primary">"Why does AI recommend them instead of us?"</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
                Rank trackers, backlink tools and social dashboards were built for a search page
                that shows ten results. AI gives buyers a short list. Presora shows which competitors
                make that list, the signals that put them there, and the actions most likely to close the gap.
              </p>
              <button
                onClick={() => document.getElementById('hero-input')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Compare a brand with its competitors
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        </section>


        {/* ── Sample report: what you get after a scan ──────────────── */}
        <section id="sample-report" className="py-20 px-4 scroll-mt-28">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-10"
            >
              <span className="inline-block px-3 py-1 text-xs badge rounded-lg mb-4 font-data uppercase tracking-wider">
                What you get
              </span>
              <h2 className="text-3xl sm:text-4xl font-display text-foreground mb-3">
                From score to reason to next move
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                See who gets recommended, why they are ahead across five decision signals, and the highest-impact action to take next.
              </p>
            </motion.div>

            <ScanResultPreview />
          </div>
        </section>


      {/* ── Reputation Guard: from a report to continuous protection ─ */}
      <section id="reputation-guard" className="py-24 px-4 border-t border-[hsl(var(--glass-border))] scroll-mt-28">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs badge rounded-lg mb-4 font-data uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3" /> Reputation Guard
            </span>
            <h2 className="text-3xl sm:text-4xl font-display text-foreground mb-3">
              From one-off reports to<br />
              <span className="text-primary">continuous reputation protection.</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
              Set the monitoring schedule once. Presora watches for meaningful changes, shows the evidence behind every incident,
              and gives your team a recovery plan to approve and verify.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                Icon: Repeat,
                label: 'Autonomous monitoring',
                title: 'Keep watch without another manual audit',
                desc: 'Scheduled scans track visibility, accuracy and sentiment across the AI models that shape buying decisions.',
              },
              {
                Icon: ShieldCheck,
                label: 'Evidence-backed incidents',
                title: 'Know what changed — and why it matters',
                desc: 'Presora surfaces score drops, weak accuracy and uncertain model answers with the exact signals behind each alert.',
              },
              {
                Icon: PenLine,
                label: 'Human-approved recovery',
                title: 'Fix the highest-impact gap first',
                desc: 'Get a ranked action plan, resolve or ignore each incident, and re-scan to prove whether your changes worked.',
              },
            ].map(({ Icon, label, title, desc }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card p-7"
              >
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mb-2 font-data text-[10px] uppercase tracking-wider text-primary">{label}</p>
                <h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            {['Monitor', 'Detect', 'Explain', 'Act', 'Verify'].map((step, index, steps) => (
              <span key={step} className="inline-flex items-center gap-2">
                <span className="rounded-full border border-[hsl(var(--glass-border))] bg-card/60 px-3 py-1.5 font-medium text-foreground">{step}</span>
                {index < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-primary" />}
              </span>
            ))}
          </div>

          <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
            Presora only creates incidents from real model results. Competitor risk appears when your own score is weak and the measured gap is meaningful — not as manufactured urgency.
          </p>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────── */}
      <section className="py-24 px-4 border-t border-[hsl(var(--glass-border))]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-block px-3 py-1 text-xs badge rounded-lg mb-4 font-data uppercase tracking-wider">
              Trust & security
            </span>
            <h2 className="text-3xl sm:text-4xl font-display text-foreground mb-3">
              Built to be trusted with your brand data
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Early-stage product, built security-first. Here's exactly how your data is handled.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TRUST_POINTS.map((t, i) => (
              <motion.div
                key={t.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6, scale: 1.02, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
                whileTap={{ scale: 0.985 }}
                className="rounded-2xl border border-[hsl(var(--glass-border))] p-7 flex flex-col gap-4 bg-card/60 backdrop-blur-xs shadow-lg shadow-primary/5"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl border ${t.iconBg}`}>
                  <t.Icon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{t.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{t.desc}</p>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            <Link to="/status" className="hover:text-foreground transition-colors underline underline-offset-2">Live system status</Link>
            {' · '}
            <Link to="/polityka-prywatnosci" className="hover:text-foreground transition-colors underline underline-offset-2">Privacy policy</Link>
          </p>
        </div>
      </section>

      {/* ── Monetize: features translated into agency revenue ─────────
          B2B value prop — every card names a feature that already ships
          (white-label PDF export, Competitor Tracker, the scan itself) and
          states the concrete way it turns into billable work or renewal
          ammunition. No invented "agencies save X hours" average — there's
          no customer base yet to derive one from (same reasoning as
          AgencyRoiCalculator on /agencies, which stays the place for an
          agency to run its own numbers interactively). */}
      <section id="monetize" className="py-24 px-4 border-t border-[hsl(var(--glass-border))] scroll-mt-28">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs badge rounded-lg mb-4 font-data uppercase tracking-wider">
              <Wallet className="w-3 h-3" /> Built to be sold
            </span>
            <h2 className="text-3xl sm:text-4xl font-display text-foreground mb-3">
              Three ways this pays for itself
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Not features for their own sake — each one maps to a specific way it turns
              into billable work.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                Icon: Mail,
                title: 'A sharper, faster pitch',
                desc: 'Attach a prospect\'s own AI visibility score to your first outreach email instead of a generic capabilities deck — it\'s a reason to reply about their problem, not your services.',
              },
              {
                Icon: PenLine,
                title: 'A new line item, not new overhead',
                desc: 'Brand the audit as your own (Agency plan) and hand it over as a discovery deliverable. The report is generated in seconds, so there\'s no production time to bill against.',
              },
              {
                Icon: Repeat,
                title: 'A reason to check in every month',
                desc: 'Competitor Tracker re-runs a real, freshly-measured benchmark on a schedule, so a renewal conversation has an actual number behind it instead of "everything\'s fine."',
              },
            ].map(({ Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-[hsl(var(--glass-border))] bg-card/60 p-6"
              >
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────
          The landing page had no pricing at all — a visitor had to guess
          whether the product even had plans. Cards come from @/lib/plans so
          these prices can't drift from /pricing or from Stripe checkout.
          Every CTA goes to /register: nobody is signed in here, and the
          checkout on /pricing requires a session anyway. */}
      <section id="pricing" className="bg-card/20 py-24 px-4 border-t border-[hsl(var(--glass-border))] scroll-mt-28">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-4"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs badge rounded-lg mb-4 font-data uppercase tracking-wider">
              <Tag className="w-3 h-3" /> Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-display text-foreground">
              Simple, transparent pricing
            </h2>
            <p className="text-muted-foreground text-sm mt-3 max-w-lg mx-auto">
              Start free — three audits, no card required. Upgrade to Agency when you're
              ready to brand reports as your own and track more clients at once.
            </p>
          </motion.div>

          <div className="mb-10 flex justify-center">
            <div className="inline-flex items-center rounded-2xl border-2 border-border bg-card p-1.5 shadow-xs">
              <button
                type="button"
                onClick={() => setPricingAudience('individual')}
                className={`inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors ${pricingAudience === 'individual' ? 'border-primary bg-primary text-primary-foreground shadow-xs' : 'border-transparent bg-transparent text-foreground hover:border-border hover:bg-muted'}`}
                aria-pressed={pricingAudience === 'individual'}
              >
                <UserRound className="h-4 w-4" /> Individual
              </button>
              <button
                type="button"
                onClick={() => setPricingAudience('team')}
                className={`inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors ${pricingAudience === 'team' ? 'border-primary bg-primary text-primary-foreground shadow-xs' : 'border-transparent bg-transparent text-foreground hover:border-border hover:bg-muted'}`}
                aria-pressed={pricingAudience === 'team'}
              >
                <UsersRound className="h-4 w-4" /> Team &amp; Enterprise
              </button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <PricingCards
              plans={pricingAudience === 'individual'
                ? PLANS.filter((plan) => ['free', 'starter', 'solo'].includes(plan.id))
                : PLANS.filter((plan) => ['starter', 'growth', 'enterprise'].includes(plan.id))}
              billingCycle={billingCycle}
              onCycleChange={setBillingCycle}
              onPlanSelect={(planId, _cycle, creditCode) => {
                const params = new URLSearchParams({ plan: planId });
                if (creditCode) params.set('credit_code', creditCode);
                navigate(`/register?${params.toString()}`);
              }}
              showBillingToggle
              className="[&_.rounded-2xl]:border-border [&_.rounded-2xl]:bg-card [&_.rounded-2xl]:shadow-none [&_.rounded-2xl:hover]:shadow-none [&_.pricing-card-muted]:bg-card/70"
            />
          </motion.div>

          {/* Fear-removal + direct CTA for the reader actually deciding on
              Agency — the price alone doesn't answer "what if this doesn't
              work for my clients," so this names the actual, no-risk way to
              find out before committing to $199/mo. */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-8 max-w-2xl mx-auto rounded-2xl border border-primary/25 bg-primary/4 p-6 text-center"
          >
            <p className="text-sm font-semibold text-foreground mb-1.5">Running an agency?</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Start on the Free plan and brand your very first audit today — no contract,
              no sales call, cancel anytime. Move to Agency ($199/mo) only once you're
              already sending client-ready reports and it's paying for itself.
            </p>
            <Link
              to="/agencies"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              See exactly what agencies get <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Cancel anytime, no contracts.{' '}
            <Link to="/pricing" className="text-primary underline underline-offset-2">
              Compare every plan in detail
            </Link>
          </p>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-28 pt-20 pb-12 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs badge rounded-lg mb-4 font-data uppercase tracking-wider">
              <HelpCircle className="w-3 h-3" /> FAQ
            </span>
            <h2 className="text-3xl sm:text-4xl font-display text-foreground">
              Frequently asked questions
            </h2>
            <p className="text-muted-foreground text-sm mt-3 max-w-lg mx-auto">
              Everything you need to know before your first scan.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-[hsl(var(--glass-border))] bg-card/40 backdrop-blur-xl divide-y divide-[hsl(var(--glass-border))] overflow-hidden"
          >
            <Accordion type="single" collapsible className="w-full">
              {FAQ_EN.map((item, idx) => (
                <AccordionItem
                  key={idx}
                  value={`q${idx + 1}`}
                  className="border-0 border-b border-[hsl(var(--glass-border))] last:border-b-0 px-6"
                >
                  <AccordionTrigger className="text-left text-sm sm:text-base font-medium text-foreground hover:no-underline py-5 [&>svg]:text-primary">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5 pr-6">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm text-foreground font-medium">Still have questions?</p>
            </div>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Contact us
              <Mail className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Newsletter ────────────────────────────────────────────── */}
      <section className="pt-4 pb-14 px-4">
        <div className="max-w-xl mx-auto">
          <NewsletterSignup
            onSubmit={async (email) => {
              // fetch() only rejects on a network failure, never on a 4xx/5xx
              // status — without this check, a rate-limited or failed signup
              // (server logs it, nothing gets saved) still showed the success
              // state + confetti to the visitor.
              const res = await fetch('/.netlify/functions/newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `HTTP ${res.status}`);
              }
            }}
          />
        </div>
      </section>
      </main>

      <Footer />

      <CookiePanel privacyHref="/polityka-prywatnosci" termsHref="/regulamin" />
      <SalesChatWidget />
      </div>
    </div>
  );
};

export default Landing;
