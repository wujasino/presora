import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Presentation, ArrowRight, Sparkles, FileText, CheckCircle2,
  Building2, Printer, Mail, ShieldCheck, ClipboardList,
  EyeOff, Wallet, Repeat, Play,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { AgencyRoiCalculator } from '@/components/agencies/AgencyRoiCalculator';

const STEPS = [
  {
    Icon: ClipboardList,
    title: '1. Run the scan',
    desc: 'Enter a prospect\'s brand name. Presora queries GPT-4o, Claude and Gemini in parallel and scores the result across 5 dimensions in about 15 seconds.',
  },
  {
    Icon: Sparkles,
    title: '2. AI writes the narrative',
    desc: 'An executive summary, competitive read and prioritized recommendations get generated automatically — no report-writing required on your end.',
  },
  {
    Icon: Printer,
    title: '3. Brand it and send',
    desc: 'Set your logo and contact details once under Tools → Audit Branding — every audit carries them from then on. Print to PDF and attach it to your outreach email, or the proposal you\'re already sending.',
  },
];

const INCLUDED = [
  'Your logo, name and contact details on it — not ours',
  'Headline AI visibility score (0–100) with executive summary',
  'Business-impact narrative — why the score matters to their revenue',
  '5-dimension breakdown: authority, sentiment, accuracy, mentions, recency',
  'What each AI model actually associates the brand with, quoted',
  'Prioritized, ranked recommendations — the specific fixes to pitch',
  'A methodology section that answers "where does this number come from?"',
  'Clean, print-ready PDF layout — no watermarked screenshots',
];

const Agencies = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="pt-28 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs badge rounded-lg mb-6 uppercase tracking-wider">
                <Building2 className="w-3 h-3" /> For agencies & consultants
              </span>
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-5 leading-[1.1] text-balance">
                Generate the GEO audit that opens{' '}
                <span className="text-primary">your client's next budget</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-4 leading-relaxed">
                Run a Presora scan on a prospect's brand, and it generates a client-ready
                AI visibility audit — the kind of report that sells the follow-up work itself.
              </p>
              <p className="text-base text-foreground max-w-xl mx-auto mb-10 leading-relaxed">
                <strong className="font-semibold">Export it as a PDF with your agency's own logo</strong> —
                not ours, and not a screenshot.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/register')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Generate your first free client audit
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => document.getElementById('sample')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-accent transition-colors"
                >
                  See a sample audit
                </button>
              </div>
              <p className="text-xs text-muted-foreground/70 mt-4">
                Scanning is free, no card required. Exporting the client-ready PDF audit
                needs the{' '}
                <Link to="/pricing" className="text-primary hover:underline">Agency plan</Link>.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────────── */}
        <section className="py-16 px-4 border-t border-border">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-block px-3 py-1 text-xs badge rounded-lg mb-4 uppercase tracking-wider">
                How it works
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">From scan to sent proposal</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {STEPS.map(({ Icon, title, desc }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-2xl border border-border bg-card/60 p-6"
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

        {/* ── Sample audit preview ────────────────────────────────── */}
        <section id="sample" className="py-16 px-4 border-t border-border scroll-mt-20">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block px-3 py-1 text-xs badge rounded-lg mb-4 uppercase tracking-wider">
                What you hand the prospect
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">A report that argues its own case</h2>
              <p className="text-sm text-muted-foreground mt-3 max-w-lg mx-auto">
                Not a dashboard screenshot. A standalone, printable document built to be read by
                someone who has never seen Presora.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-border bg-card/60 p-6 sm:p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-semibold text-foreground">Nike — AI Visibility Audit</span>
                <span className="text-xs text-muted-foreground">Generated by Presora</span>
              </div>
              <div className="flex items-center gap-6 mb-6 pb-6 border-b border-border">
                <div className="text-5xl font-bold text-primary tabular-nums">62</div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">AI visibility score / 100</p>
                  <p className="text-sm font-medium text-foreground mt-1">
                    Nike AI visibility is developing — there's a closeable gap
                  </p>
                </div>
              </div>
              <div className="space-y-2 mb-6">
                {[
                  { name: 'Authority', v: 70 }, { name: 'Sentiment', v: 55 },
                  { name: 'Accuracy', v: 65 }, { name: 'Mentions', v: 80 }, { name: 'Recency', v: 40 },
                ].map(d => (
                  <div key={d.name} className="flex items-center gap-3 text-xs">
                    <span className="w-20 text-muted-foreground shrink-0">{d.name}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${d.v}%` }} />
                    </div>
                    <span className="w-7 text-right text-foreground font-medium">{d.v}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-500">high priority</span>
                  <span className="text-sm font-semibold text-foreground">Refresh recency signals</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Publish recent, citable content so models have current material to draw from.
                </p>
              </div>
            </motion.div>
            <p className="text-center text-xs text-muted-foreground/60 mt-4">
              Illustrative preview — every field is generated live from the actual scan.
            </p>
          </div>
        </section>

        {/* ── White-label ─────────────────────────────────────────────
            The single strongest argument for an agency, and it was
            previously buried as step 3 plus one bullet in the list below.
            Everything claimed here already ships: profiles.agency_{name,
            logo_url,contact_email,website} drive the letterhead, the
            "Prepared by" line and the closing CTA, edited at
            /audit-branding and read by useAuditBranding.ts. */}
        <section className="py-16 px-4 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block px-3 py-1 text-xs badge rounded-lg mb-4 uppercase tracking-wider">
                White-label
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                Your logo on it. Your name on it. <span className="text-primary">Not ours.</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto leading-relaxed">
                Set your agency's branding once and every audit you export carries it.
                The client who opens that PDF sees your firm — there is no Presora
                logo, no footer credit, and no link back to us anywhere on the page.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              {[
                {
                  Icon: EyeOff,
                  title: 'Presora stays invisible',
                  desc: 'No watermark, no "powered by", no mention in the document your client reads or forwards.',
                },
                {
                  Icon: Mail,
                  title: 'Replies come back to you',
                  desc: 'The closing "get in touch" block carries your email and website, so a forwarded PDF sends their client to your inbox — not ours.',
                },
                {
                  Icon: Repeat,
                  title: 'Configured once',
                  desc: 'Logo, agency name, contact email and website live under Tools → Audit Branding, and apply to every audit from then on.',
                },
              ].map(({ Icon, title, desc }) => (
                <div key={title} className="rounded-2xl border border-border bg-card/60 p-5">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 mb-3">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1.5">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            {/* Letterhead before/after — the concrete version of the claim */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-card/30 p-5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-3">Without branding set</p>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-sm font-semibold text-muted-foreground">Presora</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">contact.presora@gmail.com</p>
                </div>
                <p className="text-[11px] text-muted-foreground/60 mt-3 leading-relaxed">
                  Your client emails us instead of you.
                </p>
              </div>
              <div className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-5">
                <p className="text-[10px] uppercase tracking-wider text-primary/70 mb-3">With branding set</p>
                <div className="rounded-xl border border-primary/20 bg-background/60 p-4">
                  <p className="text-sm font-semibold text-foreground">Your Agency</p>
                  <p className="text-[11px] text-muted-foreground mt-1">hello@youragency.com</p>
                </div>
                <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                  The audit reads as a deliverable your agency produced.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── What's included ─────────────────────────────────────── */}
        <section className="py-16 px-4 border-t border-border">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block px-3 py-1 text-xs badge rounded-lg mb-4 uppercase tracking-wider">
                What's included
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Every audit includes</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {INCLUDED.map(item => (
                <div key={item} className="flex items-start gap-2.5 rounded-xl border border-border bg-card/40 p-4">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground/90 leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ROI ─────────────────────────────────────────────────────
            Interactive rather than asserted: the agency moves the sliders
            and reads their own arithmetic back. Deliberately not seeded
            with "agencies save X hours on average" — there is no customer
            base to derive such an average from, and quoting one would be
            inventing the exact kind of figure this product exists to
            expose. See AgencyRoiCalculator for the held-back 30%. */}
        <section className="py-16 px-4 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block px-3 py-1 text-xs badge rounded-lg mb-4 uppercase tracking-wider">
                Return on investment
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Does this pay for itself?</h2>
              <p className="text-sm text-muted-foreground mt-3 max-w-lg mx-auto">
                Put your own volume, production time and billable rate in — the maths
                below is yours, not a number we made up.
              </p>
            </div>
            <AgencyRoiCalculator />
          </div>
        </section>

        {/* ── Decision-maker problems ─────────────────────────────────
            Was a persona list ("SEO agencies / consultants / freelancers"),
            which described who the reader IS rather than what they're
            accountable for. The buyer here is an owner, a COO or a head of
            delivery, and each signs off for a different reason. */}
        <section className="py-16 px-4 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block px-3 py-1 text-xs badge rounded-lg mb-4 uppercase tracking-wider">
                Whose problem this solves
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                Three people sign off — for three different reasons
              </h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  Icon: Building2,
                  role: 'Founder / owner',
                  problem: 'Cold outreach gets ignored.',
                  desc: 'An audit of the prospect\'s own brand, attached to the first email, is a reason to reply that a capabilities deck isn\'t. You lead with their problem instead of your services.',
                },
                {
                  Icon: Wallet,
                  role: 'COO / head of ops',
                  problem: 'Pitch work burns unbillable hours.',
                  desc: 'Research and report production for a prospect who may never sign comes straight out of margin. This collapses that step to a scan and an export.',
                },
                {
                  Icon: Repeat,
                  role: 'Head of delivery',
                  problem: 'Retainers go quiet between campaigns.',
                  desc: 'A re-scan on a schedule gives you a movement to report every month, so the client sees progress in the gaps where there\'s nothing else to show.',
                },
              ].map(({ Icon, role, problem, desc }) => (
                <div key={role} className="rounded-2xl border border-border bg-card/60 p-6">
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1.5">{role}</p>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{problem}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Proof ───────────────────────────────────────────────────
            Where customer case studies would normally sit. Presora has no
            attributable agency results yet, and a fabricated one is a
            fabricated record — so this offers the honest substitute: run
            the thing on a brand the reader already has an opinion about
            and judge the output directly. Replace this section with real,
            named case studies the moment there is a customer willing to
            be quoted. */}
        <section className="py-16 px-4 border-t border-border">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-border bg-card/60 p-8 text-center">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 mb-4">
                <Play className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                We'd rather you tested it than read a testimonial
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto mb-6">
                Presora is early, and we're not going to dress up invented client results
                as proof — you audit brand visibility for a living, so you'd see through it.
                Instead: scan a brand whose reputation you already know well. If what the
                models say about it doesn't match your read of that market, you'll know
                inside a minute and it costs you nothing.
              </p>
              <button
                onClick={() => navigate('/brand-visibility')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Scan a brand you know
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-muted-foreground/60 mt-4">
                No account needed for the first scan.
              </p>
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <section className="py-20 px-4 cta-box">
          <div className="max-w-2xl mx-auto text-center glass-card p-12">
            <Presentation className="w-8 h-8 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-3">Your next audit is one scan away</h2>
            <p className="text-muted-foreground text-sm mb-8">
              Create a free account and run a scan on your next prospect — then upgrade to
              Agency to open it as a client-ready audit from Reports.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Generate a free client audit
                <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-accent transition-colors"
              >
                See Agency plan
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-primary" /> No credit card to start</span>
              {/* Was "Unlimited free scans" — the Free plan is 3 analyses a
                  month (see PLANS in src/lib/plans.ts), so that promise was
                  simply false, and it's the kind an agency discovers on
                  audit four. */}
              <span className="inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-primary" /> 3 free scans a month</span>
            </div>
            <p className="text-xs text-muted-foreground/60 mt-8">
              Questions first? <a href="mailto:contact.presora@gmail.com" className="text-primary hover:underline inline-flex items-center gap-1"><Mail className="w-3 h-3" />contact.presora@gmail.com</a>
              {' · '}
              <Link to="/pricing" className="text-primary hover:underline">See pricing</Link>
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Agencies;
