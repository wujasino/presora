import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, Shield, HelpCircle, ShieldCheck, PenLine, Tag, Repeat, UserRound, UsersRound } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HeroProofMockup } from '@/components/HeroProofMockup';
import { SectionNav } from '@/components/SectionNav';
import { ScanResultPreview } from '@/components/ScanResultPreview';
import { CookiePanel } from '@/components/ui/cookie-banner-1';
import { SalesChatWidget } from '@/components/ui/sales-chat-widget';
import { ScrollProgressBar } from '@/components/ui/scroll-progress-bar';
import { StickyCtaPill } from '@/components/ui/sticky-cta-pill';
import { FAQ_EN } from '@/lib/faq';
import { PricingCards } from '@/components/ui/pricing-cards';
import { PLANS } from '@/lib/plans';

/* ── Trust points ─────────────────────────────────────────────────── */
/* Verifiable facts about how the product actually works — not customer
   quotes. Presora doesn't have public case studies yet, and inventing
   testimonials to fill the space would be dishonest, so this trades a
   "social proof" slot for a "how this actually works" one instead. */
const TRUST_POINTS = [
  {
    Icon: Shield,
    title: 'Your data is walled off from everyone else\'s',
    desc: 'Account data is separated at the database level.',
    iconBg: 'bg-indigo-400/10 border-indigo-400/20 text-indigo-400',
  },
  {
    Icon: Eye,
    title: 'Your data isn\'t used to train models',
    desc: 'Brand context is used only to produce your result.',
    iconBg: 'bg-primary/10 border-primary/20 text-primary',
  },
  {
    Icon: ShieldCheck,
    title: 'Full control over your data',
    desc: 'Download or permanently delete it from Settings.',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
  },
];

/* Sections offered in the sticky in-page nav, in page order. */
const NAV_SECTIONS = [
  { id: 'sample-report', label: 'Sample report' },
  { id: 'reputation-guard', label: 'Reputation Guard' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
];

const HOME_FAQ = [FAQ_EN[0], FAQ_EN[4], FAQ_EN[5], FAQ_EN[7], FAQ_EN[9], FAQ_EN[10]];

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
      {/* ── Hero ──────────────────────────────────────────────────── */}
        <section
          className="hero relative flex items-center pt-24 sm:pt-28 pb-16 px-4 overflow-hidden"
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
            </motion.div>
          </div>
        </section>


        {/* ── Sample report: what you get after a scan ──────────────── */}
        <section id="sample-report" className="py-16 px-4 scroll-mt-28">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-8"
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
      <section id="reputation-guard" className="py-16 px-4 border-t border-[hsl(var(--glass-border))] scroll-mt-28">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs badge rounded-lg mb-4 font-data uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3" /> Reputation Guard
            </span>
            <h2 className="text-3xl sm:text-4xl font-display text-foreground mb-3">
              From one-off reports to<br />
              <span className="text-primary">continuous reputation protection.</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
              Presora watches for meaningful changes, shows the evidence, and gives your team a recovery plan to approve and verify.
              Only real model results create incidents.
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

        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────── */}
      <section className="py-12 px-4 border-t border-[hsl(var(--glass-border))]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-2xl sm:text-3xl font-display text-foreground">
              Your brand data stays yours
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TRUST_POINTS.map((t, i) => (
              <motion.div
                key={t.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-[hsl(var(--glass-border))] p-5 flex gap-4 bg-card/60"
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-xl border ${t.iconBg}`}>
                  <t.Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            <Link to="/status" className="hover:text-foreground transition-colors underline underline-offset-2">Live system status</Link>
            {' · '}
            <Link to="/polityka-prywatnosci" className="hover:text-foreground transition-colors underline underline-offset-2">Privacy policy</Link>
          </p>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────
          The landing page had no pricing at all — a visitor had to guess
          whether the product even had plans. Cards come from @/lib/plans so
          these prices can't drift from /pricing or from Stripe checkout.
          Every CTA goes to /register: nobody is signed in here, and the
          checkout on /pricing requires a session anyway. */}
      <section id="pricing" className="bg-card/20 py-16 px-4 border-t border-[hsl(var(--glass-border))] scroll-mt-28">
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

          <p className="text-center text-xs text-muted-foreground mt-6">
            Cancel anytime.{' '}
            <Link to="/pricing" className="text-primary underline underline-offset-2">
              Compare every plan in detail
            </Link>
          </p>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-28 py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
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
              {HOME_FAQ.map((item, idx) => (
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

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Still have questions? <Link to="/contact" className="text-primary hover:underline">Contact us</Link>.
          </p>
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
