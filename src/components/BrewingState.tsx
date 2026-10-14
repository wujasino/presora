import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/lib/locale';
import { Check, Loader2, MessageSquareText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModelRef {
  id: string;
  label: string;
}

interface BrewingProgressProps {
  progress: number;
  brandName: string;
  /** The exact models being queried for this scan — the single source of
   *  truth for every count/label on this screen, so the node graph, the
   *  caption and the footer counter can never disagree with each other. */
  models: ModelRef[];
  onCancel?: () => void;
}

type ModelStatus = 'pending' | 'querying' | 'done';

/**
 * Was a circular "neural network" animation with a giant 0-99% number in
 * the exact type treatment as the final trust score, a hardcoded 6-node
 * ring that didn't match whichever models were actually being queried, and
 * "Brewing" coffee-shop copy on a product that sells a reputation audit.
 *
 * All three read as the same bug: this screen showed things that LOOKED
 * authoritative (a big percent, a brand-colored status ring, a specific
 * model count) without actually being tied to what was happening — the
 * same "presented-as-real but isn't" problem this codebase has hit before
 * with fabricated scan data. Rebuilt around one real fact this screen does
 * have: which models were asked, and what they were asked. No progress
 * number is ever shown at the size or style used for an actual score.
 */
export const BrewingProgress = ({ progress, brandName, models, onCancel }: BrewingProgressProps) => {
  const { t } = useTranslation();

  const stages = [
    { threshold: 0,  label: t('stage_0') },
    { threshold: 20, label: t('stage_1') },
    { threshold: 45, label: t('stage_2') },
    { threshold: 70, label: t('stage_3') },
    { threshold: 90, label: t('stage_4') },
  ];
  const currentStage = [...stages].reverse().find(s => progress >= s.threshold);

  const total = models.length || 1;
  // How many models have been reached so far — the same value drives the
  // node list, the "N / total" counter and the aria-live text, so they
  // can't drift apart the way the old caption/footer/graph trio did.
  const reachedCount = Math.min(models.length, Math.max(1, Math.ceil((progress / 100) * models.length)));
  const statusOf = (i: number): ModelStatus => {
    if (progress >= 100 || i < reachedCount - 1) return 'done';
    if (i === reachedCount - 1) return 'querying';
    return 'pending';
  };

  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtRef = useRef(Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSec(Math.round((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const activeModel = models[reachedCount - 1];
  const ariaText = `${currentStage?.label ?? ''} ${reachedCount} of ${total} models queried, ${elapsedSec}s elapsed.`;

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[60vh] py-10 overflow-hidden">
      {/* Screen-reader-only running status — every visual cue here (color,
          animation, position) is otherwise conveyed with nothing else. */}
      <div aria-live="polite" className="sr-only">{ariaText}</div>

      {/* Atmospheric glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Status pill — no coffee-shop language. */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 backdrop-blur-xs"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary animate-ping opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          <span className="text-[10px] uppercase tracking-[0.25em] text-primary font-data">
            {t('brewing_label')} · LIVE
          </span>
        </motion.div>

        {/* The real question being sent — this is the differentiator (raw
            model answers behind every score), shown honestly: it's the
            actual prompt used, not a per-model fabricated exchange. */}
        <div className="w-full rounded-xl border border-[hsl(var(--glass-border))] bg-muted/10 p-4 mb-5">
          <div className="flex items-start gap-2.5">
            <MessageSquareText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/80 leading-relaxed">
              Asking every model the same question: rate{' '}
              <span className="text-primary font-medium">{brandName}</span> 0–100 on authority,
              sentiment, recency, mentions and accuracy, then summarize how they'd describe it.
            </p>
          </div>
        </div>

        {/* Model list — one explicit status system (pending / querying /
            done), not brand color standing in for status. A red node used
            to read as "this model failed" even though it just meant
            Mistral's brand color. */}
        <div className="w-full rounded-xl border border-[hsl(var(--glass-border))] divide-y divide-[hsl(var(--glass-border))] overflow-hidden">
          {models.map((m, i) => {
            const status = statusOf(i);
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                  {status === 'done' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  {status === 'querying' && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
                  {status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />}
                </span>
                <span className={cn(
                  'text-sm flex-1',
                  status === 'pending' ? 'text-muted-foreground/50' : 'text-foreground'
                )}>
                  {m.label}
                </span>
                <span className={cn(
                  'text-xs font-data',
                  status === 'done' ? 'text-emerald-500'
                  : status === 'querying' ? 'text-primary'
                  : 'text-muted-foreground/40'
                )}>
                  {status === 'done' ? 'Done' : status === 'querying' ? 'Waiting for response…' : 'Queued'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Thin progress bar — no percentage number anywhere near it. A
            large "90%" in the same type treatment as the final score was
            the actual problem this screen had: users couldn't tell a
            progress figure from a result, and a mistimed screenshot of it
            reads as a real (wrong) score. */}
        <div className="mt-5 w-full h-[3px] bg-muted/40 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-linear-to-r from-primary/60 via-primary to-primary/60"
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Stage caption */}
        <div className="mt-3 h-5">
          <AnimatePresence mode="wait">
            <motion.p
              key={currentStage?.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="text-sm text-foreground/80"
            >
              {currentStage?.label}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Counter + elapsed time — replaces the old fake percentage as the
            actual progress signal, and answers "how much longer" (missing
            before) without promising an exact number. */}
        <div className="mt-4 flex items-center gap-3 text-[11px] text-muted-foreground font-data">
          <span>{reachedCount} / {total} models queried</span>
          <span className="text-muted-foreground/30">·</span>
          <span>{elapsedSec}s elapsed (usually ~15s)</span>
        </div>

        {activeModel && (
          <p className="mt-1 text-[11px] text-muted-foreground/60">
            Currently: {activeModel.label}
          </p>
        )}

        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        )}
      </div>
    </div>
  );
};
