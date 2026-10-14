import { motion } from 'framer-motion';
import { Loader2, Lock, ShieldCheck, Smile, Target, AtSign, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BrandScanInput } from '@/components/BrandScanInput';
import { useBrewing } from '@/hooks/useBrewing';
import { bandOf, BAND_STYLE } from '@/lib/dimensionBands';
import { cn } from '@/lib/utils';

// Same key/label/icon mapping as HomeHub.tsx's DIMENSIONS and
// ScanResultPreview.tsx's sample — kept identical here so the real result
// reads as the same product as the sample report shown lower on the page.
const DIMENSIONS = [
  { key: 'authority', label: 'Authority', Icon: ShieldCheck },
  { key: 'sentiment', label: 'Sentiment', Icon: Smile },
  { key: 'accuracy', label: 'Accuracy', Icon: Target },
  { key: 'mentions', label: 'Mentions', Icon: AtSign },
  { key: 'recency', label: 'Recency', Icon: Clock },
] as const;

// Which single dimension stays visible in the teaser (matches the
// requested "1 of 5 indicators" — the other four plus the aggregate trust
// score stay blurred; unlocking the rest means creating an account, not
// giving an email). Authority is a stable, generally-flattering-looking
// metric to lead with.
const TEASER_VISIBLE_KEY = 'authority';

/**
 * Inline "instant free scan" widget for the Landing hero — runs a real scan
 * without navigating away, then teases the full 5-dimension result and
 * routes straight to account creation (not an email-gate form) to unlock
 * it. Real result, gated display — not a fabricated teaser number; the
 * brand name is carried through to /register so Onboarding doesn't ask the
 * visitor to retype it.
 *
 * This intentionally does NOT touch /brand-visibility's own guest flow
 * (Dashboard.tsx), which still shows a full result up to the per-IP guest
 * limit — that page is reachable directly from several other places
 * (About, Agencies, Onboarding, the app's own nav) and unifying it with
 * this gate is a separate, larger change.
 */
export const GuestScanWidget = ({ className }: { className?: string }) => {
  const navigate = useNavigate();
  const { status, progress, result, error, guestLimitReached, scansDisabled, providerUnavailable, startBrewing, reset } = useBrewing();

  if (status === 'idle' || status === 'error') {
    return (
      <div className={className}>
        <BrandScanInput
          placeholder="Your company or a competitor (e.g. Apple)"
          suggestions={['Tesla', 'Apple', 'Nike']}
          submitLabel="Generate my free AI audit"
          onSubmit={startBrewing}
        />
        {guestLimitReached && (
          <p className="mt-3 text-sm text-center text-muted-foreground">
            You've used your free scans for now. <a href="/register" className="text-primary hover:underline font-medium">Create a free account</a> to keep scanning.
          </p>
        )}
        {scansDisabled && (
          <p className="mt-3 text-sm text-center text-muted-foreground">Scanning is temporarily paused — please check back shortly.</p>
        )}
        {providerUnavailable && (
          <p className="mt-3 text-sm text-center text-muted-foreground">Scanning is unavailable right now. Please try again in a bit.</p>
        )}
        {error && !guestLimitReached && !scansDisabled && !providerUnavailable && (
          <p className="mt-3 text-sm text-center text-muted-foreground">{error} <button onClick={reset} className="text-primary hover:underline font-medium">Try again</button></p>
        )}
      </div>
    );
  }

  if (status === 'brewing' || status === 'loading') {
    // Real progress from useBrewing's simulated ramp, just relabeled at each
    // threshold so the wait reads as concrete steps instead of one static
    // sentence — not a separate fake timer, still driven by the same
    // progress value the actual fetch resolves against.
    const stepLabel =
      progress < 40 ? 'Connecting to GPT-4o, Claude, Perplexity…'
      : progress < 80 ? 'Analyzing sentiment and mention count…'
      : 'Finalizing your audit…';
    return (
      <div className={cn('rounded-2xl border border-[hsl(var(--glass-border))] bg-card/70 backdrop-blur-xl p-6 text-center', className)}>
        <Loader2 className="w-6 h-6 mx-auto text-primary animate-spin mb-3" />
        <p className="text-sm text-foreground font-medium">{stepLabel}</p>
        <div className="mt-3 h-1.5 max-w-xs mx-auto rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${progress}%` }}
            transition={{ ease: 'easeOut' }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Usually takes about 15 seconds.</p>
      </div>
    );
  }

  if (status === 'completed' && result) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('relative rounded-2xl border border-[hsl(var(--glass-border))] bg-card/70 backdrop-blur-xl shadow-xl shadow-primary/5 overflow-hidden text-left', className)}
      >
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-[hsl(var(--glass-border))]">
          <span className="text-sm text-muted-foreground truncate">
            <span className="text-foreground font-medium">{result.brandName}</span> / AI visibility scan
          </span>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {/* Trust score — blurred; unlocked by creating an account, not by an email form */}
            <div className="flex flex-col items-center sm:items-start justify-center sm:col-span-2 sm:flex-row sm:items-baseline sm:gap-6 pb-3 border-b border-[hsl(var(--glass-border))]">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground shrink-0">AI Trust Score</div>
              <div className="flex items-baseline gap-1 font-display blur-md select-none">
                <span className="text-4xl font-light text-primary tabular-nums">{result.trustScore}</span>
                <span className="text-lg text-primary/60">%</span>
              </div>
            </div>

            {DIMENSIONS.map(({ key, label, Icon }) => {
              const value = result.dimensions[key];
              const isVisible = key === TEASER_VISIBLE_KEY;
              const band = bandOf(value);
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-24 shrink-0">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">{label}</span>
                  </div>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', BAND_STYLE[band].meter, !isVisible && 'blur-xs')}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  {isVisible ? (
                    <span className={cn('w-9 text-right text-xs font-data font-semibold tabular-nums', BAND_STYLE[band].text)}>{value}%</span>
                  ) : (
                    <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-5 border-t border-[hsl(var(--glass-border))] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Your {result.brandName} audit is ready! Create a free account to unlock the complete 5-dimension audit and save this report.
            </p>
            <button
              onClick={() => navigate(`/register?brand=${encodeURIComponent(result.brandName)}`)}
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold shadow-md shadow-primary/30 hover:shadow-lg transition-all whitespace-nowrap shrink-0"
            >
              Create free account <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
};

export default GuestScanWidget;
