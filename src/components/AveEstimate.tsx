import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { SourceResult } from '@/types/analysis';

interface AveEstimateProps {
  sources: SourceResult[];
}

const RATE_KEY = 'ave_value_per_mention';
const DEFAULT_RATE = 50;

const loadRate = (): number => {
  const raw = Number(localStorage.getItem(RATE_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RATE;
};

/**
 * AVE (Advertising Value Equivalency) — "if this mention had been a paid
 * ad, what would it have cost?" A real, commonly-requested PR reporting
 * metric, and a genuinely contested one: AMEC's Barcelona Principles say
 * outright not to use AVEs as a measure of communications success, because
 * an ad slot and an earned mention aren't the same thing and treating them
 * as interchangeable overstates what happened.
 *
 * Built anyway, but honestly: there's no market rate for "AI answer ad
 * space" to derive a number from, so rather than inventing an industry-
 * average $/mention and presenting it as researched fact (which is exactly
 * the class of fabricated-but-official-looking number this codebase has
 * repeatedly had to strip out elsewhere — see the Agency ROI calculator's
 * own comment), the $/mention is the reader's own assumption, typed in and
 * persisted locally. The output is only ever as credible as that input,
 * and the caveat says so.
 */
export const AveEstimate = ({ sources }: AveEstimateProps) => {
  const [expanded, setExpanded] = useState(false);
  const [rate, setRate] = useState(DEFAULT_RATE);

  useEffect(() => { setRate(loadRate()); }, []);

  const updateRate = (v: number) => {
    const clamped = Math.max(0, Math.min(100000, v));
    setRate(clamped);
    localStorage.setItem(RATE_KEY, String(clamped));
  };

  const favorable = (sources ?? []).filter(s => s.sentiment === 'Positive');
  const neutral = (sources ?? []).filter(s => s.sentiment === 'Neutral');
  const negative = (sources ?? []).filter(s => s.sentiment === 'Negative');
  const ave = favorable.length * rate;

  return (
    <div className="rounded-xl border border-[hsl(var(--glass-border))] bg-muted/10 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/20 transition-colors text-left"
      >
        <Megaphone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground flex-1">Advertising value equivalent (AVE)</span>
        {!expanded && favorable.length > 0 && (
          <span className="text-xs font-data text-foreground/70 tabular-nums">${ave.toLocaleString()}</span>
        )}
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
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
            <div className="px-4 pb-4 pt-1 border-t border-[hsl(var(--glass-border))]">
              <div className="pt-3 flex items-center gap-4 flex-wrap">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Estimated AVE</p>
                  <p className="text-2xl font-display text-foreground tabular-nums">${ave.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{favorable.length}</span> favorable
                  {(neutral.length > 0 || negative.length > 0) && (
                    <span className="text-muted-foreground/60">
                      · {neutral.length} neutral · {negative.length} negative — not counted
                    </span>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                Value per favorable mention
                <span className="flex items-center gap-1 text-foreground">
                  $
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    value={rate}
                    onChange={(e) => updateRate(Number(e.target.value))}
                    className="w-20 bg-background/60 border border-[hsl(var(--glass-border))] rounded-lg px-2 py-1 text-xs font-data focus:outline-hidden focus:border-primary/40 transition-colors"
                  />
                </span>
                <span className="text-muted-foreground/60">— your own assumption, saved on this device</span>
              </label>

              <div className="flex items-start gap-2 mt-4 text-[11px] text-muted-foreground/70 leading-relaxed">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p>
                  AVE asks "what would this favorable exposure have cost as a paid ad?" — useful for
                  translating a scan into a number a budget-holder recognises, but treat it as a talking
                  point, not an audited figure: there's no real market rate for AI-answer placements, so
                  this is {favorable.length} favorable {favorable.length === 1 ? 'mention' : 'mentions'} × the
                  rate you set above, nothing more. PR measurement bodies (e.g. AMEC's Barcelona Principles)
                  explicitly advise against treating AVE as a real measure of communications success —
                  it's here because agencies get asked for it, not as an endorsement of the methodology.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
