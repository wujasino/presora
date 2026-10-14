import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, Bot, FileText, ArrowRight, ArrowUpRight, ArrowUp, ArrowDown,
  Lock, Sparkles, CalendarClock, ShieldCheck, Smile, Target, AtSign, Clock, RefreshCw, Plus, PauseCircle, AlertTriangle,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { CreditsUsageWidget } from '@/components/CreditsUsageWidget';
import { usePlan, tierOf, useSessionUser } from '@/hooks/useAccountInfo';
import { MODEL_CATALOG, loadModelPrefs, saveModelPrefs } from '@/lib/models';
import { BrandScanInput } from '@/components/BrandScanInput';
import { brandKey, dedupeAnalyses } from '@/lib/analyses';
import { useScanStatus } from '@/hooks/useScanStatus';
import { bandOf, BAND_LABEL, BAND_HEX, BAND_STYLE, type Band } from '@/lib/dimensionBands';
import { countActionPlanProgress } from '@/lib/actionPlanProgress';

interface Analysis {
  id: string;
  brand_name: string;
  trust_score: number;
  authority: number;
  sentiment: number;
  recency: number;
  mentions: number;
  accuracy: number;
  created_at: string;
  sources: { model: string; sentiment: string; association: string; confidence: number }[] | null;
  action_plan: { steps?: { title: string; priority?: string }[] } | null;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });


const DIMENSIONS: { key: keyof Pick<Analysis, 'authority' | 'sentiment' | 'accuracy' | 'mentions' | 'recency'>; label: string; Icon: typeof ShieldCheck }[] = [
  { key: 'authority', label: 'Authority', Icon: ShieldCheck },
  { key: 'sentiment', label: 'Sentiment', Icon: Smile },
  { key: 'accuracy', label: 'Accuracy', Icon: Target },
  { key: 'mentions', label: 'Mentions', Icon: AtSign },
  { key: 'recency', label: 'Recency', Icon: Clock },
];

// Shared with ResultsBreakdown.tsx, AuditReport.tsx and the Dashboard hero
// (src/lib/dimensionBands.ts) — one set of thresholds and words, so the same
// dimension score never reads "Strong" on one screen and something implying
// trouble on another. 4 tiers (Strong/Good/Weak/Critical, 90/75/60) instead
// of the old 3 (70/50), which painted a 71 and a 95 the same green.
const barColor = (s: number) => BAND_STYLE[bandOf(s)].meter;

/* ── Visibility health ring — at-a-glance donut of how many of the 5
   dimensions are Strong/Needs work/Critical, with the overall score in
   the center. Complements the linear dimension strip in the score card. */
const BAND_ORDER: Band[] = ['strong', 'good', 'weak', 'critical'];

const HealthRing = ({ analysis }: { analysis: Analysis }) => {
  const counts = useMemo(() => {
    const c: Record<Band, number> = { strong: 0, good: 0, weak: 0, critical: 0 };
    DIMENSIONS.forEach(({ key }) => { c[bandOf(analysis[key])] += 1; });
    return c;
  }, [analysis]);
  const data = BAND_ORDER
    .filter(b => counts[b] > 0)
    .map(b => ({ band: b, value: counts[b] }));

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--glass-border))] bg-card/60 px-3 py-2.5">
      <div className="relative w-11 h-11 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={14} outerRadius={20} paddingAngle={3} stroke="none">
              {data.map(d => <Cell key={d.band} fill={BAND_HEX[d.band]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-data font-semibold text-foreground">
          {analysis.trust_score}
        </span>
      </div>
      <div className="text-xs leading-tight">
        <p className="text-muted-foreground mb-1">Dimension health</p>
        {/* Spelled out rather than coloured dots with bare counts —
            "5 · 0 · 0" told the reader nothing without a legend. */}
        <div className="flex items-center gap-2 flex-wrap">
          {BAND_ORDER.filter(b => counts[b] > 0).map(b => (
            <span key={b} className="inline-flex items-center gap-1 text-muted-foreground whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: BAND_HEX[b] }} />
              {counts[b]} {BAND_LABEL[b].toLowerCase()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * "Tasks Status" — sits next to the dimension-health pie chart. Completed
 * count comes from the SAME localStorage progress AiActionPlan's checkboxes
 * write to (lib/actionPlanProgress) — nothing here is invented; if nothing
 * has an action plan yet, the caller just doesn't render this tile.
 */
const TasksStatusTile = ({ done, total }: { done: number; total: number }) => {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--glass-border))] bg-card/60 px-3 py-2.5">
      <div className="text-xs leading-tight">
        <p className="text-muted-foreground mb-1">Tasks status</p>
        <p className="text-foreground font-medium mb-1.5">{done}/{total} completed</p>
        <div className="h-1 w-24 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
};

/* ── 5-dimension mini breakdown — fills the score card with the data the
   analyses row already has, instead of leaving it visually empty next to
   the taller "By AI model" card. ────────────────────────────────────── */
const DimensionStrip = ({ analysis }: { analysis: Analysis }) => (
  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-5 border-t border-border">
    {DIMENSIONS.map(({ key, label, Icon }) => {
      const v = Math.round(analysis[key]);
      return (
        <div key={key}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">{label}</span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden mb-1">
            <div className={cn('h-full rounded-full', barColor(v))} style={{ width: `${v}%` }} />
          </div>
          <span className="text-xs font-data font-semibold tabular-nums text-foreground">{v}%</span>
        </div>
      );
    })}
  </div>
);

const scoreColor = (s: number) =>
  s >= 75 ? 'text-emerald-600 dark:text-emerald-400'
    : s >= 60 ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

/* ── Mini sparkline ─────────────────────────────────────────────────── */
/* A bare polyline with no axis, no dates and no scale said nothing. It now
   names what it covers, anchors the ends with their values, and exposes each
   point on hover. */
const Sparkline = ({ points }: { points: { trust_score: number; created_at: string }[] }) => {
  if (points.length < 2) return null;
  const values = points.map(p => p.trust_score);
  const w = 120, h = 32, pad = 4;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const coord = (v: number, i: number) => ({
    x: pad + (i / (values.length - 1)) * (w - pad * 2),
    y: h - pad - ((v - min) / range) * (h - pad * 2),
  });
  const pts = values.map((v, i) => { const c = coord(v, i); return `${c.x.toFixed(1)},${c.y.toFixed(1)}`; }).join(' ');

  return (
    <div className="flex flex-col items-end gap-0.5">
      <svg width={w} height={h} className="overflow-visible" role="img"
           aria-label={`Trust score across the last ${points.length} scans of this brand`}>
        <polyline points={pts} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((v, i) => {
          const c = coord(v, i);
          return (
            <circle key={i} cx={c.x} cy={c.y} r={i === values.length - 1 ? 3 : 5}
                    fill={i === values.length - 1 ? 'hsl(var(--primary))' : 'transparent'}>
              <title>{`${v}/100 — ${formatDate(points[i].created_at)}`}</title>
            </circle>
          );
        })}
      </svg>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        last {points.length} scans · {min}–{max}
      </span>
    </div>
  );
};

/* ── Delta pill (semantic colours: up = green, down = red) ──────────── */
const Delta = ({ value, since }: { value: number | null; since?: string }) => {
  if (value === null) return <span className="text-xs text-muted-foreground">First scan</span>;
  // "vs <date>" everywhere a delta appears — "down 6 pts" against an unstated
  // baseline is unreadable, and it was the same complaint on the score card
  // and in the recent-reports list.
  const vs = since ? <span className="text-xs text-muted-foreground ml-1.5">vs {formatDate(since)}</span> : null;
  if (value === 0) return <span className="text-xs text-muted-foreground">No change{vs}</span>;
  const up = value > 0;
  return (
    <span className="inline-flex items-center whitespace-nowrap">
      <span className={cn(
        'inline-flex items-center gap-0.5 text-xs font-semibold rounded-full px-2 py-0.5',
        up ? 'text-emerald-700 bg-emerald-500/10 dark:text-emerald-400'
           : 'text-red-700 bg-red-500/10 dark:text-red-400'
      )}>
        {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        {Math.abs(value)} pts
      </span>
      {vs}
    </span>
  );
};

const HomeHub = () => {
  const navigate = useNavigate();
  const [analysesLoading, setAnalysesLoading] = useState(true);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [competitors, setCompetitors] = useState<{ brand_key: string; competitor_name: string; last_score: number | null }[]>([]);
  const { data: plan = 'Free' } = usePlan();
  const planTier = tierOf(plan);
  const { enabled: scanningEnabled } = useScanStatus();
  const visibleModels = MODEL_CATALOG.filter(m => m.tier <= planTier);
  const lockedModels = MODEL_CATALOG.filter(m => m.tier > planTier);

  // Reuse the already-cached (react-query) session instead of calling
  // supabase.auth.getUser() here — getUser() re-verifies the token with a
  // network round trip to the Auth server on every mount, which was making
  // this the slowest thing on the page. getSession() (what useSessionUser
  // uses) reads the already-validated local session instead.
  const { data: sessionUser, isLoading: userLoading } = useSessionUser();
  const userId = sessionUser?.id ?? null;

  useEffect(() => {
    if (userLoading) return;
    if (!userId) { setAnalysesLoading(false); return; }
    let active = true;
    setAnalysesLoading(true);
    supabase
      .from('analyses')
      .select('id, brand_name, trust_score, authority, sentiment, recency, mentions, accuracy, created_at, sources, action_plan')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (active) { setAnalyses(dedupeAnalyses((data as Analysis[]) ?? [])); setAnalysesLoading(false); }
      });
    // Best-known competitor score per brand, for the head-to-head shown in
    // "Recent reports" — a real, previously-scanned number (scan-competitor.js
    // via /competitor-tracker), never invented here. Silently empty for an
    // account with none tracked, or if the table isn't migrated yet.
    supabase
      .from('tracked_competitors')
      .select('brand_key, competitor_name, last_score')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (active) setCompetitors((data as typeof competitors) ?? []);
      });
    return () => { active = false; };
  }, [userId, userLoading]);

  // Toughest tracked rival per brand (highest real last_score) — one line,
  // not a table, so only the most relevant comparison is shown inline.
  const bestCompetitorByBrand = useMemo(() => {
    const map = new Map<string, { competitor_name: string; last_score: number }>();
    for (const c of competitors) {
      if (c.last_score === null) continue;
      const existing = map.get(c.brand_key);
      if (!existing || c.last_score > existing.last_score) {
        map.set(c.brand_key, { competitor_name: c.competitor_name, last_score: c.last_score });
      }
    }
    return map;
  }, [competitors]);

  const loading = userLoading || analysesLoading;

  const latest = analyses[0] ?? null;

  /**
   * Previous scan **of the same brand**, not simply the previous row.
   *
   * This compared analyses[0] against analyses[1] regardless of brand, so a
   * Coca-Cola scan could be diffed against a Tesla one. That's why the same
   * score showed two different deltas on two different days: the baseline was
   * whatever happened to be scanned before it.
   */
  const previousForLatest = useMemo(() => {
    if (!latest) return null;
    const key = brandKey(latest.brand_name);
    return analyses.slice(1).find(a => brandKey(a.brand_name) === key) ?? null;
  }, [latest, analyses]);

  const delta = latest && previousForLatest ? latest.trust_score - previousForLatest.trust_score : null;

  // Sparkline must track one brand too — a line hopping between brands is a
  // shape with no meaning.
  const sparkPoints = useMemo(() => {
    if (!latest) return [];
    const key = brandKey(latest.brand_name);
    return analyses
      .filter(a => brandKey(a.brand_name) === key)
      .slice(0, 8)
      .reverse();
  }, [analyses, latest]);

  // Plan-unlocked models with no confidence data in the latest scan — either
  // deselected in Settings' model picker, or (for older rows) the scan
  // predates `sources` being persisted at all. Surfaced below so "why does
  // this only show 3 of 6 models" is self-explanatory instead of a silent
  // row of dashes.
  const skippedVisibleModels = useMemo(
    () => (latest ? visibleModels.filter(m => !latest.sources?.some(s => s.model === m.label)) : []),
    [latest, visibleModels]
  );

  /**
   * The single most urgent thing on the page, surfaced above the fold
   * instead of waiting at the bottom in "Recent reports". Two real sources,
   * checked in order — never a filler alert when nothing is actually wrong:
   *
   * 1. A real week-over-week confidence drop for one model, on the same
   *    brand (same previousForLatest comparison the score card's delta
   *    already uses) — the most concrete, current signal.
   * 2. Otherwise, the highest-priority step of the most recent scan that
   *    already has a generated AI action plan (never triggers generation
   *    itself — only surfaces one that's already cached on the row).
   */
  const topAlert = useMemo(() => {
    if (latest?.sources && previousForLatest?.sources) {
      let worst: { model: string; drop: number } | null = null;
      for (const s of latest.sources) {
        const prevS = previousForLatest.sources.find(p => p.model === s.model);
        if (!prevS) continue;
        const drop = prevS.confidence - s.confidence;
        if (drop > 0 && (!worst || drop > worst.drop)) worst = { model: s.model, drop };
      }
      if (worst && worst.drop >= 10) {
        return {
          id: latest.id,
          text: `Your visibility on ${worst.model} dropped by ${Math.round(worst.drop)}% this week.`,
        };
      }
    }
    const withPlan = analyses.find(a => (a.action_plan?.steps?.length ?? 0) > 0);
    if (withPlan?.action_plan?.steps) {
      const step = withPlan.action_plan.steps.find(s => s.priority === 'high') ?? withPlan.action_plan.steps[0];
      return {
        id: withPlan.id,
        text: `${step.title} — ${withPlan.brand_name} is losing ground in AI results.`,
      };
    }
    return null;
  }, [latest, previousForLatest, analyses]);

  // Real completed/total count from AiActionPlan's persisted checkboxes,
  // summed across every scan that actually has a generated plan — reads
  // localStorage, so it's 0/0 (tile hidden) until at least one plan exists.
  const taskProgress = useMemo(
    () => countActionPlanProgress(
      analyses
        .filter(a => (a.action_plan?.steps?.length ?? 0) > 0)
        .map(a => ({ id: a.id, totalSteps: a.action_plan!.steps!.length }))
    ),
    [analyses]
  );

  const runScan = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    navigate(`/brand-visibility?brand=${encodeURIComponent(v)}`);
  };

  /**
   * Turns a skipped model back on and immediately re-runs the scan.
   *
   * "3 of 6 available models weren't queried — review your selection in
   * Settings" was 11px of grey text pointing at a different page, for what is
   * the most consequential fact on the screen: the picture of the brand is
   * incomplete. One click does the whole thing instead.
   */
  const enableModelsAndRescan = (ids: string[]) => {
    if (!latest || !scanningEnabled) return;
    const prefs = loadModelPrefs();
    saveModelPrefs({ selected: Array.from(new Set([...prefs.selected, ...ids])) });
    runScan(latest.brand_name);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

        {/* ── Header: title + credits/plan at a glance ────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-display text-foreground">Home</h1>
              {/* Running a scan is the whole product and had no button
                  anywhere on this page — only a sidebar link and a card at
                  the very bottom. */}
              {scanningEnabled ? (
                <Link
                  to="/brand-visibility"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Search className="w-3.5 h-3.5" /> Run new scan
                </Link>
              ) : (
                <span
                  title="Scanning is paused — your saved reports are still available"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-muted-foreground text-sm font-medium cursor-not-allowed"
                >
                  <PauseCircle className="w-3.5 h-3.5" /> Scanning paused
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1.5">Your AI visibility, at a glance.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3">
            {latest && <HealthRing analysis={latest} />}
            {taskProgress.total > 0 && <TasksStatusTile done={taskProgress.done} total={taskProgress.total} />}
            <CreditsUsageWidget />
          </div>
        </div>

        {/* Told up front rather than after a failed scan — the reports below
            are unaffected, so the honest framing is "read-only for now", not
            "something went wrong". */}
        {!scanningEnabled && (
          <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/6 p-4 flex items-start gap-3">
            <PauseCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">New scans are paused</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Everything already scanned stays available — scores, per-model breakdowns and
                reports all still open normally. New scans resume once scanning is switched
                back on.
              </p>
              <Link to="/reports" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2">
                Browse your reports <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* ── State: loading / empty / populated ──────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-40 rounded-2xl border border-border bg-card/40 animate-pulse" />
            ))}
          </div>
        ) : !latest ? (
          <EmptyState onScan={runScan} onDemo={() => runScan('Nike')} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
            {/* Score card — the reason people come back */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 rounded-2xl border border-border bg-card/60 p-6 flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">AI visibility score</p>
                  <p className="text-lg font-semibold text-foreground">{latest.brand_name}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="w-3.5 h-3.5" /> {formatDate(latest.created_at)}
                </div>
              </div>
              <div className="flex items-end gap-4">
                <span className={cn('text-5xl font-display font-semibold tabular-nums leading-none', scoreColor(latest.trust_score))}>
                  {latest.trust_score}
                </span>
                <span className="text-lg text-muted-foreground mb-1">/100</span>
                <div className="mb-1"><Delta value={delta} since={previousForLatest?.created_at} /></div>
                <div className="ml-auto mb-0.5"><Sparkline points={sparkPoints} /></div>
              </div>

              <DimensionStrip analysis={latest} />

              <Link
                to={`/brand-visibility?id=${latest.id}`}
                className="mt-5 inline-flex items-center gap-1 text-sm text-primary font-medium hover:gap-1.5 transition-all w-fit"
              >
                View full report <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>

            {/* Per-model breakdown + upsell */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="rounded-2xl border border-border bg-card/60 p-6"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">By AI model</p>
              <div className="space-y-2.5">
                {visibleModels.map((m) => {
                  // Real per-model confidence from the scan, when this report has it
                  // (sources wasn't persisted before this was added — older rows are
                  // null). Never fabricate a number for a model that wasn't actually
                  // queried — offer "Enable & rescan" (or "not queried" while
                  // scanning is paused) instead of a misleading fake bar.
                  const source = latest.sources?.find(s => s.model === m.label);
                  const conf = source ? Math.max(0, Math.min(100, Math.round(source.confidence))) : null;
                  return (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className={cn('text-sm w-20 shrink-0', conf !== null ? 'text-foreground' : 'text-muted-foreground')}>{m.label}</span>
                      {conf !== null ? (
                        <>
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary/70" style={{ width: `${conf}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-7 text-right tabular-nums">{conf}</span>
                        </>
                      ) : scanningEnabled ? (
                        <button
                          onClick={() => enableModelsAndRescan([m.id])}
                          className="flex-1 inline-flex items-center justify-end gap-1 text-xs text-primary hover:underline"
                        >
                          <Plus className="w-3 h-3" /> Enable &amp; rescan
                        </button>
                      ) : (
                        // A button that can't do anything is worse than none:
                        // while scanning is paused this reads as "not in this
                        // scan" rather than offering an action that no-ops.
                        <span className="flex-1 text-right text-xs text-muted-foreground">not queried</span>
                      )}
                    </div>
                  );
                })}
                {lockedModels.map(m => (
                  <Link key={m.id} to="/pricing" className="flex items-center gap-3 group opacity-60 hover:opacity-100 transition-opacity">
                    <span className="text-sm text-muted-foreground w-20 shrink-0">{m.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden" />
                    <Lock className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
              {skippedVisibleModels.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/6 p-3">
                  <p className="text-xs text-foreground">
                    Incomplete picture — {skippedVisibleModels.length} of {visibleModels.length} models
                    you already pay for weren't asked about {latest.brand_name}.
                  </p>
                  {scanningEnabled ? (
                    <button
                      onClick={() => enableModelsAndRescan(skippedVisibleModels.map(m => m.id))}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <RefreshCw className="w-3 h-3" /> Enable all &amp; rescan
                    </button>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      You can add them once scanning resumes.
                    </p>
                  )}
                </div>
              )}
              {lockedModels.length > 0 && (
                <Link to="/pricing" className="mt-4 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Unlock all {MODEL_CATALOG.length} models <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </motion.div>
          </div>
        )}

        {/* ── Recent alerts ────────────────────────────────────────
            The most urgent thing on the page, above "Recent reports" —
            those already existed but sat at the bottom of the screen with
            no single item calling out what actually needs attention now. */}
        {!loading && topAlert && (
          <Link
            to={`/brand-visibility?id=${topAlert.id}`}
            className="mb-6 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/6 px-4 py-3 hover:bg-amber-500/10 transition-colors group"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-sm text-foreground flex-1 min-w-0 truncate">
              <span className="font-semibold">Action required:</span> {topAlert.text}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 shrink-0">
              Fix this now <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        )}

        {/* ── Recent reports ──────────────────────────────────────── */}
        {!loading && analyses.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Recent reports</h2>
              <Link to="/reports" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="rounded-2xl border border-border bg-card/40 divide-y divide-border overflow-hidden">
              {analyses.slice(0, 5).map((a, i) => {
                const prev = analyses.slice(i + 1).find(p => brandKey(p.brand_name) === brandKey(a.brand_name));
                const d = prev ? a.trust_score - prev.trust_score : null;
                const rival = bestCompetitorByBrand.get(brandKey(a.brand_name));
                return (
                  <Link
                    key={a.id}
                    to={`/brand-visibility?id=${a.id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors group"
                  >
                    {rival ? (
                      <span className="flex items-baseline gap-1 w-24 shrink-0" title={`${a.brand_name} vs ${rival.competitor_name}`}>
                        <span className={cn('text-lg font-display font-semibold tabular-nums', scoreColor(a.trust_score))}>{a.trust_score}</span>
                        <span className="text-xs text-muted-foreground">vs</span>
                        <span className={cn('text-sm font-data font-semibold tabular-nums', rival.last_score > a.trust_score ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                          {rival.last_score}
                        </span>
                      </span>
                    ) : (
                      <span className={cn('text-lg font-display font-semibold tabular-nums w-10', scoreColor(a.trust_score))}>{a.trust_score}</span>
                    )}
                    <span className="text-sm text-foreground font-medium flex-1 min-w-0 truncate">{a.brand_name}</span>
                    <Delta value={d} since={prev?.created_at} />
                    <span className="hidden sm:block text-xs text-muted-foreground w-24 text-right">{formatDate(a.created_at)}</span>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Continue where you left off ──────────────────────────
            Replaces a "Tools" block that repeated Brand Scan / Automations /
            Reports — the three entries already sitting in the sidebar two
            inches to the left. Half a screen that added nothing. This offers
            the next action on brands already scanned instead. */}
        {!loading && latest && scanningEnabled && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Continue where you left off</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => runScan(latest.brand_name)}
                className="group flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/6 p-4 text-left transition-all duration-200 hover:border-primary/60 hover:-translate-y-0.5"
              >
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/15 shrink-0">
                  <RefreshCw className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">Re-scan {latest.brand_name}</h3>
                  <p className="text-xs text-muted-foreground">Last scanned {formatDate(latest.created_at)}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-primary shrink-0 transition-transform group-hover:translate-x-1" />
              </button>

              <Link
                to="/automations"
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-4 transition-all duration-200 hover:border-primary/40 hover:-translate-y-0.5"
              >
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-muted shrink-0">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">Track it automatically</h3>
                  <p className="text-xs text-muted-foreground truncate">Set up weekly monitoring by chat.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Empty state: one screen, one CTA, plus a demo ──────────────────── */
const EmptyState = ({ onScan, onDemo }: { onScan: (brand: string) => void; onDemo: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
    className="rounded-2xl border border-border bg-card/40 p-10 sm:p-14 text-center mb-10"
  >
    <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
      <Sparkles className="w-6 h-6 text-primary" />
    </div>
    <h2 className="text-xl sm:text-2xl font-display text-foreground mb-2">No scans yet</h2>
    <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
      Run your first scan to see how AI models describe your brand — a visibility score, a per-model breakdown, and what to do next.
    </p>
    <BrandScanInput onSubmit={onScan} className="max-w-md mx-auto" />
    <button
      onClick={onDemo}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-4 transition-colors"
    >
      or see a sample — Nike demo <ArrowRight className="w-3 h-3" />
    </button>
  </motion.div>
);

export default HomeHub;
export { HomeHub };
