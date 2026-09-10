import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, BarChart3, Zap, Shield, Users, TrendingUp, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { GradientMeshBg } from '@/components/ui/gradient-mesh-bg';
import { cn } from '@/lib/utils';
import { Wordmark } from '@/components/Wordmark';

const GOALS = [
  { id: 'visibility',  icon: Zap,       label: 'AI Visibility',           desc: 'I want to know if AI mentions my brand' },
  { id: 'sentiment',   icon: TrendingUp, label: 'Sentiment & opinions',   desc: 'I want to track how AI rates my brand' },
  { id: 'competitor',  icon: Users,      label: 'Competitor analysis',    desc: 'I want to compare myself with competitors' },
  { id: 'reputation',  icon: Shield,     label: 'Reputation protection',  desc: 'I want to react before customers ask AI' },
  { id: 'reporting',   icon: BarChart3,  label: 'Client reports',         desc: 'I work at an agency and report on brands' },
];

const STEPS = ['Welcome', 'Your brand', 'Your goal', 'Done'];

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  // Prefilled by GuestScanWidget's "Create free account" CTA (via
  // Register.tsx's own ?brand= passthrough) so a visitor who already typed
  // their brand name on the Landing hero isn't asked to retype it here.
  const [brand, setBrand] = useState(searchParams.get('brand') || '');
  // Carried through from Register.tsx when the visitor picked a paid plan
  // before signing up — sends them to Pricing (which auto-resumes checkout)
  // instead of Dashboard once onboarding is done, rather than silently
  // dropping the choice back to Free.
  const pendingPlan = searchParams.get('plan');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dir, setDir] = useState(1);

  const goTo = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const toggleGoal = (id: string) => {
    setSelectedGoals(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const handleSkip = async () => {
    // Same onboarded=true write handleFinish does, minus the brand/goals —
    // otherwise a Google-auth user who skips gets sent right back into this
    // wizard on every subsequent login (GoogleCallback.tsx re-checks
    // profiles.onboarded on each sign-in; email/password users only ever
    // land here once, right after verifying their email, so they never hit
    // this without a persisted flag either).
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').upsert({
          id: user.id,
          onboarded: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      }
    } catch {
      // non-fatal — still let them into the app
    } finally {
      navigate(pendingPlan ? `/pricing?plan=${encodeURIComponent(pendingPlan)}` : '/dashboard', { replace: true });
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').upsert({
          id: user.id,
          onboarded: true,
          onboarding_brand: brand.trim() || null,
          onboarding_goals: selectedGoals,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      }
    } catch {
      // non-fatal
    } finally {
      setSaving(false);
      const dest = pendingPlan
        ? `/pricing?plan=${encodeURIComponent(pendingPlan)}`
        : brand.trim()
          ? `/brand-visibility?brand=${encodeURIComponent(brand.trim())}`
          : '/dashboard';
      navigate(dest, { replace: true });
    }
  };

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d * 40 }),
    center: { opacity: 1, x: 0 },
    exit:  (d: number) => ({ opacity: 0, x: d * -40 }),
  };

  return (
    <GradientMeshBg className="min-h-screen flex flex-col items-center justify-center px-4 py-12" variant="mono">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Wordmark className="text-2xl" />
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                i < step ? 'bg-primary text-primary-foreground' :
                i === step ? 'bg-primary/20 text-primary border border-primary/40' :
                'bg-muted text-muted-foreground'
              )}>
                {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px bg-muted overflow-hidden">
                  <div className={cn('h-full bg-primary transition-all duration-500', i < step ? 'w-full' : 'w-0')} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl overflow-hidden min-h-[380px] flex flex-col">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex flex-col gap-6 p-8 flex-1"
            >

              {/* ── Step 0: Welcome ── */}
              {step === 0 && (
                <>
                  <div className="space-y-2">
                    <span className="text-3xl">👋</span>
                    <h1 className="text-2xl font-display text-foreground">Welcome to Presora!</h1>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      It'll take less than a minute. We'll help you set up monitoring of your brand's visibility in AI — ChatGPT, Claude and Gemini.
                    </p>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      "We'll check how AI perceives your brand",
                      "We'll show a visibility score on a scale of 0–100",
                      "We'll give you initial recommendations",
                    ].map(item => (
                      <li key={item} className="flex items-center gap-2.5 text-sm text-foreground">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    <Button className="w-full gap-2" onClick={() => goTo(1)}>
                      Let's go <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}

              {/* ── Step 1: Brand name ── */}
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <span className="text-3xl">🏷️</span>
                    <h2 className="text-2xl font-display text-foreground">What is your brand called?</h2>
                    <p className="text-sm text-muted-foreground">
                      Enter the name of the company or product you want to monitor.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onboarding-brand" className="sr-only">Brand name</Label>
                    <Input
                      id="onboarding-brand"
                      name="brand"
                      value={brand}
                      onChange={e => setBrand(e.target.value)}
                      placeholder="e.g. Presora, Nike, Notion..."
                      className="h-12 text-base"
                      autoFocus
                      maxLength={80}
                      onKeyDown={e => e.key === 'Enter' && goTo(2)}
                    />
                    <p className="text-xs text-muted-foreground/60">
                      You can change this later and analyze any brand.
                    </p>
                  </div>
                  <div className="mt-auto flex gap-3">
                    <Button variant="ghost" onClick={() => goTo(0)}>Back</Button>
                    <Button className="flex-1 gap-2" onClick={() => goTo(2)}>
                      Next <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}

              {/* ── Step 2: Goals ── */}
              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <span className="text-3xl">🎯</span>
                    <h2 className="text-2xl font-display text-foreground">What matters most to you?</h2>
                    <p className="text-sm text-muted-foreground">Choose one or more goals.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {GOALS.map(goal => {
                      const selected = selectedGoals.includes(goal.id);
                      return (
                        <button
                          key={goal.id}
                          onClick={() => toggleGoal(goal.id)}
                          className={cn(
                            'flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors',
                            selected
                              ? 'border-primary/50 bg-primary/10 text-foreground'
                              : 'border-[hsl(var(--glass-border))] hover:border-primary/30 hover:bg-card/60 text-foreground'
                          )}
                        >
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                            selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            <goal.icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{goal.label}</p>
                            <p className="text-xs text-muted-foreground">{goal.desc}</p>
                          </div>
                          {selected && <CheckCircle2 className="w-4 h-4 text-primary ml-auto shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-auto flex gap-3">
                    <Button variant="ghost" onClick={() => goTo(1)}>Back</Button>
                    <Button className="flex-1 gap-2" onClick={() => goTo(3)}>
                      Next <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}

              {/* ── Step 3: Done ── */}
              {step === 3 && (
                <>
                  <div className="space-y-2 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                      className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto"
                    >
                      <CheckCircle2 className="w-8 h-8 text-primary" />
                    </motion.div>
                    <h2 className="text-2xl font-display text-foreground">All set!</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {brand.trim()
                        ? <>We'll now run the first analysis of the brand <strong className="text-foreground">{brand}</strong> in ChatGPT, Claude and Gemini.</>
                        : 'You can now go to the dashboard and analyze any brand.'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[hsl(var(--glass-border))] bg-muted/20 p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Your starting plan</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">Free — 3 free analyses</span>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">Active</span>
                    </div>
                    <p className="text-xs text-muted-foreground">You can upgrade your plan at any time from settings.</p>
                  </div>

                  <div className="mt-auto">
                    <Button className="w-full gap-2" onClick={handleFinish} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      {brand.trim() ? `Analyze "${brand}"` : 'Go to dashboard'}
                    </Button>
                  </div>
                </>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-muted-foreground/40 mt-6">
          Presora · <button className="hover:underline" onClick={handleSkip}>Skip onboarding</button>
        </p>
      </div>
    </GradientMeshBg>
  );
}
