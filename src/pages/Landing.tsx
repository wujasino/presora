import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Zap, Eye, Shield, ChevronDown, HelpCircle, Mail, ArrowRight, Globe, ShieldCheck, Clock, PenLine, Sparkles, MessageSquare, Tag, Wallet, Repeat } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { GuestScanWidget } from '@/components/GuestScanWidget';
import { ScrollAuditDemo } from '@/components/ScrollAuditDemo';
import { SectionNav } from '@/components/SectionNav';
import { GUEST_LIMIT } from '@/hooks/useBrewing';
import { ScanResultPreview } from '@/components/ScanResultPreview';
import { CookiePanel } from '@/components/ui/cookie-banner-1';
import { SalesChatWidget } from '@/components/ui/sales-chat-widget';
import { NewsletterSignup } from '@/components/ui/newsletter-signup';
import { GradientMeshBg } from '@/components/ui/gradient-mesh-bg';
import { MouseSpotlight } from '@/components/ui/mouse-spotlight';
import { ScrollProgressBar } from '@/components/ui/scroll-progress-bar';
import { StickyCtaPill } from '@/components/ui/sticky-cta-pill';
import { FAQ_EN } from '@/lib/faq';
import { PricingCards } from '@/components/ui/pricing-cards';
import { PLANS } from '@/lib/plans';

/* ── AI models actually queried ────────────────────────────────────
   Mirrors OPENROUTER_MODELS in netlify/functions/_lib/runScan.js — these
   are the six models a scan really hits, in tier order.

   This block used to list Slack, HubSpot, Zapier, Google Analytics, Semrush
   and Notion under the heading "Powered by leading AI models". None of them
   are AI models, and none of them are integrations that exist: nothing in
   netlify/functions talks to any of those services. Promising integrations
   that aren't built is the most expensive kind of copy to be caught on, so
   the logos are gone rather than relabelled. */
const AI_MODELS = [
  { name: 'ChatGPT (GPT-4o)', vendor: 'OpenAI', color: '#10a37f', tier: 'All plans' },
  { name: 'Claude', vendor: 'Anthropic', color: '#d97757', tier: 'Starter and up' },
  { name: 'Gemini', vendor: 'Google', color: '#4285f4', tier: 'Starter and up' },
  { name: 'Perplexity', vendor: 'Perplexity AI', color: '#20808d', tier: 'Business' },
  { name: 'Mistral', vendor: 'Mistral AI', color: '#ff7000', tier: 'Business' },
  { name: 'Llama 3', vendor: 'Meta', color: '#0866ff', tier: 'Business' },
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

/* Sections offered in the sticky in-page nav, in page order. Keep in sync
   with the matching `id` on each <section>; SectionNav skips any id that
   isn't on the page, so a stale entry degrades quietly rather than breaking. */
const NAV_SECTIONS = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'manifest', label: 'The problem' },
  { id: 'sample-report', label: 'Sample report' },
  { id: 'monetize', label: 'Make money' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
];

const Landing = () => {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  // Background drifts slower than the page scrolls (classic parallax), and
  // fades out before the next section — subtle enough to still respect
  // prefers-reduced-motion in spirit (pure transform + opacity, no layout
  // shift either way).
  const heroBgY = useTransform(heroScrollProgress, [0, 1], ['0%', '25%']);
  const heroBgOpacity = useTransform(heroScrollProgress, [0, 1], [0.45, 0]);

  return (
    <div className="min-h-screen bg-background font-landing relative">
      {/* Cursor-follow glow — fixed + z-0, so it always paints behind the
          z-10 content wrapper below regardless of DOM order. */}
      <MouseSpotlight />
      {/* Engagement hooks: a top progress bar (orientation — how much is
          left) and a floating "Check my brand" pill that appears once
          scrolled past the hero and scrolls back UP to the scan input
          rather than navigating away, so a reader who scrolled past the
          first CTA without acting always has the same one back within
          reach. */}
      <ScrollProgressBar />
      <StickyCtaPill />
      <div className="relative z-10">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
      <Navbar showThemeToggle landingCta />
      <SectionNav sections={NAV_SECTIONS} />

      <main id="main-content">
      {/* ── Hero + Why (shared animated background) ───────────────── */}
      <GradientMeshBg className="relative" variant="mono">
        <section
          ref={heroRef}
          className="hero relative min-h-screen flex items-center pt-24 sm:pt-32 pb-10 px-4 overflow-hidden"
        >
          {/* Parallax background layer — drifts slower than scroll, fades
              out toward the next section. Built from the same indigo/mono
              orb palette as GradientMeshBg (not a stock photo) so it stays
              inside this app's established abstract-mesh visual language
              instead of introducing off-brand imagery. */}
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{ y: heroBgY, opacity: heroBgOpacity }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse 80% 60% at 50% 20%, hsl(var(--primary) / 0.16), transparent 70%)',
              }}
            />
            {/* Background-to-transparent overlay for depth/legibility, using
                the app's own background token rather than a literal black. */}
            <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
          </motion.div>

          <div className="relative max-w-2xl mx-auto text-center">
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
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full mb-7 font-data uppercase tracking-wider border border-primary/30 bg-primary/10 text-primary">
                <Sparkles className="w-3 h-3" /> New service category: GEO Audits for agencies
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display text-zinc-900 dark:text-zinc-50 mb-5 leading-[1.05] tracking-tight">
                Show clients they're{' '}
                <span className="ai-presence-accent" data-text="invisible on ChatGPT">
                  <span className="ai-presence-accent-text">invisible on ChatGPT</span>
                </span>{' '}
                — then sell them the fix.
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-4">
                AI assistants are replacing search for your clients' buyers, and most agencies
                still have no way to prove it — or bill for fixing it. Presora runs a live,
                white-labelable visibility audit across 6 AI models in about 15 seconds.
              </p>
              <p className="text-sm text-foreground/70 max-w-xl mx-auto mb-10">
                The only AI visibility audit built to be{' '}
                <span className="text-foreground font-medium">handed to a client, not just kept on your own dashboard.</span>
              </p>
            </motion.div>

            <motion.div
              id="hero-input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-xl mx-auto"
            >
              {/* Runs a real scan inline instead of navigating to
                  /brand-visibility — full data is fetched immediately, but
                  4 of 5 dimensions (and the aggregate score) stay blurred
                  until an email unlocks them. Real result, gated display —
                  not a fabricated teaser number. */}
              <GuestScanWidget />
              <p className="mt-3 text-xs text-center text-muted-foreground">
                Result in ~15 seconds &middot; {GUEST_LIMIT} free scans to start &middot; No credit card required
              </p>
              {/* Reuses the same AI_MODELS array as the full "AI models we
                  query" section further down — one source of the model
                  list, shown in two places, so this can't silently drift
                  out of sync with what runScan.js actually queries (see
                  CLAUDE.md's note on model tiering needing to agree
                  everywhere it's stated). */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground/70">
                <span className="uppercase tracking-widest">Live analysis across</span>
                {AI_MODELS.map((m) => (
                  <span key={m.name} className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    {m.name.split(' ')[0]}
                  </span>
                ))}
              </div>
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
                Or see a sample report first <ArrowRight className="w-3.5 h-3.5" />
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

            {/* scroll hint */}
            <motion.button
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              className="mt-8 mx-auto flex flex-col items-center gap-1.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <span className="text-[10px] uppercase tracking-[0.25em]">Learn more</span>
              <motion.div animate={{ y: [0, 4, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </motion.button>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────── */}
        <section id="how-it-works" className="pb-20 px-4 scroll-mt-28">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-center text-sm text-muted-foreground mb-5 sm:mb-6">How it works</h2>
            {/* Scroll-scrubbed: the three steps light up and the scan bar
                fills from the reader's own scroll position, so the ~15s
                audit is shown running rather than just described, and the
                three explanations arrive one at a time instead of as one
                block. Falls back to a fully-revealed static state under
                prefers-reduced-motion. */}
            <ScrollAuditDemo />

            {/* ── Trust bar — real product facts, not invented usage stats ── */}
            <div className="mt-10 sm:mt-14 flex flex-col sm:flex-row items-center justify-center gap-x-8 gap-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground leading-tight">Up to 6 AI models</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">ChatGPT, Claude &amp; Gemini — plus 3 more on Business</div>
                </div>
              </div>

              <div className="hidden sm:block w-px h-9 bg-[hsl(var(--glass-border))]" />

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground leading-tight">~15 seconds</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">to get your AI visibility score</div>
                </div>
              </div>
            </div>

            {/* ── Proof teaser: shows the actual output, not just a promise ── */}
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              onClick={() => document.getElementById('sample-report')?.scrollIntoView({ behavior: 'smooth' })}
              className="group mt-8 mx-auto flex items-center gap-3 sm:gap-4 rounded-2xl border border-[hsl(var(--glass-border))] bg-card/60 backdrop-blur-xl px-4 py-3 sm:px-5 sm:py-3.5 shadow-sm hover:border-primary/40 hover:bg-card/80 transition-colors text-left"
            >
              <span className="shrink-0 inline-flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-base sm:text-lg font-display font-semibold text-emerald-600 dark:text-emerald-400 leading-none">78</span>
                <span className="text-[8px] uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70 leading-none mt-0.5">/100</span>
              </span>
              <span className="min-w-0">
                <span className="block text-xs sm:text-sm font-medium text-foreground">
                  Sample: Tesla scored 78 — recommended by ChatGPT &amp; Claude
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-primary group-hover:gap-1.5 transition-all mt-0.5">
                  See the full report <ArrowRight className="w-3 h-3" />
                </span>
              </span>
            </motion.button>
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
                <span className="text-primary">"Are we even visible on ChatGPT?"</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
                Rank trackers, backlink tools and social dashboards were built for a search page
                that shows ten results. AI shows one answer — and for a growing share of buyers,
                that's the only answer they ever see. Without a real audit, you're guessing
                alongside your client instead of leading them.
              </p>
              <button
                onClick={() => document.getElementById('hero-input')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Run a free audit on a prospect
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
                Your report, seconds after scanning
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                One visibility score, a breakdown across five signals, how each AI model talks about you, and the single highest-impact action to take next.
              </p>
            </motion.div>

            <ScanResultPreview />
          </div>
        </section>

      </GradientMeshBg>

      {/* ── Action, not just a report ─────────────────────────────── */}
      <section className="py-24 px-4 border-t border-[hsl(var(--glass-border))]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs badge rounded-lg mb-4 font-data uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> Action, not just a report
            </span>
            <h2 className="text-3xl sm:text-4xl font-display text-foreground mb-3">
              Know you're invisible? That's step one.<br />
              <span className="text-primary">Here's what to publish next.</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Every scan ends with a ranked, plain-English action plan: the specific pages, comparisons and mentions that move AI models to recommend you.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Left: the problem framed simply */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass-card p-8 flex flex-col justify-center gap-5"
            >
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4 text-primary" />
                A customer asks AI:
              </div>
              <p className="text-xl font-display text-foreground leading-snug">
                “What are the best {' '}
                <span className="text-primary">project management tools</span>{' '}
                for small teams?”
              </p>
              <div className="rounded-xl border border-[hsl(var(--glass-border))] bg-muted/20 p-4 text-sm text-muted-foreground leading-relaxed">
                AI names 5 competitors. Your brand isn't one of them.
                <span className="block mt-2 text-foreground/80">Presora finds out <span className="text-primary font-medium">why</span>, and hands you the fix.</span>
              </div>
            </motion.div>

            {/* Right: the auto-generated action plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="glass-card p-8 flex flex-col gap-4 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-data uppercase tracking-wider text-muted-foreground">Your action plan</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary border border-primary/20">Auto-generated</span>
              </div>
              {[
                { icon: PenLine, impact: 'High impact', title: 'Publish a comparison page', desc: 'Create a “vs. alternatives” page — AI models cite these when recommending tools.' },
                { icon: Globe, impact: 'High impact', title: 'Get listed in 3 category roundups', desc: 'You’re missing from the “best-of” articles AI reads. We name which ones.' },
                { icon: MessageSquare, impact: 'Medium', title: 'Seed 2 review mentions', desc: 'Reddit & G2 threads shape how AI describes your reliability.' },
              ].map((a, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-[hsl(var(--glass-border))] bg-card/40 p-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <a.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-foreground">{a.title}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-primary/10 text-primary/80 shrink-0">{a.impact}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{a.desc}</p>
                  </div>
                </div>
              ))}
              <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Integrations ──────────────────────────────────────────── */}
      <section className="py-16 px-4 border-t border-[hsl(var(--glass-border))]">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-lg font-display text-foreground mb-1">The AI models we query</h3>
            <p className="text-sm text-muted-foreground mb-8">
              Every scan asks these models the same questions about your brand, at the same time.
              Free covers ChatGPT; Starter and Solo add Claude and Gemini; Business unlocks all six.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            {AI_MODELS.map((m) => (
              <div
                key={m.name}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-[hsl(var(--glass-border))] bg-card/50 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: m.color }}
                />
                <span className="text-foreground">{m.name}</span>
                <span className="text-[11px] text-muted-foreground/60">{m.tier}</span>
              </div>
            ))}
          </motion.div>
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
                className="rounded-2xl border border-[hsl(var(--glass-border))] p-7 flex flex-col gap-4 bg-card/60 backdrop-blur-sm shadow-lg shadow-primary/5"
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

      {/* ── CTA box ───────────────────────────────────────────────── */}
      <section className="py-20 px-4 cta-box">
        <div className="max-w-2xl mx-auto text-center glass-card p-12">
          <h2 className="text-2xl font-display text-foreground mb-3">Run your first client audit</h2>
          <p className="text-muted-foreground text-sm mb-8">Scan a prospect's brand today — free, no card required.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => document.getElementById('hero-input')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Start for free
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground/50 mt-4">No credit card required</p>

          {/* Risk-reversal guarantees */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-xs text-muted-foreground">
            {[
              { icon: ShieldCheck, label: '14-day money-back guarantee' },
              { icon: Clock, label: 'Cancel anytime, one click' },
              { icon: Zap, label: 'Results in under 15 seconds' },
            ].map((g) => (
              <span key={g.label} className="inline-flex items-center gap-1.5">
                <g.icon className="w-3.5 h-3.5 text-primary" />
                {g.label}
              </span>
            ))}
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-8 pt-8 border-t border-[hsl(var(--glass-border))]">
            {[
              { icon: '🔒', label: 'SSL / TLS', sub: 'Encrypted connection' },
              { icon: '🇪🇺', label: 'GDPR Ready', sub: 'EU-compliant data' },
              { icon: '💳', label: 'Secure payments', sub: 'SSL-encrypted checkout' },
              { icon: '🔐', label: '2FA', sub: 'Account protection' },
            ].map(badge => (
              <div key={badge.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-[hsl(var(--glass-border))] bg-card/40">
                <span className="text-lg">{badge.icon}</span>
                <div className="text-left">
                  <p className="text-xs font-semibold text-foreground">{badge.label}</p>
                  <p className="text-[10px] text-muted-foreground">{badge.sub}</p>
                </div>
              </div>
            ))}
          </div>
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
      <section id="pricing" className="py-24 px-4 border-t border-[hsl(var(--glass-border))] scroll-mt-28">
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

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <PricingCards
              plans={PLANS}
              billingCycle={billingCycle}
              onCycleChange={setBillingCycle}
              onPlanSelect={() => navigate('/register')}
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
            className="mt-8 max-w-2xl mx-auto rounded-2xl border border-primary/25 bg-primary/[0.04] p-6 text-center"
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
