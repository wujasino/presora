import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, TrendingUp, TrendingDown, Activity, Layers, Target, RefreshCw, Search, Lock, FileDown, Swords, X, Volume2, Square, Loader2, Presentation, AlertTriangle, Clock, FileText, AlertCircle } from 'lucide-react';
import HomeHub from '@/components/home/HomeHub';
import { useTranslation } from '@/lib/locale';
import { BrewingProgress } from '@/components/BrewingState';
import { RadarChartCard } from '@/components/charts/RadarChartCard';
import { SentimentChart } from '@/components/charts/SentimentChart';
import { SourceDonutChart } from '@/components/charts/SourceDonutChart';
import { SourceTable } from '@/components/SourceTable';
import { ScoreMethodology } from '@/components/ScoreMethodology';
import { ResultsBreakdown } from '@/components/ResultsBreakdown';
import { AiActionPlan } from '@/components/AiActionPlan';
// Below-the-fold supplementary cards on the results screen — lazy-loaded so
// their ~15 KB of component code (plus AveEstimate) isn't part of the
// Dashboard chunk everyone downloads just to see the score and action plan
// above the fold. Each becomes its own small, content-hashed, immutable
// chunk — same "more small requests over HTTP/2 beats one bigger one"
// tradeoff already made for the rest of this bundle (see the vite.config.ts
// comment on manualChunks).
const AveEstimate = lazy(() => import('@/components/AveEstimate').then(m => ({ default: m.AveEstimate })));
const SourceIdentification = lazy(() => import('@/components/SourceIdentification').then(m => ({ default: m.SourceIdentification })));
const VisibilityGapAnalysis = lazy(() => import('@/components/VisibilityGapAnalysis').then(m => ({ default: m.VisibilityGapAnalysis })));
const HallucinationAlerts = lazy(() => import('@/components/HallucinationAlerts').then(m => ({ default: m.HallucinationAlerts })));
const AgencyReportCallout = lazy(() => import('@/components/AgencyReportCallout').then(m => ({ default: m.AgencyReportCallout })));
import BrandKnowledgeForm from '@/components/BrandKnowledgeForm';
import { useBrewing } from '@/hooks/useBrewing';
import { useTTS, loadVoicePrefs } from '@/hooks/useTTS';
import { usePlan, tierOf, useSessionUser, isAgencyPlan } from '@/hooks/useAccountInfo';
import { ResultChatWidget } from '@/components/ui/result-chat-widget';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { AnalysisResult } from '@/types/analysis';
import { scoreBrand, type BrandScore } from '@/lib/brandScore';
import { brandKey, titleCaseIfAllLower } from '@/lib/analyses';
import { MODEL_CATALOG, loadModelPrefs } from '@/lib/models';
import { bandOf, BAND_LABEL, BAND_STYLE } from '@/lib/dimensionBands';

// Public origin that serves the embeddable badge endpoint (must be a live,
// absolute URL so copied snippets work on any external site).
const BADGE_ORIGIN = 'https://www.presora.app';

const LockedOverlay = ({ title, description, onUpgrade, t }: { title: string; description: string; onUpgrade: () => void; t: (k: string) => string }) => (
  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl overflow-hidden">
    {/* Blurred bg */}
    <div className="absolute inset-0 bg-background/60 backdrop-blur-md" />
    {/* Subtle gradient top */}
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

    <div className="relative flex flex-col items-center gap-4 text-center px-8">
      {/* Icon */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl scale-150" />
        <div className="relative w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Lock className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Text */}
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground tracking-tight">{title}</p>
        <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed">{description}</p>
      </div>

      {/* CTA */}
      <button
        onClick={onUpgrade}
        className="relative group mt-1 px-5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5"
      >
        {t('upgrade_cta')}
      </button>
    </div>
  </div>
);

const getScoreKey = (s: number) => {
  if (s >= 85) return 'score_excellent';
  if (s >= 70) return 'score_high';
  if (s >= 50) return 'score_moderate';
  return 'score_low';
};
const getVerdictKey = (s: number) => {
  if (s >= 85) return 'dashboard_verdict_excellent';
  if (s >= 70) return 'dashboard_verdict_high';
  if (s >= 50) return 'dashboard_verdict_moderate';
  return 'dashboard_verdict_low';
};

// ── Hero score band ─────────────────────────────────────────────
const ScoreHero = ({
  result, t, previousScan, onImproveAccuracy, plan,
}: {
  result: AnalysisResult;
  t: (k: string) => string;
  /** Real previous scan of THIS brand, or null (first scan / not signed in / still loading). */
  previousScan: { trust_score: number; created_at: string } | null;
  onImproveAccuracy: () => void;
  plan: string;
}) => {
  const score = useMemo(() => {
    if (typeof result.trustScore === 'number' && !isNaN(result.trustScore)) return Math.round(result.trustScore);
    const d = result.dimensions;
    return Math.round((d.authority + d.sentiment + d.accuracy + d.mentions + d.recency) / 5);
  }, [result]);

  // Was derived from `result.sentimentTrend` — a client-fabricated 7-point
  // sine wave (analyze.js never returns a real trend), so the "+N pts" pill
  // was mathematically generated from Math.sin(), not a real day-over-day
  // change. Now a real comparison against the previous saved scan of the
  // SAME brand, or hidden entirely when there isn't one — never fabricated.
  const delta = previousScan ? score - Math.round(previousScan.trust_score) : null;

  // Strongest / weakest dimension, each with the SAME band word ResultsBreakdown
  // shows for that dimension — previously this said a static "Needs attention"
  // regardless of the real value, which could contradict a "Strong" badge on
  // the exact same number a few inches below it.
  const [strongest, weakest] = useMemo(() => {
    const dimensions = Object.entries(result.dimensions) as [string, number][];
    const normalized = dimensions.map(([k, v]) => [k, v <= 1 ? v * 100 : v] as [string, number]);
    const sorted = [...normalized].sort((a, b) => b[1] - a[1]);
    return [sorted[0], sorted[sorted.length - 1]];
  }, [result.dimensions]);
  const strongestBand = bandOf(Math.round(strongest[1]));
  const weakestBand = bandOf(Math.round(weakest[1]));

  // Animated counter
  const [animScore, setAnimScore] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 1100;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimScore(Math.round(eased * score));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  // Top model from sources
  const topModel = useMemo(() => {
    if (!result.sources?.length) return null;
    return [...result.sources].sort((a, b) => b.confidence - a.confidence)[0];
  }, [result.sources]);

  const avgConfidence = useMemo(() => {
    if (!result.sources?.length) return 0;
    return Math.round(result.sources.reduce((acc, s) => acc + s.confidence, 0) / result.sources.length);
  }, [result.sources]);

  // Real spread across models, not a bare average — "62%" alone hides
  // whether that's every model agreeing at 62, or one model at 90 dragging
  // three vague ones up from 40. Feeds the confidence banner below.
  const confidenceRange = useMemo(() => {
    const values = (result.sources ?? []).map(s => s.confidence);
    if (!values.length) return null;
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [result.sources]);
  const confidenceBand = bandOf(avgConfidence);

  // Count, not a bare percentage — "Positive sentiment ratio: 0%" sitting
  // next to "Sentiment: 71%" read as two contradictory measurements of the
  // same thing. They measure different things (how many models used a
  // literal "Positive" label vs. a 0-100 rated dimension score); a "2/3
  // models" count doesn't invite the reader to subtract one from the other.
  const posCount = useMemo(() => (result.sources ?? []).filter(s => s.sentiment === 'Positive').length, [result.sources]);
  const totalModels = result.sources?.length ?? 0;
  const positiveRatio = totalModels > 0 ? Math.round((posCount / totalModels) * 100) : 0;

  const { speak, stop, playing, loading: ttsLoading, error: ttsError } = useTTS();
  const [voiceEnabled, setVoiceEnabled] = useState(() => loadVoicePrefs().enabled);
  useEffect(() => {
    const sync = () => setVoiceEnabled(loadVoicePrefs().enabled);
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('focus', sync); };
  }, []);

  const buildReportText = () => {
    const lines = [
      `Report for brand ${result.brandName}.`,
      `AI visibility score: ${score} percent.`,
      `Strongest dimension: ${strongest[0]}, ${Math.round(strongest[1])} percent.`,
      `Weakest dimension: ${weakest[0]}, ${Math.round(weakest[1])} percent.`,
      `Average model confidence: ${avgConfidence} percent.`,
      `Positive sentiment: ${positiveRatio} percent.`,
    ];
    if (score < 60) lines.push('Note: AI recommends your competitors instead of you. Your brand is invisible in language model results.');
    return lines.join(' ');
  };

  return (
    <div className="relative rounded-2xl border border-border bg-card/90 dark:bg-card/40 backdrop-blur-xl overflow-hidden mb-6 shadow-sm dark:shadow-none">
      {/* Gradient mesh background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-4 right-8 w-56 h-56 rounded-full bg-indigo-400/8 blur-3xl" />
        <div className="absolute -bottom-12 left-1/2 w-64 h-48 rounded-full bg-primary/6 blur-2xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
      </div>
      <div className="relative p-6 sm:p-8 lg:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Big score */}
          <div className="lg:col-span-4 flex flex-col items-center lg:items-start">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">
              {t('dashboard_overall_score')}
            </div>
            <div className="relative flex items-baseline gap-1 font-display">
              <span className="text-7xl sm:text-8xl font-light text-primary tabular-nums drop-shadow-[0_0_30px_rgba(139,121,246,0.35)]">
                {animScore}
              </span>
              <span className="text-3xl text-primary/60">%</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-medium bg-primary/10 text-primary border border-primary/20">
                {t(getScoreKey(score))}
              </span>
              {delta !== null && delta !== 0 && previousScan && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium',
                    delta > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
                  )}
                  title={`vs ${new Date(previousScan.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}`}
                >
                  {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {delta > 0 ? '+' : ''}{delta} pt{Math.abs(delta) === 1 ? '' : 's'}
                  {' vs '}{new Date(previousScan.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                </span>
              )}
              {delta === 0 && previousScan && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground">
                  No change vs {new Date(previousScan.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                </span>
              )}
            </div>
            {voiceEnabled && (
              <button
                onClick={() => playing ? stop() : speak(buildReportText())}
                disabled={ttsLoading}
                className={cn(
                  'mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  playing
                    ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                    : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
                )}
              >
                {ttsLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : playing
                  ? <Square className="w-3.5 h-3.5" />
                  : <Volume2 className="w-3.5 h-3.5" />}
                {ttsLoading ? 'Loading...' : playing ? 'Stop' : 'Read report'}
              </button>
            )}
          </div>

          {/* Verdict */}
          <div className="lg:col-span-5 lg:border-l lg:border-r lg:border-[hsl(var(--glass-border))] lg:px-8">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">
              <Sparkles className="w-3 h-3 text-primary" />
              {t('dashboard_verdict')}
            </div>
            <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">
              {t(getVerdictKey(score)).split('{brand}').join(result.brandName)}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  {t('dashboard_strongest')}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Target className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-sm font-medium text-foreground capitalize">{t(`dim_${strongest[0]}`)}</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-data">{Math.round(strongest[1])}%</span>
                  <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border', BAND_STYLE[strongestBand].chip)}>
                    {BAND_LABEL[strongestBand]}
                  </span>
                </div>
              </div>
              <div>
                {/* Neutral header ("Weakest dimension", not a static "Needs
                    attention") — the chip below already carries the real
                    verdict, computed by the SAME function ResultsBreakdown
                    uses for the exact same number, so the two can't disagree. */}
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  {t('dashboard_weakest')}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Activity className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground capitalize">{t(`dim_${weakest[0]}`)}</span>
                  <span className={cn('text-xs font-data', BAND_STYLE[weakestBand].text)}>{Math.round(weakest[1])}%</span>
                  <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border', BAND_STYLE[weakestBand].chip)}>
                    {BAND_LABEL[weakestBand]}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Insights stats */}
          <div className="lg:col-span-3 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 flex items-center gap-2">
              <Layers className="w-3 h-3 text-primary" />
              {t('dashboard_top_insights')}
            </div>
            <InsightRow label={t('dashboard_insight_1')} value={topModel?.model ?? '—'} />
            <InsightRow label={t('dashboard_insight_2')} value={`${avgConfidence}%`} />
            <InsightRow
              label={t('dashboard_insight_3')}
              value={totalModels > 0 ? `${posCount}/${totalModels}` : '—'}
              accent={totalModels > 0 && posCount === totalModels}
            />
          </div>
        </div>

        {/* Confidence banner — "Average confidence 62%" used to just sit in
            the insights list, ignored, while the headline score rendered at
            full visual confidence regardless. Low average model confidence
            now visibly qualifies the score and bridges straight into brand
            knowledge, the actual lever that raises it. */}
        {(confidenceBand === 'weak' || confidenceBand === 'critical') && confidenceRange && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mt-0.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Low confidence — {avgConfidence}% average, {confidenceRange.min}–{confidenceRange.max}% across models
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Some models returned vague answers about {result.brandName}. Add brand context so future scans have facts to draw from instead of guesses.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onImproveAccuracy}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-medium hover:bg-amber-500/25 transition-colors"
            >
              Add brand context
            </button>
          </motion.div>
        )}

        {/* "o k***wa moment" — competitor urgency banner for low-scoring brands */}
        {score < 60 && (
          <>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.4 }}
            className="mt-6 rounded-xl border border-red-500/30 bg-red-500/[0.07] dark:bg-red-500/5 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center mt-0.5">
                <Swords className="w-4 h-4 text-red-500 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
                  {t('dashboard_low_score_alert_title') !== 'dashboard_low_score_alert_title'
                    ? t('dashboard_low_score_alert_title')
                    : 'AI recommends your competitors — not you'}
                </p>
                <p className="text-xs text-red-700/80 dark:text-red-300/70 leading-relaxed">
                  {t('dashboard_low_score_alert_body') !== 'dashboard_low_score_alert_body'
                    ? t('dashboard_low_score_alert_body')
                    : `A score of ${score}% means that when someone asks ChatGPT or Gemini for a solution in your category, the models recommend competitors. Your brand is invisible in AI — this is a direct loss of customers.`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.sources?.slice(0, 3).map((s, i) => (
                    <span key={i} className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium',
                      s.sentiment === 'Negative' ? 'bg-red-500/15 text-red-700 dark:text-red-300' :
                      s.sentiment === 'Neutral' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' :
                      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    )}>
                      {s.model}: {s.sentiment === 'Negative' ? '✗ does not recommend' : s.sentiment === 'Neutral' ? '~ neutral' : '✓ recommends'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
          <AiActionPlan analysisId={result.id} plan={plan} />
          </>
        )}
      </div>
    </div>
  );
};

const InsightRow = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className={cn('font-data font-medium', accent ? 'text-emerald-400' : 'text-foreground')}>{value}</span>
  </div>
);

// ── Live signal pill ─────────────────────────────────────────────
const LiveSignal = ({ label }: { label: string }) => (
  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/5">
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
    </span>
    <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-300 font-data">
      {label}
    </span>
  </div>
);

const Dashboard = ({ demoScan = false }: { demoScan?: boolean }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const onScanRoute = demoScan || location.pathname === '/brand-visibility';
  const t = useTranslation().t;
  const analysisId = searchParams.get('id');
  const brandFromUrl = searchParams.get('brand') || '';
  const { progress, status, result, startBrewing, reset, loadStoredAnalysis, guestLimitReached, error: brewingError, scansDisabled, notFound, providerUnavailable } = useBrewing();
  const displayBrand = result?.brandName || brandFromUrl;
  // Display-only casing fix — "facebook" reads as a typo next to properly
  // cased brands. Doesn't touch the DB or the request payload, so it's safe
  // to apply even to reports saved before canonicalBrandName() started
  // fixing this at save time.
  const displayBrandTitled = titleCaseIfAllLower(displayBrand);
  const [inputValue, setInputValue] = useState(brandFromUrl);
  // Separate from `inputValue` (which still drives the idle pre-scan screen
  // below): the results toolbar's "scan a different brand" field used to
  // share state with the current brand, prefilled with it, which read as
  // "edit this to overwrite the report" and also silently fed the wrong
  // brand into BrandKnowledgeForm whenever someone typed ahead. Always
  // starts empty.
  const [newScanInput, setNewScanInput] = useState('');
  const [moderationError, setModerationError] = useState('');
  const { data: plan = 'Free' } = usePlan();
  const planTier = tierOf(plan.toLowerCase());
  const { data: sessionUser } = useSessionUser();
  const isLoggedIn = !!sessionUser?.id;
  const isIdle = !brandFromUrl && !analysisId;

  // Real previous scan of THIS brand — replaces the sentimentTrend-derived
  // fake delta in ScoreHero. Same brandKey-based matching HomeHub uses, so
  // "presora" and "Presora.app" are treated as the same brand here too.
  const [previousScan, setPreviousScan] = useState<{ trust_score: number; created_at: string } | null>(null);
  useEffect(() => {
    setPreviousScan(null);
    if (status !== 'completed' || !result?.brandName || !isLoggedIn || !sessionUser?.id) return;
    let active = true;
    const key = brandKey(result.brandName);
    const currentTimestamp = new Date(result.timestamp).getTime();
    supabase
      .from('analyses')
      .select('trust_score, brand_name, created_at')
      .eq('user_id', sessionUser.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!active || !data) return;
        const match = data.find(a =>
          brandKey(a.brand_name) === key &&
          // Excludes the row THIS scan just wrote (or is about to) rather
          // than an id comparison — a fresh scan's client-side result.id and
          // the real DB row id aren't guaranteed to line up within the same
          // tick this effect runs.
          Math.abs(new Date(a.created_at).getTime() - currentTimestamp) > 5000
        );
        setPreviousScan(match ? { trust_score: match.trust_score, created_at: match.created_at } : null);
      });
    return () => { active = false; };
  }, [status, result?.brandName, result?.timestamp, isLoggedIn, sessionUser?.id]);

  // Bumped by the low-confidence banner's CTA to force-expand and scroll to
  // the (now collapsed-by-default) brand knowledge section below.
  const [kbExpandSignal, setKbExpandSignal] = useState(0);

  // Competitor comparison (deterministic client-side score — no API/credit cost)
  const [competitorInput, setCompetitorInput] = useState('');
  const [competitor, setCompetitor] = useState<BrandScore | null>(null);
  const runCompare = () => {
    const name = competitorInput.trim();
    if (!name) return;
    setCompetitor(scoreBrand(name));
  };
  const clearCompare = () => {
    setCompetitor(null);
    setCompetitorInput('');
  };

  // Embeddable badge — the preview and the copyable snippet must both point at
  // the public production endpoint (never window.location.origin, or a snippet
  // copied from localhost / a deploy preview would embed a dead URL).
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [badgeError, setBadgeError] = useState(false);
  const badgeBrand = result?.brandName || brandFromUrl || 'Your Brand';
  const badgeSrc = `${BADGE_ORIGIN}/.netlify/functions/badge?brand=${encodeURIComponent(badgeBrand)}`;
  const embedCode = `<a href="${BADGE_ORIGIN}" target="_blank" rel="noopener"><img src="${badgeSrc}" alt="Presora AI Visibility" height="36" /></a>`;
  useEffect(() => { setBadgeError(false); }, [badgeSrc]);
  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    } catch { /* ignore */ }
  };
  const canSeeCharts = planTier >= 1;
  const canSeeSources = planTier >= 2;
  const canCreateAudit = isAgencyPlan(plan);

  useEffect(() => {
    if (analysisId) {
      loadStoredAnalysis(analysisId);
    } else if (brandFromUrl) {
      startBrewing(brandFromUrl);
    }
    return () => reset();
  }, [analysisId, brandFromUrl, reset, startBrewing, loadStoredAnalysis]);

  const submitScanRequest = async (raw: string) => {
    const val = raw?.trim();
    if (!val) return;
    setModerationError('');
    try {
      const res = await fetch('/.netlify/functions/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: val }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.flagged) {
          setModerationError(data.reason || 'Prohibited content.');
          return;
        }
      }
    } catch { /* network error — allow through */ }
    // Setting the URL param is enough — the effect below reacts to
    // brandFromUrl changes and calls startBrewing. Calling it here too
    // used to double-fire it (two /analyze calls, two saved rows for one
    // scan) whenever brandFromUrl actually changed as a result.
    setSearchParams({ brand: val });
  };

  // Idle pre-scan screen's form.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitScanRequest(inputValue);
  };

  // Results toolbar's "scan a different brand" form — deliberately a
  // separate handler/input from the one above (see newScanInput's comment).
  const handleNewScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitScanRequest(newScanInput);
    setNewScanInput('');
  };

  if (isIdle) {
    // On Home, show a tool hub; the scanner lives in its own Tools section.
    if (!onScanRoute) return <HomeHub />;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex justify-center px-4 pt-16 sm:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
              <Search className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-display text-foreground mb-2">
              Brand analysis
            </h1>
            <p className="text-muted-foreground text-sm mb-8">
              Enter the brand name you want to analyze
            </p>
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="dashboard-brand-input-idle"
                  name="brand"
                  type="text"
                  autoFocus
                  aria-label="Brand name to analyze"
                  value={inputValue}
                  onChange={(e) => { setInputValue(e.target.value); setModerationError(''); }}
                  placeholder="e.g. Apple, Tesla, Nike…"
                  className="w-full bg-card/40 backdrop-blur-xl border border-[hsl(var(--glass-border))] text-foreground placeholder:text-muted-foreground text-base rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-primary/40 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="bg-primary text-primary-foreground px-5 py-3.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-40"
              >
                {t('analyze')}
              </button>
            </form>
            {moderationError && (
              <p className="text-xs text-destructive mt-2 text-left">{moderationError}</p>
            )}

            {/* Quick suggestions — one click starts a sample analysis */}
            {!inputValue.trim() && (
              <div className="mt-6">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground/60 mb-3">
                  Or try a popular brand
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {['Coca-Cola', 'Tesla', 'Nike'].map(brand => (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => {
                        setInputValue(brand);
                        setSearchParams({ brand });
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[hsl(var(--glass-border))] bg-card/60 text-sm text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      {brand}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {inputValue.trim().length > 1 && (
              <div className="mt-6 text-left">
                <BrandKnowledgeForm brandName={inputValue} />
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <div className="pt-6 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Top bar */}
        <header className="flex flex-col gap-4 mb-6">
          <button
            onClick={() => navigate('/')}
            className="self-start flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t('back')}
          </button>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                {status === 'completed' && <LiveSignal label={t('dashboard_monitoring')} />}
              </div>
              <h1 className="text-3xl sm:text-4xl font-display text-foreground">
                {displayBrandTitled}{' '}
                <span className="text-muted-foreground font-light">{t('auditSuffix')}</span>
              </h1>
              <p className="text-muted-foreground text-xs mt-1.5 font-data">
                {/* Was t('dashboard_monitoring') again here — the same word
                    the pill above already shows. Once complete, the
                    genuinely missing piece is WHEN this scan ran. */}
                {status === 'completed' && result
                  ? `Scanned ${new Date(result.timestamp).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}`
                  : status === 'brewing' ? t('brewingInProgress') : ''}
              </p>
            </div>

            {status === 'completed' ? (
              /* Results toolbar. "Analyze" sitting next to a same-brand
                 refresh icon used to be ambiguous — which one re-runs THIS
                 report vs. starts a different one? Split: a "New scan" field
                 that starts empty (never prefilled with the current brand,
                 so it can't read as "edit this to overwrite"), and a
                 separately labeled "Re-scan" for the current brand. Export
                 PDF and Client audit keep a visible label at every width —
                 for an agency, Client audit is not a secondary action. */
              <div className="flex flex-wrap items-center gap-2 sm:max-w-lg w-full">
                <form onSubmit={handleNewScanSubmit} className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <div className="relative flex-1 min-w-[140px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="dashboard-new-scan-input"
                      name="newBrand"
                      type="text"
                      aria-label="Scan a different brand"
                      value={newScanInput}
                      onChange={(e) => { setNewScanInput(e.target.value); setModerationError(''); }}
                      placeholder="Scan a different brand…"
                      className="w-full bg-card/40 backdrop-blur-xl border border-[hsl(var(--glass-border))] text-foreground placeholder:text-muted-foreground text-sm rounded-xl py-2.5 pl-10 pr-3 focus:outline-none focus:border-primary/40 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!newScanInput.trim()}
                    className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-40"
                  >
                    New scan
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setSearchParams({ brand: displayBrand });
                    setTimeout(() => startBrewing(displayBrand), 100);
                  }}
                  className="inline-flex items-center gap-1.5 bg-card/40 backdrop-blur-xl border border-[hsl(var(--glass-border))] text-foreground px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-card/60 transition-colors"
                  title={`Re-scan ${displayBrandTitled}`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="text-xs">Re-scan</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 bg-card/40 backdrop-blur-xl border border-[hsl(var(--glass-border))] text-foreground px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-card/60 transition-colors"
                  title={t('dashboard_export_pdf')}
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span className="text-xs">{t('dashboard_export_pdf')}</span>
                </button>
                {result?.id && (
                  <button
                    type="button"
                    onClick={() => navigate(canCreateAudit ? `/audit/${result.id}` : '/pricing')}
                    className="inline-flex items-center gap-1.5 bg-card/40 backdrop-blur-xl border border-[hsl(var(--glass-border))] text-foreground px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-card/60 transition-colors disabled:opacity-50"
                    title={canCreateAudit ? 'Open as client-ready audit' : 'Client-ready audit — Agency plan only'}
                  >
                    {canCreateAudit ? <Presentation className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    <span className="text-xs">Client audit</span>
                  </button>
                )}
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex flex-wrap items-center gap-2 sm:max-w-md w-full"
              >
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="dashboard-brand-input"
                    name="brand"
                    type="text"
                    aria-label="Brand name to analyze"
                    value={inputValue}
                    onChange={(e) => { setInputValue(e.target.value); setModerationError(''); }}
                    placeholder={t('placeholderExample')}
                    className="w-full bg-card/40 backdrop-blur-xl border border-[hsl(var(--glass-border))] text-foreground placeholder:text-muted-foreground text-sm rounded-xl py-2.5 pl-10 pr-3 focus:outline-none focus:border-primary/40 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  {t('analyze')}
                </button>
              </form>
            )}
          </div>

          {moderationError && (
            <p className="text-xs text-destructive mt-1">{moderationError}</p>
          )}

          {/* Brand knowledge — only shown here (above results) before a
              result exists; once completed it moves below the score and
              action plan (see the results section), collapsed by default,
              so it stops pushing the actual scan below the fold. */}
          {status !== 'completed' && inputValue.trim().length > 1 && (
            <BrandKnowledgeForm brandName={inputValue} />
          )}

          {/* Guest limit banner */}
          {guestLimitReached && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t('dashboard_guest_title')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('dashboard_guest_desc')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/register"
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {t('dashboard_guest_register')}
                </Link>
                <Link
                  to="/pricing"
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[hsl(var(--glass-border))] text-foreground hover:bg-muted/40 transition-colors"
                >
                  {t('dashboard_guest_plans')}
                </Link>
              </div>
            </motion.div>
          )}
        </header>

        {/* Brewing State — live AI scan in progress. `queriedModels` mirrors
            exactly what startBrewing sends as `models` (loadModelPrefs().
            selected) — the same single source of truth the request body
            uses, so this screen can't show a model count that disagrees
            with what's actually being queried. */}
        {status === 'brewing' && (
          <BrewingProgress
            progress={progress}
            brandName={displayBrand}
            models={loadModelPrefs().selected.map(id => {
              const known = MODEL_CATALOG.find(m => m.id === id);
              return { id, label: known?.label ?? id };
            })}
            onCancel={reset}
          />
        )}

        {/* Loading State — fetching an already-saved report, not scanning */}
        {status === 'loading' && (
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {/* Error State — the scan itself failed; never fake a result here.
            Scanning paused by an admin is a maintenance state, not a fault:
            neutral styling, a clock instead of a warning triangle, and no
            "Try again" button (retrying can't help until it's turned back on). */}
        {status === 'error' && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4 px-4">
            <div className={cn(
              'w-12 h-12 rounded-xl border flex items-center justify-center',
              scansDisabled || notFound || providerUnavailable
                ? 'bg-muted border-border'
                : 'bg-destructive/10 border-destructive/20'
            )}>
              {scansDisabled || notFound || providerUnavailable
                ? <Clock className="w-5 h-5 text-muted-foreground" />
                : <AlertTriangle className="w-5 h-5 text-destructive" />}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {notFound ? 'Report not found' : scansDisabled ? 'Scanning is paused' : providerUnavailable ? 'Scanning is unavailable' : "Couldn't complete the scan"}
              </p>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
                {brewingError || 'Something went wrong while scanning. Please try again.'}
              </p>
            </div>
            {scansDisabled || notFound || providerUnavailable ? (
              // Retrying can't help, but the stored reports are unaffected —
              // without this the paused screen was a dead end.
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/reports"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <FileText className="w-3.5 h-3.5" /> View your saved reports
                </Link>
                <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Back to Home
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startBrewing(displayBrand)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {status === 'completed' && result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Hero band */}
            <ScoreHero
              result={result}
              t={t}
              previousScan={previousScan}
              onImproveAccuracy={() => setKbExpandSignal(v => v + 1)}
              plan={plan}
            />

            {/* Results by dimension + recommended actions — the concrete takeaway */}
            <div className="mb-5">
              <ResultsBreakdown result={result} />
            </div>

            {/* Raw model answers — the evidence behind every score above, and
                the landing page's single strongest claim ("raw model answers
                behind every metric"). Used to sit at the very bottom of the
                page, after every chart; moved directly under the action
                plan so it reads as core content, not an appendix. */}
            <div className="relative mb-5">
              <div className={canSeeSources ? '' : 'pointer-events-none blur-sm select-none'} aria-hidden={!canSeeSources}>
                <SourceTable sources={result.sources} />
              </div>
              {!canSeeSources && (
                <LockedOverlay
                  title={t('dashboard_locked_table_title')}
                  description={t('dashboard_locked_table_desc')}
                  onUpgrade={() => navigate('/pricing')}
                  t={t}
                />
              )}
            </div>

            {/* Answers "where does this number come from" right where people
                ask it — after seeing the raw model answers, before the score
                methodology gets buried under charts. */}
            <div className="mb-5">
              <ScoreMethodology sources={result.sources} />
            </div>

            {/* AVE, source identification, visibility gap analysis,
                hallucination alerts, agency reports — five supplementary
                cards below the fold, lazy-loaded as one group so their code
                only downloads once the reader actually scrolls this far
                (nothing here is needed for first paint of the score/action
                plan above). A blank placeholder for one paint frame while
                the chunk fetches is preferable to holding up everything
                above it. */}
            <Suspense fallback={null}>
              {/* AVE — a metric agencies get asked for, so it lives right next
                  to the methodology card that already explains what counts
                  as "favorable" here. See AveEstimate's own comment for why
                  the $/mention is the reader's input, not an invented
                  industry average presented as fact. */}
              <div className="mb-5">
                <AveEstimate sources={result.sources} />
              </div>

              {/* Which models answered, and how confidently — the honest
                  version of "source identification" this product's data can
                  actually support (see the component's own comment). */}
              <div className="mb-5">
                <SourceIdentification sources={result.sources} planTier={planTier} />
              </div>

              {/* Same five dimension scores as the breakdown above, read as a
                  quantified distance-to-target instead of a plain-English
                  action plan. */}
              <div className="mb-5">
                <VisibilityGapAnalysis result={result} />
              </div>

              {/* Accuracy-band + hedging-language flags — not a fact-check,
                  just the honest signals this scan's own data can support. */}
              <div className="mb-5">
                <HallucinationAlerts result={result} />
              </div>

              {/* Points at the existing "Client audit" toolbar action rather
                  than duplicating it. */}
              <div className="mb-5">
                <AgencyReportCallout resultId={result.id} canCreateAudit={canCreateAudit} />
              </div>
            </Suspense>

            {/* Brand knowledge — collapsed by default, moved here (after the
                score, the action plan and the raw model answers) instead of
                sitting expanded above everything else. Keyed to the actual
                displayed brand, not whatever's in the "scan a different
                brand" field. */}
            <div className="mb-5">
              <BrandKnowledgeForm brandName={displayBrand} forceExpandSignal={kbExpandSignal} />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-12 space-y-3">
                {/* Competitor comparison bar */}
                <div className="glass-card px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground shrink-0">
                    <Swords className="w-4 h-4 text-primary" />
                    {t('compare_title')}
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="relative flex-1 sm:max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        id="dashboard-competitor-input"
                        name="competitor"
                        aria-label="Competitor brand name"
                        value={competitorInput}
                        onChange={e => setCompetitorInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') runCompare(); }}
                        placeholder={t('compare_placeholder')}
                        className="w-full pl-8 h-9 text-sm rounded-lg border border-input bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                      />
                    </div>
                    <button
                      onClick={runCompare}
                      disabled={!competitorInput.trim()}
                      className="h-9 px-4 text-sm font-medium rounded-lg bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
                    >
                      {t('compare_action')}
                    </button>
                    {competitor && (
                      <button
                        onClick={clearCompare}
                        aria-label={t('compare_clear')}
                        className="h-9 w-9 flex items-center justify-center rounded-lg border border-input text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {competitor && (
                    <div className="text-sm shrink-0">
                      {(() => {
                        const diff = result.trustScore - competitor.trustScore;
                        const winning = diff >= 0;
                        return (
                          <span className={cn('font-medium', winning ? 'text-emerald-400' : 'text-red-400')}>
                            {winning ? '▲' : '▼'} {Math.abs(diff)} {t('compare_points')}
                            <span className="text-muted-foreground font-normal"> {winning ? t('compare_ahead') : t('compare_behind')} {competitor.brandName}</span>
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <RadarChartCard
                  dimensions={result.dimensions}
                  timestamp={result.timestamp}
                  brandName={result.brandName}
                  competitorDimensions={competitor?.dimensions}
                  competitorName={competitor?.brandName}
                />
              </div>
              <div className="col-span-12 lg:col-span-7 relative">
                <div className={canSeeCharts ? '' : 'pointer-events-none blur-sm select-none'} aria-hidden={!canSeeCharts}>
                  <SentimentChart data={result.sentimentTrend} />
                </div>
                {!canSeeCharts && (
                  <LockedOverlay
                    title={t('dashboard_locked_sentiment_title')}
                    description={t('dashboard_locked_sentiment_desc')}
                    onUpgrade={() => navigate('/pricing')}
                    t={t}
                  />
                )}
              </div>
              <div className="col-span-12 lg:col-span-5 relative">
                <div className={canSeeCharts ? '' : 'pointer-events-none blur-sm select-none'} aria-hidden={!canSeeCharts}>
                  <SourceDonutChart data={result.sourceBreakdown} />
                </div>
                {!canSeeCharts && (
                  <LockedOverlay
                    title={t('dashboard_locked_sources_title')}
                    description={t('dashboard_locked_sources_desc')}
                    onUpgrade={() => navigate('/pricing')}
                    t={t}
                  />
                )}
              </div>
              {/* Embeddable badge */}
              <div className="col-span-12">
                <div className="glass-card p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-medium text-foreground">{t('embed_title')}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">{t('embed_desc')}</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {badgeError ? (
                      // Graceful fallback so a failed badge fetch never shows a broken-image icon
                      <div className="h-9 shrink-0 inline-flex items-center gap-2 rounded-md border border-[hsl(var(--glass-border))] bg-background px-3">
                        <span className="w-3 h-3 rounded-full border-2 border-primary" />
                        <span className="text-[10px] font-data uppercase tracking-wider text-primary font-semibold">Presora</span>
                        <span className="text-[10px] text-muted-foreground">AI Visibility · {badgeBrand}</span>
                      </div>
                    ) : (
                      <img
                        src={badgeSrc}
                        alt="Presora AI Visibility badge"
                        height={36}
                        loading="lazy"
                        onError={() => setBadgeError(true)}
                        className="h-9 shrink-0"
                      />
                    )}
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <code className="flex-1 text-[11px] text-muted-foreground bg-background border border-input rounded-lg px-3 py-2 truncate font-data">
                        {embedCode}
                      </code>
                      <button
                        onClick={copyEmbed}
                        className="h-9 px-4 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
                      >
                        {copiedEmbed ? t('embed_copied') : t('embed_copy')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {status === 'completed' && result && isLoggedIn && <ResultChatWidget result={result} />}
    </div>
  );
};

export default Dashboard;
