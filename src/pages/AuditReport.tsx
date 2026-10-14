import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, Smile, Target, AtSign, Clock, Printer, ArrowLeft, Loader2, AlertTriangle, Sparkles, Mail, Lock, Quote, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Wordmark } from '@/components/Wordmark';
import { Button } from '@/components/ui/button';
import { usePlan, isAgencyPlan } from '@/hooks/useAccountInfo';
import { useAuditBranding } from '@/hooks/useAuditBranding';
import { bandOf as dimBandOf } from '@/lib/dimensionBands';

interface AnalysisRow {
  id: string;
  brand_name: string;
  trust_score: number;
  authority: number;
  sentiment: number;
  recency: number;
  mentions: number;
  accuracy: number;
  created_at: string;
  sources: { model: string; sentiment: string; confidence: number; association?: string }[] | null;
  audit_summary: AuditSummary | null;
}

interface AuditSummary {
  headline: string;
  businessImpact: string;
  narrative: string;
  competitivePosition: string;
  recommendations: { title: string; description: string; priority: 'high' | 'medium' | 'low' }[];
}

// `what` is printed in the methodology section. An agency forwarding this to
// a client gets asked "what does Authority actually mean?" — the report has
// to answer that on its own, without anyone opening Presora.
const DIMENSIONS: { key: keyof AnalysisRow; Icon: typeof ShieldCheck; name: string; what: string }[] = [
  { key: 'authority', Icon: ShieldCheck, name: 'Authority', what: 'How confidently the models treat the brand as a credible, established name in its category.' },
  { key: 'sentiment', Icon: Smile, name: 'Sentiment', what: 'Whether the language the models use about the brand is positive, neutral or negative.' },
  { key: 'accuracy', Icon: Target, name: 'Accuracy', what: 'How factually correct the models are about what the brand actually does and sells.' },
  { key: 'mentions', Icon: AtSign, name: 'Mentions', what: 'How readily the brand comes up at all when the models are asked about this category.' },
  { key: 'recency', Icon: Clock, name: 'Recency', what: 'How current the models’ knowledge is — whether they know the brand as it is today.' },
];

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-red-500/10 text-red-500 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  low: 'bg-muted text-muted-foreground border-border',
};

const scoreColor = (s: number) =>
  s >= 75 ? 'text-emerald-500' : s >= 50 ? 'text-amber-500' : 'text-red-500';

const scoreLabel = (s: number) => (s >= 75 ? 'Strong' : s >= 50 ? 'Developing' : 'Needs attention');

// 75/50 bands for the OVERALL trust score ring/pill only — a coarser,
// 3-tier "headline verdict" concept (Strong/Developing/Needs attention),
// deliberately distinct from the per-dimension bands below. "mid" is amber,
// not the app's --primary (graphite, buttons/links only) — the score needs
// 3 visually distinct tiers, and graphite would look like "no color"
// between the emerald/red tiers.
const BAND_STYLE = {
  strong: { bar: 'bg-emerald-500 print:bg-black/70', chip: 'bg-emerald-500/10 text-emerald-500 print:bg-transparent print:text-black/70', pill: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', ring: 'border-emerald-500 text-emerald-500 print:border-black/20' },
  mid: { bar: 'bg-amber-500 print:bg-black/70', chip: 'bg-amber-500/10 text-amber-500 print:bg-transparent print:text-black/70', pill: 'bg-amber-500/10 text-amber-500 border-amber-500/20', ring: 'border-amber-500 text-amber-500 print:border-black/20' },
  low: { bar: 'bg-red-500 print:bg-black/70', chip: 'bg-red-500/10 text-red-500 print:bg-transparent print:text-black/70', pill: 'bg-red-500/10 text-red-500 border-red-500/20', ring: 'border-red-500 text-red-500 print:border-black/20' },
} as const;
const bandOf = (s: number) => (s >= 75 ? BAND_STYLE.strong : s >= 50 ? BAND_STYLE.mid : BAND_STYLE.low);

// Per-DIMENSION bands: shared thresholds from src/lib/dimensionBands.ts (the
// same 90/75/60 the live scan screen and Home use), print-safe classes kept
// local since that shared module has no print: variants. Previously reused
// the 75/50 3-tier map above for individual dimensions too, so a 71%
// dimension could read "Strong" on the client-facing PDF while the exact
// same 71% read "Weak" on the live scan screen the agency generated it
// from — a client comparing the two would catch the contradiction.
const DIM_BAND_STYLE = {
  strong:   { bar: 'bg-emerald-500 print:bg-black/70', chip: 'bg-emerald-500/10 text-emerald-500 print:bg-transparent print:text-black/70' },
  good:     { bar: 'bg-sky-500 print:bg-black/50',     chip: 'bg-sky-500/10 text-sky-500 print:bg-transparent print:text-black/50' },
  weak:     { bar: 'bg-amber-500 print:bg-black/70',   chip: 'bg-amber-500/10 text-amber-500 print:bg-transparent print:text-black/70' },
  critical: { bar: 'bg-red-500 print:bg-black/70',     chip: 'bg-red-500/10 text-red-500 print:bg-transparent print:text-black/70' },
} as const;

const SENTIMENT_STYLE: Record<string, string> = {
  positive: 'text-emerald-500',
  neutral: 'text-amber-500',
  negative: 'text-red-500',
};
const sentimentDotClass = (sentiment: string) => {
  const key = sentiment.toLowerCase();
  return key.includes('positive') ? 'bg-emerald-500' : key.includes('negative') ? 'bg-red-500' : 'bg-amber-500';
};
const sentimentTextClass = (sentiment: string) => {
  const key = sentiment.toLowerCase();
  return SENTIMENT_STYLE[key] ?? (key.includes('positive') ? SENTIMENT_STYLE.positive : key.includes('negative') ? SENTIMENT_STYLE.negative : SENTIMENT_STYLE.neutral);
};

// Keeps a card from being split across two printed pages. Tailwind's
// break-inside-avoid only emits the modern property; older print engines
// still want page-break-inside, so both go on via a plain class string.
const NO_SPLIT = 'break-inside-avoid [page-break-inside:avoid]';

const AuditReport = () => {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<AnalysisRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const { data: plan = 'Free' } = usePlan();
  const { data: branding } = useAuditBranding();
  const canAccess = isAgencyPlan(plan);

  useEffect(() => {
    (async () => {
      if (!id) return;
      // Client-ready audit export is an Agency-plan feature — direct-link
      // access from a non-agency account stops here (server-side enforced
      // too: generate-audit-summary.js rejects non-agency callers).
      if (!canAccess) { setLoading(false); return; }
      const { data, error: fetchError } = await supabase
        .from('analyses')
        .select('id, brand_name, trust_score, authority, sentiment, recency, mentions, accuracy, created_at, sources, audit_summary')
        .eq('id', id)
        .single();

      if (fetchError || !data) {
        setError('This report could not be found, or you don\'t have access to it.');
        setLoading(false);
        return;
      }
      setAnalysis(data as AnalysisRow);
      setLoading(false);

      if (!data.audit_summary) {
        setGenerating(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch('/.netlify/functions/generate-audit-summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            body: JSON.stringify({ analysisId: id }),
          });
          const json = await res.json();
          if (res.ok) {
            setAnalysis(prev => prev ? { ...prev, audit_summary: json.summary } : prev);
          }
        } catch {
          // Non-fatal — the score/dimension breakdown below still renders
          // without the narrative section.
        } finally {
          setGenerating(false);
        }
      }
    })();
  }, [id, canAccess]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4 text-center">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Lock className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Client-ready audits are an Agency-plan feature</p>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Upgrade to Agency to export a branded, print-ready AI visibility audit for your clients.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/pricing" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            See Agency plan
          </Link>
          <Link to="/reports" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Back to reports</Link>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4 text-center">
        <AlertTriangle className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
        <Link to="/reports" className="text-sm text-primary hover:underline">Back to reports</Link>
      </div>
    );
  }

  const summary = analysis.audit_summary;
  const scannedAt = new Date(analysis.created_at);
  const modelsQueried = (analysis.sources ?? []).map(s => s.model);
  // The scan's own id, shortened — gives the client something to quote back
  // when they ask for the audit to be re-run and compared.
  const referenceId = analysis.id.slice(0, 8).toUpperCase();

  // Strongest/weakest dimension for the "at a glance" strip — a busy reader
  // (an agency's own client, forwarded this PDF cold) gets the gist in three
  // numbers before reading a word of the narrative. Derived from the same
  // scores already on the page, not a separate claim that could disagree
  // with the breakdown below it.
  const rankedDimensions = DIMENSIONS
    .map(d => ({ ...d, value: analysis[d.key] as number }))
    .sort((a, b) => b.value - a.value);
  const strongestDimension = rankedDimensions[0];
  const weakestDimension = rankedDimensions[rankedDimensions.length - 1];

  // Real proportional ring (SVG stroke-dasharray), not just a flat colored
  // border — the single most important number in the report should read as
  // "72% of the way around a circle," not just "green-ish."
  const RING_RADIUS = 42;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  const ringOffset = RING_CIRCUMFERENCE * (1 - analysis.trust_score / 100);

  return (
    <div className="print-exact min-h-screen print:min-h-0 print:h-auto bg-background print:bg-white">
      {/* Screen-only toolbar — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
        <Link to="/reports" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to reports
        </Link>
        <div className="flex items-center gap-3">
          {!branding.isWhiteLabeled && (
            <Link to="/audit-branding" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Add your own branding
            </Link>
          )}
          <Button size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-12 print:py-0 print:px-0">
        {/* Letterhead — the agency's identity when they've set one, ours otherwise */}
        <div className="flex items-center justify-between gap-4 mb-6 print:mb-6">
          {branding.isWhiteLabeled ? (
            <div className="flex items-center gap-2.5 min-w-0">
              {branding.logoUrl && (
                <img src={branding.logoUrl} alt="" className="h-8 w-auto max-w-[140px] object-contain shrink-0" />
              )}
              <span className="text-lg font-display font-semibold text-foreground print:text-black truncate">
                {branding.name}
              </span>
            </div>
          ) : (
            <Wordmark className="text-xl print:text-black!" />
          )}
          <p className="text-xs text-muted-foreground print:text-black/60 text-right shrink-0">
            AI Visibility Audit · {scannedAt.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="h-px bg-linear-to-r from-primary/40 via-border to-transparent print:from-black/30 print:via-black/10 mb-8" />

        <h1 className="text-3xl sm:text-4xl font-display text-foreground print:text-black mb-2">
          {analysis.brand_name}
        </h1>
        <p className="text-sm text-muted-foreground print:text-black/70 mb-4">
          How ChatGPT, Claude, Gemini and other AI models see this brand right now.
        </p>

        {/* Prepared-for / prepared-by strip. An audit that names its author and
            carries a reference number reads as a deliverable, not an export. */}
        <div className={`flex flex-wrap gap-x-8 gap-y-2 text-xs mb-8 pb-6 border-b border-border print:border-black/10 ${NO_SPLIT}`}>
          <div>
            <p className="uppercase tracking-wider text-muted-foreground print:text-black/50">Subject</p>
            <p className="text-foreground print:text-black mt-0.5 font-medium">{analysis.brand_name}</p>
          </div>
          <div>
            <p className="uppercase tracking-wider text-muted-foreground print:text-black/50">Prepared by</p>
            <p className="text-foreground print:text-black mt-0.5 font-medium">{branding.name ?? 'Presora'}</p>
          </div>
          <div>
            <p className="uppercase tracking-wider text-muted-foreground print:text-black/50">Data collected</p>
            <p className="text-foreground print:text-black mt-0.5 font-medium">
              {scannedAt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div>
            <p className="uppercase tracking-wider text-muted-foreground print:text-black/50">Reference</p>
            <p className="text-foreground print:text-black mt-0.5 font-medium tabular-nums">{referenceId}</p>
          </div>
        </div>

        {/* Headline score */}
        <div className={`relative overflow-hidden rounded-2xl border border-border bg-card/60 print:bg-transparent print:border-black/15 p-6 mb-4 flex items-center gap-6 ${NO_SPLIT}`}>
          <div className={`print:hidden absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20 ${scoreColor(analysis.trust_score).replace('text-', 'bg-')}`} />
          <div className="relative shrink-0 w-24 h-24">
            <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
              <circle cx="50" cy="50" r={RING_RADIUS} fill="none" strokeWidth="7" className="stroke-muted print:stroke-black/10" />
              <circle
                cx="50" cy="50" r={RING_RADIUS} fill="none" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
                className={`${scoreColor(analysis.trust_score).replace('text-', 'stroke-')} print:stroke-black/70 transition-[stroke-dashoffset] duration-700`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-display font-bold tabular-nums">{analysis.trust_score}</span>
            </div>
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground print:text-black/60">Trust score / 100</p>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-medium ${bandOf(analysis.trust_score).pill} print:border-black/20 print:bg-transparent print:text-black/70`}>
                {scoreLabel(analysis.trust_score)}
              </span>
            </div>
            {generating ? (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Writing executive summary…
              </p>
            ) : summary ? (
              <p className="text-base font-medium text-foreground print:text-black mt-1">{summary.headline}</p>
            ) : null}
          </div>
        </div>

        {/* At a glance — three numbers a reader who never gets past the top
            of page one still walks away with. Every figure here already
            appears elsewhere on the page (models queried in the methodology
            section, both dimensions in the breakdown below), so nothing
            here can contradict the detail underneath it. */}
        <div className={`flex flex-wrap gap-x-8 gap-y-2 text-xs mb-8 pb-6 border-b border-border print:border-black/10 ${NO_SPLIT}`}>
          <div>
            <p className="uppercase tracking-wider text-muted-foreground print:text-black/50">Models queried</p>
            <p className="text-foreground print:text-black mt-0.5 font-medium tabular-nums">{modelsQueried.length || '—'}</p>
          </div>
          <div>
            <p className="uppercase tracking-wider text-muted-foreground print:text-black/50">Strongest dimension</p>
            <p className="text-foreground print:text-black mt-0.5 font-medium">{strongestDimension.name} · {strongestDimension.value}</p>
          </div>
          <div>
            <p className="uppercase tracking-wider text-muted-foreground print:text-black/50">Needs attention</p>
            <p className="text-foreground print:text-black mt-0.5 font-medium">{weakestDimension.name} · {weakestDimension.value}</p>
          </div>
        </div>

        {/* Business impact + narrative */}
        {summary && (
          <div className="space-y-5 mb-10">
            <section className={NO_SPLIT}>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground print:text-black/60 mb-1.5">Why this matters</h2>
              <p className="text-sm text-foreground/90 print:text-black leading-relaxed">{summary.businessImpact}</p>
            </section>
            <section className={NO_SPLIT}>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground print:text-black/60 mb-1.5">What the numbers show</h2>
              <p className="text-sm text-foreground/90 print:text-black leading-relaxed">{summary.narrative}</p>
            </section>
            <section className={NO_SPLIT}>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground print:text-black/60 mb-1.5">Competitive position</h2>
              <p className="text-sm text-foreground/90 print:text-black leading-relaxed">{summary.competitivePosition}</p>
            </section>
          </div>
        )}

        {/* Dimension breakdown */}
        <section className={`mb-10 ${NO_SPLIT}`}>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground print:text-black/60 mb-3">Dimension breakdown</h2>
          <div className="space-y-3">
            {DIMENSIONS.map(({ key, Icon, name }) => {
              const value = analysis[key] as number;
              const band = DIM_BAND_STYLE[dimBandOf(value)];
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${band.chip}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm text-foreground print:text-black w-24 shrink-0">{name}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted print:bg-black/10 overflow-hidden">
                    <div className={`h-full rounded-full ${band.bar}`} style={{ width: `${value}%` }} />
                  </div>
                  <span className="text-sm font-medium text-foreground print:text-black w-10 text-right tabular-nums">{value}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground print:text-black/50 mt-3">
            Bands: 75–100 strong · 50–74 developing · 0–49 needs attention. Each dimension is defined
            under “How this was measured”.
          </p>
        </section>

        {/* Per-model breakdown — including what each model actually associates
            the brand with, which is the evidence behind the numbers above. */}
        {analysis.sources && analysis.sources.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground print:text-black/60 mb-3">What each AI model says</h2>
            <div className="space-y-2">
              {analysis.sources.map(s => (
                <div key={s.model} className={`rounded-xl border border-border/60 print:border-black/10 px-4 py-3 ${NO_SPLIT}`}>
                  <div className="flex items-center justify-between text-sm gap-3">
                    <span className="text-foreground print:text-black font-medium">{s.model}</span>
                    <span className="flex items-center gap-1.5 text-muted-foreground print:text-black/60 shrink-0">
                      <span className={`w-1.5 h-1.5 rounded-full print:hidden ${sentimentDotClass(s.sentiment)}`} />
                      <span className={`${sentimentTextClass(s.sentiment)} print:text-black/70 font-medium`}>{s.sentiment}</span>
                      · {Math.round(s.confidence)}% confidence
                    </span>
                  </div>
                  {s.association && (
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground print:text-black/60 mt-2 leading-relaxed">
                      <Quote className="w-3 h-3 shrink-0 mt-0.5 print:hidden" />
                      <span>Associates the brand with: <span className="text-foreground/90 print:text-black">{s.association}</span></span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recommendations */}
        {summary && summary.recommendations?.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground print:text-black/60 mb-3">Recommended next steps</h2>
            <div className="space-y-3">
              {summary.recommendations.map((rec, i) => (
                <div key={i} className={`rounded-xl border border-border print:border-black/15 p-4 ${NO_SPLIT}`}>
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="text-sm font-semibold text-foreground print:text-black">{rec.title}</p>
                    <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border print:border-black/20 print:bg-transparent print:text-black/70 ${PRIORITY_STYLE[rec.priority] ?? PRIORITY_STYLE.medium}`}>
                      {rec.priority}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground print:text-black/70 leading-relaxed">{rec.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Methodology. The single most-asked question about a report like this
            is "where does the number come from" — answering it in the document
            is what separates an audit from a screenshot. The limitations
            paragraph is deliberate: naming what the method can't do is what
            makes the rest of it credible to a professional reader. */}
        <section className="mb-10">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground print:text-black/60 mb-3">How this was measured</h2>
          <div className={`rounded-xl border border-border print:border-black/15 p-5 space-y-4 ${NO_SPLIT}`}>
            <div>
              <p className="text-sm font-semibold text-foreground print:text-black mb-1">Method</p>
              <p className="text-sm text-muted-foreground print:text-black/70 leading-relaxed">
                {modelsQueried.length > 0
                  ? <>Each of the AI assistants below — {modelsQueried.join(', ')} — was asked the same
                      set of questions about {analysis.brand_name} at the same time, on{' '}
                      {scannedAt.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}.</>
                  : <>A panel of AI assistants was asked the same set of questions about {analysis.brand_name} on{' '}
                      {scannedAt.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}.</>}
                {' '}Their answers were scored independently across the five dimensions below, and the
                trust score is the combined result on a 0–100 scale. No answer is discarded, so a single
                unusual reply cannot move the headline number on its own.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground print:text-black mb-2">What each dimension means</p>
              <dl className="space-y-1.5">
                {DIMENSIONS.map(({ key, name, what }) => (
                  <div key={key} className="text-sm leading-relaxed">
                    <dt className="inline font-medium text-foreground print:text-black">{name}: </dt>
                    <dd className="inline text-muted-foreground print:text-black/70">{what}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground print:text-black mb-1">Limitations</p>
              <p className="text-sm text-muted-foreground print:text-black/70 leading-relaxed">
                AI assistants are not deterministic — the same question can produce slightly different
                wording each time, and each model is retrained periodically. This audit is a snapshot of{' '}
                {scannedAt.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })},
                not a permanent ranking. Scores are most useful tracked over time and compared against
                competitors measured the same way, which is why we recommend re-running it on a schedule.
                Quote reference {referenceId} to have this exact audit re-run and compared.
              </p>
            </div>
          </div>
        </section>

        {/* Closing CTA — the agency's own, so a forwarded PDF sends the client
            back to them rather than to us. */}
        <section className={`rounded-2xl border border-primary/20 bg-primary/4 print:border-black/15 print:bg-transparent p-6 text-center ${NO_SPLIT}`}>
          <Sparkles className="w-5 h-5 text-primary print:text-black/60 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground print:text-black mb-1">Ready to close this gap?</p>
          <p className="text-sm text-muted-foreground print:text-black/70 mb-4">
            {branding.isWhiteLabeled
              ? <>Get in touch with {branding.name} to discuss a plan for improving {analysis.brand_name}&rsquo;s visibility across AI models.</>
              : <>Get in touch to discuss a plan for improving {analysis.brand_name}&rsquo;s visibility across AI models.</>}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <a href={`mailto:${branding.contactEmail}`} className="print:hidden inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <Mail className="w-3.5 h-3.5" /> {branding.contactEmail}
            </a>
            <p className="hidden print:block text-sm text-black">{branding.contactEmail}</p>
            {branding.website && (
              <>
                <a href={branding.website} target="_blank" rel="noreferrer" className="print:hidden inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                  <Globe className="w-3.5 h-3.5" /> {branding.website.replace(/^https?:\/\//, '')}
                </a>
                <p className="hidden print:block text-sm text-black">{branding.website.replace(/^https?:\/\//, '')}</p>
              </>
            )}
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground/60 print:text-black/40 mt-10 print:mt-6">
          {branding.isWhiteLabeled
            ? <>{branding.name} · AI visibility audit · Reference {referenceId}</>
            : <>Generated by Presora — presora.app · Reference {referenceId}</>}
        </p>
      </main>
    </div>
  );
};

export default AuditReport;
