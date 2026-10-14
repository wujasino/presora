import { useMemo } from 'react';
import { AlertOctagon, ShieldAlert, Quote } from 'lucide-react';
import { AnalysisResult, SourceResult } from '@/types/analysis';
import { bandOf, BAND_LABEL } from '@/lib/dimensionBands';
import { cn } from '@/lib/utils';

/**
 * Real fact-checking (is what a model said actually true) isn't something
 * this product can do without a ground-truth source to check against — the
 * scan has no such source. Two things it CAN say honestly, both derived
 * from data the scan already returns:
 *
 *  1. The `accuracy` dimension score, banded the same way as everywhere
 *     else (dimensionBands.ts) — a low band already means "models are
 *     likely misrepresenting this brand," which is exactly what a
 *     hallucination is.
 *  2. Hedging language in a model's own `association` text — phrases a
 *     model actually wrote when it isn't sure ("might be", "I'm not aware
 *     of", "as of my knowledge cutoff", etc.). That's a real signal read
 *     off the model's own words, not an invented confidence score.
 *
 * Low confidence alone is NOT treated as a hallucination signal here — a
 * model can be confidently wrong or hesitantly right. Only the accuracy
 * band and literal hedging phrases are used.
 */

const HEDGE_PATTERNS = [
  /\bmight be\b/i, /\bmay be\b/i, /\bpossibly\b/i, /\bnot (?:certain|sure)\b/i,
  /\bI(?:'m| am) not (?:aware|familiar)\b/i, /\bI don't have (?:specific|enough|detailed)\b/i,
  /\bas of my (?:last update|knowledge cutoff|training)\b/i, /\bappears to\b/i,
  /\bcould be\b/i, /\bunclear\b/i, /\bunverified\b/i, /\bI (?:couldn't|could not) find\b/i,
  /\bno (?:reliable|clear) information\b/i, /\bI don't have (?:access to|information about)\b/i,
];

const findHedge = (text: string): string | null => {
  for (const re of HEDGE_PATTERNS) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
};

interface HallucinationAlertsProps {
  result: AnalysisResult;
}

export const HallucinationAlerts = ({ result }: HallucinationAlertsProps) => {
  const accuracyScore = useMemo(() => {
    const v = result.dimensions.accuracy;
    if (typeof v !== 'number' || isNaN(v)) return 50;
    const num = v <= 1 ? v * 100 : v;
    return Math.round(Math.max(0, Math.min(100, num)));
  }, [result.dimensions.accuracy]);

  const accuracyBand = bandOf(accuracyScore);
  const accuracyFlag = accuracyBand === 'weak' || accuracyBand === 'critical';

  const hedged = useMemo(() => {
    return (result.sources ?? [])
      .map((s: SourceResult) => ({ source: s, hedge: s.association ? findHedge(s.association) : null }))
      .filter((x): x is { source: SourceResult; hedge: string } => !!x.hedge);
  }, [result.sources]);

  if (!accuracyFlag && hedged.length === 0) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Hallucination alerts</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Accuracy scored {BAND_LABEL[accuracyBand]}, and no model answer used hedging language — no alerts on this scan.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Hallucination alerts</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Not a fact-check against ground truth — this scan has no source to verify against. These flag where the
        data itself points at risk: a weak accuracy score, or a model hedging in its own words.
      </p>

      <div className="space-y-2.5">
        {accuracyFlag && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/6 p-4 flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mt-0.5">
              <AlertOctagon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Accuracy scored {accuracyScore}% ({BAND_LABEL[accuracyBand]})
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Models are more likely to be misrepresenting this brand than at a Strong/Good score — worth
                reading the raw answers below rather than trusting the summary alone.
              </p>
            </div>
          </div>
        )}

        {hedged.map(({ source, hedge }, i) => (
          <div key={i} className="rounded-xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <p className="text-xs font-semibold text-foreground">{source.model}</p>
              <span className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border',
                'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
              )}>
                hedged: "{hedge}"
              </span>
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground leading-relaxed">
              <Quote className="w-3 h-3 shrink-0 mt-0.5 text-muted-foreground/50" />
              {source.association}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HallucinationAlerts;
