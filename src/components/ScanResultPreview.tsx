import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, ShieldCheck, Smile, Target, AtSign, Clock, ArrowUpRight, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Curated sample so visitors see exactly what a completed scan returns.
const SAMPLE = {
  brand: 'Tesla',
  score: 78,
  verdict: 'Solid AI visibility — strong authority and recency, with room to sharpen factual accuracy and mention rate.',
  dimensions: [
    { key: 'authority', label: 'Authority', value: 84, Icon: ShieldCheck },
    { key: 'recency',   label: 'Recency',   value: 88, Icon: Clock },
    { key: 'sentiment', label: 'Sentiment', value: 72, Icon: Smile },
    { key: 'accuracy',  label: 'Accuracy',  value: 66, Icon: Target },
    { key: 'mentions',  label: 'Mentions',  value: 61, Icon: AtSign },
  ],
  models: [
    { name: 'GPT-4o', verdict: 'recommends', positive: true },
    { name: 'Claude', verdict: 'recommends', positive: true },
    { name: 'Gemini', verdict: 'neutral', positive: false },
  ],
  action: 'Feed models structured, accurate facts about your products to lift the Accuracy signal.',
};

const bandMeter = (s: number) => (s >= 70 ? 'bg-emerald-500' : s >= 50 ? 'bg-amber-500' : 'bg-red-500');
const bandText = (s: number) => (s >= 70 ? 'text-emerald-600 dark:text-emerald-400' : s >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400');

export const ScanResultPreview = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
      className="relative rounded-2xl border border-[hsl(var(--glass-border))] bg-card/70 backdrop-blur-xl shadow-xl shadow-primary/5 overflow-hidden"
    >
      {/* soft glow */}
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />

      {/* Card header */}
      <div className="relative flex items-center justify-between gap-3 px-5 sm:px-7 pt-5 pb-4 border-b border-[hsl(var(--glass-border))]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-semibold bg-primary/10 text-primary border border-primary/20">
            <Sparkles className="w-3 h-3" /> Sample report
          </span>
          <span className="text-sm text-muted-foreground truncate">
            <span className="text-foreground font-medium">{SAMPLE.brand}</span> / AI Audit
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-emerald-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Live
        </div>
      </div>

      <div className="relative p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Score */}
        <div className="lg:col-span-4 flex flex-col items-center lg:items-start justify-center">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">AI Trust Score</div>
          <div className="flex items-baseline gap-1 font-display">
            <span className="text-6xl sm:text-7xl font-light text-primary tabular-nums drop-shadow-[0_0_30px_rgba(139,121,246,0.3)]">{SAMPLE.score}</span>
            <span className="text-2xl text-primary/60">%</span>
          </div>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-3 h-3" /> Strong visibility
          </div>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-xs">{SAMPLE.verdict}</p>
        </div>

        {/* Dimensions */}
        <div className="lg:col-span-8 lg:border-l lg:border-[hsl(var(--glass-border))] lg:pl-6">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Results by dimension</div>
          <div className="space-y-2.5">
            {SAMPLE.dimensions.map(({ key, label, value, Icon }, i) => (
              <div key={key} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-28 shrink-0">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">{label}</span>
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={cn('h-full rounded-full', bandMeter(value))}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${value}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.08, duration: 0.7, ease: 'easeOut' }}
                  />
                </div>
                <span className={cn('w-9 text-right text-xs font-data font-semibold tabular-nums', bandText(value))}>{value}%</span>
              </div>
            ))}
          </div>

          {/* Model verdicts */}
          <div className="mt-5 flex flex-wrap gap-2">
            {SAMPLE.models.map((m) => (
              <span
                key={m.name}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border',
                  m.positive
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                )}
              >
                {m.positive ? <Check className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                <span className="text-foreground/80">{m.name}</span> {m.verdict}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Top action */}
      <div className="relative mx-5 sm:mx-7 mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mt-0.5">
          <ArrowUpRight className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">Top recommended action</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{SAMPLE.action}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default ScanResultPreview;
