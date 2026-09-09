import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, AlertTriangle, Clock, Check, ShieldCheck, Percent, Coffee, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PricingCards } from '@/components/ui/pricing-cards';
import { USD, PLANS } from '@/lib/plans';
import { CreditsUsageWidget } from '@/components/CreditsUsageWidget';
import { ContactForm } from '@/components/ui/contact-form';
import { useSessionUser } from '@/hooks/useAccountInfo';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const Pricing = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [loadingCredits, setLoadingCredits] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [showContactSalesDialog, setShowContactSalesDialog] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const { data: sessionUser } = useSessionUser();
  const isLoggedIn = !!sessionUser?.id;

  const prices = USD;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success'))  setMessage('Payment successful! Your plan has been activated.');
    if (params.get('canceled')) setMessage('Payment was cancelled.');
  }, []);

  const confirmDowngrade = async () => {
    setDowngrading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/.netlify/functions/manage-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error || 'Could not cancel the subscription. Please try again.');
        return;
      }
      setShowDowngradeDialog(false);
      window.location.href = '/dashboard';
    } finally {
      setDowngrading(false);
    }
  };

  const handlePlanSelect = async (planId: string) => {
    if (planId === 'free') {
      if (isLoggedIn) { setShowDowngradeDialog(true); return; }
      window.location.href = '/register';
      return;
    }
    if (planId === 'enterprise') {
      setShowContactSalesDialog(true);
      return;
    }

    setLoading(planId);
    setMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/register?plan=' + planId; return; }

      const priceMap: Record<string, { monthly?: string; yearly?: string }> = {
        starter: {
          monthly: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID,
          yearly: import.meta.env.VITE_STRIPE_STARTER_YEARLY_PRICE_ID,
        },
        solo: {
          monthly: import.meta.env.VITE_STRIPE_SOLO_PRICE_ID,
          yearly: import.meta.env.VITE_STRIPE_SOLO_YEARLY_PRICE_ID,
        },
        growth: {
          monthly: import.meta.env.VITE_STRIPE_BUSINESS_PRICE_ID,
          yearly: import.meta.env.VITE_STRIPE_BUSINESS_YEARLY_PRICE_ID,
        },
      };
      const priceId = priceMap[planId]?.[billingCycle];

      if (!priceId) { setMessage('Stripe is not configured. Please contact support.'); return; }

      const response = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ priceId }),
      });

      if (!response.ok) {
        let err = `HTTP ${response.status}`;
        try { const d = await response.json(); err = d.error || err; } catch { /* ignore */ }
        console.error('Checkout error:', err);
        setMessage(`Error: ${err}`);
        return;
      }

      const data = await response.json();
      if (!data?.url) { setMessage(data?.error || 'Could not create payment session.'); return; }
      window.location.href = data.url;
    } catch {
      setMessage('Connection error. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const creditPacks = [
    { id: 'credits_20',  label: '20 extra analyses',  price: prices.credits_20,  analyses: 20,  popular: false },
    { id: 'credits_50',  label: '50 extra analyses',  price: prices.credits_50,  analyses: 50,  popular: true  },
    { id: 'credits_120', label: '120 extra analyses', price: prices.credits_120, analyses: 120, popular: false },
  ];

  const handleCreditsBuy = async (packId: string) => {
    setLoadingCredits(packId);
    setMessage('');
    try {
      const linkMap: Record<string, string> = {
        credits_20:  import.meta.env.VITE_STRIPE_CREDITS_20  ?? '',
        credits_50:  import.meta.env.VITE_STRIPE_CREDITS_50  ?? '',
        credits_120: import.meta.env.VITE_STRIPE_CREDITS_120 ?? '',
      };
      const baseUrl = linkMap[packId];
      if (!baseUrl) { setMessage('Stripe link not configured for this credit pack.'); return; }

      const url = new URL(baseUrl);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        url.searchParams.set('client_reference_id', user.id);
        if (user.email) url.searchParams.set('prefilled_email', user.email);
      }
      window.location.href = url.toString();
    } catch {
      setMessage('Connection error. Please try again.');
    } finally {
      setLoadingCredits(null);
    }
  };

  const plans = PLANS;

  // Real $ saved by switching to yearly billing — computed from the same USD
  // source of truth pricing-cards reads from, not a separate hardcoded
  // number that could drift from what checkout actually charges.
  const parseUSD = (v: string) => Number(v.replace(/[^0-9.]/g, '')) || 0;
  const yearlySavings = [
    { plan: 'Starter', monthly: parseUSD(USD.starter_monthly), yearly: parseUSD(USD.starter_yearly) },
    { plan: 'Solo', monthly: parseUSD(USD.solo_monthly), yearly: parseUSD(USD.solo_yearly) },
    { plan: 'Business', monthly: parseUSD(USD.growth_monthly), yearly: parseUSD(USD.growth_yearly) },
  ].map(p => ({ ...p, savedPerYear: Math.round(p.monthly * 12 - p.yearly) }));

  const faqItems = [
    { q: 'Can I cancel anytime?',             a: 'Yes — cancel at any time and keep access until the end of your billing period.' },
    { q: 'What happens if I exceed my limit?', a: 'If you hit your plan limit, you can upgrade instantly or purchase additional analysis credits.' },
    { q: 'Can I change plans later?',          a: 'Absolutely — switch plans anytime without losing your existing data.' },
    { q: 'Will I receive a VAT invoice?',      a: 'Yes — every payment automatically generates a VAT invoice sent to your email. EU companies can enter their VAT number at checkout to receive a B2B invoice.' },
    { q: 'How do you handle my company data?', a: 'Brand context you upload stays in your private workspace. We never train AI models on your data and never share it with third parties beyond the AI providers required to run an analysis. We are fully GDPR compliant.' },
    { q: 'Can I change plans mid-billing cycle?', a: 'Yes — upgrading takes effect immediately and is prorated. Downgrading applies at the end of the current billing period, so you always get what you paid for.' },
    { q: 'Need help choosing a plan?',         a: 'Our team is available by email and happy to help you pick the best option for your brand.' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Standalone page (see App.tsx route comment) — own Navbar, since this
          isn't nested inside AppShell anymore. Navbar is fixed, hence the
          pt-28 below instead of the old pt-10 that assumed AppShell's
          in-flow topbar. */}
      <Navbar />

      {/* Downgrade dialog */}
      <Dialog open={showDowngradeDialog} onOpenChange={setShowDowngradeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              </div>
              <DialogTitle>Switch to Free plan</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to switch to the Free plan?
              <ul className="mt-3 space-y-1.5 text-sm">
                {[
                  'You will lose access to advanced LLM sources (Claude, Gemini and more)',
                  'Your limit will drop to 3 analyses per month',
                  'Analysis history and CSV export will be disabled',
                ].map(bullet => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">*</span> {bullet}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground/70">Your subscription will be cancelled — access continues until the end of the current billing period.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" disabled={downgrading} onClick={() => setShowDowngradeDialog(false)}>
              Stay on current plan
            </Button>
            <Button variant="destructive" className="flex-1" disabled={downgrading} onClick={confirmDowngrade}>
              {downgrading ? 'Cancelling...' : 'Yes, switch to Free'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Sales dialog — Agency plan */}
      <Dialog open={showContactSalesDialog} onOpenChange={setShowContactSalesDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Talk to sales about the Agency plan</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Tell us about your agency and what you need — a real person replies within 24 hours.
            </DialogDescription>
          </DialogHeader>
          <ContactForm defaultSubject="Agency plan inquiry" compact />
        </DialogContent>
      </Dialog>

      <div className="pb-20 px-4 max-w-7xl mx-auto">
        {/* Page header — promise, what you get, present-tense payoff, who
            carries the risk. The Free plan (no card) is the soft offer;
            Agency (quoted after a call) is the qualified one. */}
        <div className="text-center pt-28">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-medium text-primary mb-4 uppercase tracking-wider">
            Subscription
          </span>
          <h1 className="text-3xl sm:text-4xl font-display text-foreground mb-3 max-w-2xl mx-auto">
            Know exactly what AI models tell your customers about you.
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            You open Presora and see, right now, what ChatGPT, Claude and Gemini actually
            say when someone asks about your brand — an AI visibility score, the real quotes behind
            it, and a prioritized list of what to fix first.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Free plan, no card required
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary" /> Cancel any paid plan anytime
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Agency: $199/month, built for multi-client teams
            </span>
          </div>
        </div>

        {message && (
          <p className="mt-6 mb-2 text-center text-sm text-primary font-medium">{message}</p>
        )}

        {/* Control bar — left: billing-cycle toggle, right: usage + billing */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pt-8 pb-8">
          {/* Left: billing cycle */}
          <div className="flex items-center gap-1 p-1 rounded-lg border border-[hsl(var(--glass-border))] bg-muted/40 w-fit">
            {(['monthly', 'yearly'] as const).map(cycle => (
              <button
                key={cycle}
                onClick={() => setBillingCycle(cycle)}
                className={`relative px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  billingCycle === cycle
                    ? 'bg-background text-foreground shadow-sm border border-input'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                {cycle === 'yearly' && (
                  <span className="ml-1.5 text-[10px] font-semibold text-primary">−20%</span>
                )}
              </button>
            ))}
          </div>

          {/* Right: credit usage + billing */}
          <CreditsUsageWidget />
        </div>

        {/* Real $ saved by switching — no countdown timer, no invented
            urgency; the -20% is a standing rate, always available, so we
            say that plainly instead of dressing it up as a limited-time
            deal it isn't. */}
        {billingCycle === 'yearly' && (
          <p className="text-center text-xs text-muted-foreground -mt-4 mb-8">
            <Percent className="w-3 h-3 inline -mt-0.5 mr-1 text-primary" />
            Yearly billing saves ${yearlySavings[0].savedPerYear}–${yearlySavings[2].savedPerYear}/year depending on plan — applied automatically above, no code needed.
          </p>
        )}

        {/* Pricing cards */}
        <PricingCards
          plans={plans}
          billingCycle={billingCycle}
          onCycleChange={setBillingCycle}
          onPlanSelect={(planId) => handlePlanSelect(planId)}
          loadingPlan={loading}
          showBillingToggle={false}
        />

        {/* How we think about pricing — the philosophy behind the tiers,
            not just the tiers themselves. Framed around what it means for
            the visitor (pay for real usage, not a guess at "value"; start
            free; agencies scale without per-brand pricing) rather than as
            an internal strategy note. */}
        <motion.div
          className="mt-16 max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl font-display text-foreground">How we think about pricing</h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto mt-2">
              No tier is priced on a guess at what your brand is "worth" — every plan scales with
              something you can see and control yourself.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-card/40 p-5">
              <ShieldCheck className="w-4 h-4 text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">Try it before you commit</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                The Free plan runs real scans against real AI models — not a locked demo — so you
                can see exactly what you'd be paying for before entering a card.
              </p>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-card/40 p-5">
              <Zap className="w-4 h-4 text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">Pay for usage, not a guess</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Tiers scale with things you actually control — how many AI models you monitor, how
                often, and how many competitors you track — never a markup based on your brand's
                size or revenue.
              </p>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-card/40 p-5">
              <Sparkles className="w-4 h-4 text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">Built to grow with you</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Start on Solo and upgrade only when you add models or competitors. Agencies get one
                plan that covers every client brand with white-labeled reports — not a per-brand fee.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Why the price is what it is — trivialized to a daily cost, put
            next to a spending category people already have a feel for, and
            one honest limitation named up front rather than left for
            someone to discover after paying. */}
        <motion.div
          className="mt-16 max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-card/40 p-5">
              <Coffee className="w-4 h-4 text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">${(parseUSD(USD.starter_monthly) / 30).toFixed(2)}/day</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Starter works out to less than a coffee a day — for knowing what AI tells people about your brand every day of the month.
              </p>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-card/40 p-5">
              <Zap className="w-4 h-4 text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">Less than one agency hour</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                A marketing agency typically bills $150–300/hour. Starter costs less than that per month — and re-checks automatically, every month.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-5">
              <AlertTriangle className="w-4 h-4 text-amber-500 mb-2" />
              <p className="text-sm font-semibold text-foreground">Where it's not a fit yet</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                We cover 6 mainstream AI assistants (see below). If your customers mostly ask a
                niche or internal AI tool we don't query, this won't cover that yet.
              </p>
            </div>
          </div>

          {/* Turbo — a real bonus, sold on its own merit, included free
              rather than mentioned as an afterthought. */}
          <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/[0.05] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Included free with every plan: Google Visibility</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                On-page SEO audit and a meta-tag/structured-data generator for your site — a second,
                complementary check on top of the AI-model score, at no extra cost.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Our promise vs. what most AI-visibility tools promise — short and
            specific rather than a repeat of the full feature matrix already
            on the landing page. */}
        <motion.div
          className="mt-16 max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-primary/30 bg-primary/[0.05] p-5">
              <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-2">Our promise</p>
              <p className="text-sm text-foreground leading-relaxed">
                We show you the exact question we asked each AI model and the exact answer it gave —
                every score traces back to real, checkable evidence.
              </p>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-card/30 p-5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">What most AI-visibility tools promise</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A single score, updated on their schedule — with no way to see how they got there or verify it yourself.
              </p>
            </div>
          </div>
        </motion.div>

        {/* How long this takes everyone else vs Presora */}
        <motion.div
          className="mt-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-display text-foreground">How long this takes everyone else</h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Checking how AI models describe your brand the old way takes days or weeks. Presora does it before you can blink.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { method: 'Manually querying models', time: '2–3 days', note: 'Asking each model, prompt by prompt, and tallying the answers yourself.' },
              { method: 'Marketing agency audit', time: '2–4 weeks', note: 'Brief, research and a presentation — plus a four-figure invoice.' },
              { method: 'Traditional monitoring tools', time: 'Hours to set up', note: 'They track social media and search engines — not what AI actually says.' },
            ].map(item => (
              <div key={item.method} className="rounded-2xl border border-[hsl(var(--glass-border))] bg-background/70 p-5">
                <p className="text-2xl font-display text-foreground">{item.time}</p>
                <p className="text-sm font-medium text-foreground mt-2">{item.method}</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{item.note}</p>
              </div>
            ))}
            {/* Presora — the payoff */}
            <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-5 flex flex-col">
              <p className="text-2xl font-display text-primary">~15 seconds</p>
              <p className="text-sm font-semibold text-foreground mt-2">Presora</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">Every model queried in parallel, scored, and turned into a prioritized action plan — automatically.</p>
              <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary">
                <Check className="w-3.5 h-3.5" /> Repeatable every month
              </div>
            </div>
          </div>
        </motion.div>

        {/* FAQ — collapsible */}
        <motion.div
          className="mt-20 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-display text-foreground text-center mb-8">
            Frequently asked questions
          </h2>
          <Accordion
            type="single"
            collapsible
            className="rounded-2xl border border-[hsl(var(--glass-border))] bg-card/40 divide-y divide-[hsl(var(--glass-border))] overflow-hidden"
          >
            {faqItems.map((item, idx) => (
              <AccordionItem key={item.q} value={`faq-${idx}`} className="border-none px-5">
                <AccordionTrigger className="text-left text-sm font-semibold text-foreground hover:no-underline py-4">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* Credit packs */}
        <motion.div
          className="mt-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-display text-foreground">Need more analyses?</h2>
            </div>
            <p className="text-sm text-muted-foreground">Top up your account with one-time credit packs — no plan change required.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {creditPacks.map((pack) => (
              <div
                key={pack.id}
                className={`relative rounded-xl border p-6 flex flex-col gap-4 transition-all ${
                  pack.popular
                    ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-[hsl(var(--glass-border))] bg-background/80'
                }`}
              >
                {pack.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 bg-primary text-primary-foreground rounded-full whitespace-nowrap">
                    Best value
                  </span>
                )}
                <div>
                  <p className="text-3xl font-display text-foreground">{pack.price}</p>
                  <p className="text-sm text-muted-foreground mt-1">{pack.label}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-2">One-time credit top-up</p>
                </div>
                <Button
                  onClick={() => handleCreditsBuy(pack.id)}
                  disabled={loadingCredits === pack.id}
                  variant={pack.popular ? 'default' : 'outline'}
                  className="w-full"
                >
                  {loadingCredits === pack.id ? 'Loading...' : 'Buy pack'}
                </Button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Social proof */}
        <div className="mt-16">
          <div className="rounded-3xl border border-[hsl(var(--glass-border))] bg-card/60 p-8 text-center">
            <p className="text-sm uppercase tracking-[0.35em] text-primary mb-3">
              Built for the AI era
            </p>
            <h2 className="text-2xl font-display text-foreground max-w-2xl mx-auto">
              Stay ahead of AI-driven reputation and search shifts.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 text-left">
              {[
                { title: 'GEO-first approach', desc: 'Built around Generative Engine Optimization — the new standard for brand visibility in the AI era.' },
                { title: '3 leading AI models', desc: 'Coverage across ChatGPT, Claude and Gemini — the assistants your customers ask for recommendations.' },
                { title: 'Track over time', desc: 'Repeatable monthly audits show whether your optimization is actually working.' },
              ].map(item => (
                <div key={item.title} className="rounded-2xl border border-[hsl(var(--glass-border))] bg-background/60 p-5">
                  <p className="text-sm font-semibold text-foreground mb-1.5">{item.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Pricing;
