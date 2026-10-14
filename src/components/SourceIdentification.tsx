import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { SourceResult } from '@/types/analysis';
import { MODEL_CATALOG } from '@/lib/models';
import { cn } from '@/lib/utils';

interface SourceIdentificationProps {
  sources: SourceResult[];
  planTier: number;
}

/**
 * "Where does your AI narrative come from?" — identifies which models
 * actually contributed to this scan, split into two real, checkable tiers:
 * models that answered with real signal (confidence >= 50) vs. ones that
 * answered but were clearly guessing (confidence < 50, usually paired with
 * hedging language — see HallucinationAlerts).
 *
 * Deliberately does NOT claim to identify the models' underlying training
 * sources (news articles, Wikipedia, etc.) — none of the models queried
 * here expose real citations for a plain chat-completion answer (that's
 * only meaningful for a search-augmented model, and this scan doesn't
 * currently capture citation data even from the ones that could return
 * it). Naming the ones that answered, and how confidently, is the honest
 * version of "source identification" the data actually supports.
 */
export const SourceIdentification = ({ sources, planTier }: SourceIdentificationProps) => {
  const [expanded, setExpanded] = useState(false);

  const answered = new Set((sources ?? []).map(s => s.model));
  const visibleModels = MODEL_CATALOG.filter(m => m.tier <= planTier);
  const lockedModels = MODEL_CATALOG.filter(m => m.tier > planTier);
  const notQueried = visibleModels.filter(m => !answered.has(m.label));

  const strong = (sources ?? []).filter(s => s.confidence >= 50);
  const weak = (sources ?? []).filter(s => s.confidence < 50);

  return (
    <div className="rounded-xl border border-[hsl(var(--glass-border))] bg-muted/10 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/20 transition-colors text-left"
      >
        <Radar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground flex-1">Where this narrative comes from</span>
        <span className="text-xs font-data text-foreground/70 tabular-nums">{answered.size}/{MODEL_CATALOG.length} models</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[hsl(var(--glass-border))]">
              <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {strong.length > 0 && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/4 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1.5">Speaking with real signal</p>
                    <p className="text-xs text-foreground">{strong.map(s => s.model).join(', ')}</p>
                  </div>
                )}
                {weak.length > 0 && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/4 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1.5">Answered, but guessing</p>
                    <p className="text-xs text-foreground">{weak.map(s => s.model).join(', ')}</p>
                  </div>
                )}
              </div>

              {(notQueried.length > 0 || lockedModels.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {notQueried.map(m => (
                    <span key={m.id} className="px-2 py-0.5 rounded-full border border-[hsl(var(--glass-border))]">{m.label} — not queried this scan</span>
                  ))}
                  {lockedModels.map(m => (
                    <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[hsl(var(--glass-border))] text-muted-foreground/60">
                      <Lock className="w-2.5 h-2.5" /> {m.label}
                    </span>
                  ))}
                </div>
              )}

              <p className={cn('text-[11px] text-muted-foreground/70 leading-relaxed')}>
                This shows which models actually answered and how sure they sounded — not their underlying
                training sources. No model here exposes real citations for a plain answer like this one;
                treat "speaking with real signal" as models drawing on substantial knowledge of the brand,
                and "guessing" as models filling a gap with a plausible-sounding answer.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
