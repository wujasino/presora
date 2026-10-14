import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Globe, Loader2, Mail, Printer, Quote, Sparkles } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';
import { Button } from '@/components/ui/button';

interface ReportSource {
  model?: string;
  sentiment?: string;
  confidence?: number;
  association?: string;
}

interface ReportRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

interface SharedReportData {
  id: string;
  brand_name: string;
  trust_score: number;
  authority: number;
  sentiment: number;
  recency: number;
  mentions: number;
  accuracy: number;
  created_at: string;
  sources: ReportSource[] | null;
  audit_summary: {
    headline?: string;
    businessImpact?: string;
    narrative?: string;
    competitivePosition?: string;
    recommendations?: ReportRecommendation[];
  } | null;
  competitors: Array<{
    competitor_name: string;
    last_score: number | null;
    last_scanned_at: string | null;
  }>;
  branding?: {
    name: string | null;
    logoUrl: string | null;
    contactEmail: string;
    website: string | null;
    isWhiteLabeled: boolean;
  };
}

const DIMENSIONS = [
  { key: 'authority', label: 'Authority', description: 'How confidently AI models treat the brand as credible and established.' },
  { key: 'sentiment', label: 'Sentiment', description: 'Whether AI models describe the brand positively, neutrally or negatively.' },
  { key: 'accuracy', label: 'Accuracy', description: 'How factually correct AI answers are about the brand and its offer.' },
  { key: 'mentions', label: 'Mentions', description: 'How readily the brand appears in relevant AI answers.' },
  { key: 'recency', label: 'Recency', description: 'How current the models’ knowledge of the brand is.' },
] as const;

const PRIORITY_STYLE = {
  high: 'border-red-500/20 bg-red-500/10 text-red-500',
  medium: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
  low: 'border-border bg-muted text-muted-foreground',
};

const sentimentClass = (sentiment = '') => {
  const value = sentiment.toLowerCase();
  if (value.includes('positive')) return 'text-emerald-500';
  if (value.includes('negative')) return 'text-red-500';
  return 'text-amber-500';
};

const SharedReport = () => {
  const { token = '' } = useParams<{ token: string }>();
  const [report, setReport] = useState<SharedReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const noIndex = document.createElement('meta');
    noIndex.name = 'robots';
    noIndex.content = 'noindex, nofollow';
    document.head.appendChild(noIndex);

    let active = true;
    (async () => {
      try {
        const response = await fetch(`/.netlify/functions/share-report?token=${encodeURIComponent(token)}`);
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'This share link is invalid or no longer available.');
        if (active) setReport(result.report as SharedReportData);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load this report.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      noIndex.remove();
    };
  }, [token]);

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></main>;
  }

  if (error || !report) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground" />
          <h1 className="text-xl font-display text-foreground">Report unavailable</h1>
          <p className="text-sm text-muted-foreground">{error || 'This share link is invalid or no longer available.'}</p>
        </div>
      </main>
    );
  }

  const scannedAt = new Date(report.created_at);
  const models = (report.sources ?? []).map(source => source.model).filter(Boolean) as string[];
  const referenceId = report.id.slice(0, 8).toUpperCase();
  const summary = report.audit_summary;
  const branding = report.branding;

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <div className="print:hidden sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">Shared AI visibility report</p>
          <Button size="sm" className="gap-1.5" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Print / Save as PDF</Button>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-6 py-10 print:px-0 print:py-0">
        <header className="mb-8 flex items-center justify-between gap-4 border-b border-border pb-5 print:border-black/10">
          {branding?.isWhiteLabeled ? (
            <div className="flex min-w-0 items-center gap-2.5">
              {branding.logoUrl && <img src={branding.logoUrl} alt="" className="h-8 max-w-[140px] shrink-0 object-contain" />}
              <span className="truncate text-lg font-display font-semibold text-foreground print:text-black">{branding.name}</span>
            </div>
          ) : <Wordmark className="text-xl print:text-black!" />}
          <p className="shrink-0 text-right text-xs text-muted-foreground print:text-black/60">AI Visibility Audit</p>
        </header>

        <h1 className="text-3xl font-display font-semibold text-foreground print:text-black sm:text-4xl">{report.brand_name}</h1>
        <p className="mt-2 text-sm text-muted-foreground print:text-black/70">How AI models see this brand right now.</p>

        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-b border-border pb-6 text-xs print:border-black/10">
          <div><p className="uppercase tracking-wider text-muted-foreground">Prepared by</p><p className="mt-0.5 font-medium text-foreground print:text-black">{branding?.name || 'Presora'}</p></div>
          <div><p className="uppercase tracking-wider text-muted-foreground">Data collected</p><p className="mt-0.5 font-medium text-foreground print:text-black">{scannedAt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
          <div><p className="uppercase tracking-wider text-muted-foreground">Reference</p><p className="mt-0.5 font-medium tabular-nums text-foreground print:text-black">{referenceId}</p></div>
          <div><p className="uppercase tracking-wider text-muted-foreground">Models queried</p><p className="mt-0.5 font-medium tabular-nums text-foreground print:text-black">{models.length || '—'}</p></div>
        </div>

        <section className="my-8 rounded-2xl border border-border bg-card/60 p-6 print:border-black/15 print:bg-transparent">
          <div className="grid gap-7 sm:grid-cols-[150px_1fr] sm:items-center">
            <div className="rounded-xl bg-muted/50 p-5 text-center print:bg-black/5">
              <p className="text-5xl font-display font-semibold tabular-nums text-foreground print:text-black">{report.trust_score}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Trust score / 100</p>
            </div>
            <div className="space-y-4">
              {DIMENSIONS.map(({ key, label }) => {
                const value = report[key];
                return <div key={key}><div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-medium tabular-nums text-foreground print:text-black">{value}/100</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted print:bg-black/10"><div className="h-full rounded-full bg-primary print:bg-black/70" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>;
              })}
            </div>
          </div>
          {summary?.headline && <p className="mt-6 border-t border-border pt-5 text-base font-semibold text-foreground print:border-black/10 print:text-black">{summary.headline}</p>}
        </section>

        {summary && (
          <section className="mb-10 space-y-5">
            {summary.businessImpact && <div><h2 className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Why this matters</h2><p className="text-sm leading-relaxed text-foreground/90 print:text-black">{summary.businessImpact}</p></div>}
            {summary.narrative && <div><h2 className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">What the numbers show</h2><p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90 print:text-black">{summary.narrative}</p></div>}
            {summary.competitivePosition && <div><h2 className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Competitive position</h2><p className="text-sm leading-relaxed text-foreground/90 print:text-black">{summary.competitivePosition}</p></div>}
          </section>
        )}

        <section className="mb-10">
          <div className="flex items-end justify-between gap-4"><div><h2 className="text-xs uppercase tracking-wider text-muted-foreground">Competitive benchmark</h2><p className="mt-1 text-xs text-muted-foreground">Up to three competitors tracked for {report.brand_name}.</p></div><span className="text-xs text-muted-foreground">Your score: {report.trust_score}</span></div>
          {report.competitors?.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {report.competitors.map((competitor, index) => {
                const delta = competitor.last_score === null ? null : competitor.last_score - report.trust_score;
                return <div key={`${competitor.competitor_name}-${index}`} className="rounded-xl border border-border bg-card/40 p-4 print:border-black/15 print:bg-transparent"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Competitor {index + 1}</p><p className="mt-2 truncate text-sm font-semibold text-foreground print:text-black">{competitor.competitor_name}</p>{competitor.last_score === null ? <p className="mt-3 text-xs text-muted-foreground">Not measured</p> : <div className="mt-3 flex items-end justify-between gap-2"><span className="text-2xl font-display font-semibold tabular-nums text-foreground print:text-black">{competitor.last_score}</span><span className={`text-xs font-medium tabular-nums ${delta! > 0 ? 'text-red-500' : delta! < 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>{delta === 0 ? 'Same score' : `${delta! > 0 ? '+' : ''}${delta} vs you`}</span></div>}</div>;
              })}
            </div>
          ) : <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">No competitors were tracked for this brand.</p>}
        </section>

        {report.sources?.length ? (
          <section className="mb-10">
            <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">What each AI model says</h2>
            <div className="space-y-2">
              {report.sources.map((source, index) => <div key={`${source.model || 'model'}-${index}`} className="break-inside-avoid rounded-xl border border-border/60 px-4 py-3 print:border-black/10"><div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium text-foreground print:text-black">{source.model || `Model ${index + 1}`}</span><span className="shrink-0 text-muted-foreground"><span className={`font-medium ${sentimentClass(source.sentiment)}`}>{source.sentiment || 'Unknown'}</span>{typeof source.confidence === 'number' ? ` · ${Math.round(source.confidence)}% confidence` : ''}</span></div>{source.association && <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"><Quote className="mt-0.5 h-3 w-3 shrink-0 print:hidden" /><span>Associates the brand with: <span className="text-foreground/90 print:text-black">{source.association}</span></span></p>}</div>)}
            </div>
          </section>
        ) : null}

        {summary?.recommendations?.length ? (
          <section className="mb-10">
            <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Recommended next steps</h2>
            <div className="space-y-3">
              {summary.recommendations.map((recommendation, index) => <div key={`${recommendation.title}-${index}`} className="break-inside-avoid rounded-xl border border-border p-4 print:border-black/15"><div className="mb-1 flex items-start justify-between gap-3"><p className="text-sm font-semibold text-foreground print:text-black">{recommendation.title}</p><span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${PRIORITY_STYLE[recommendation.priority] || PRIORITY_STYLE.medium}`}>{recommendation.priority}</span></div><p className="text-sm leading-relaxed text-muted-foreground print:text-black/70">{recommendation.description}</p></div>)}
            </div>
          </section>
        ) : null}

        <section className="mb-10">
          <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">How this was measured</h2>
          <div className="space-y-4 rounded-xl border border-border p-5 print:border-black/15">
            <div><p className="mb-1 text-sm font-semibold text-foreground print:text-black">Method</p><p className="text-sm leading-relaxed text-muted-foreground print:text-black/70">{models.length ? `The same set of questions was asked of ${models.join(', ')} about ${report.brand_name} on ${scannedAt.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}.` : `A panel of AI assistants was asked the same set of questions about ${report.brand_name}.`} Their answers were scored across five dimensions and combined into the 0–100 trust score.</p></div>
            <div><p className="mb-2 text-sm font-semibold text-foreground print:text-black">What each dimension means</p><dl className="space-y-1.5">{DIMENSIONS.map(dimension => <div key={dimension.key} className="text-sm leading-relaxed"><dt className="inline font-medium text-foreground print:text-black">{dimension.label}: </dt><dd className="inline text-muted-foreground print:text-black/70">{dimension.description}</dd></div>)}</dl></div>
            <div><p className="mb-1 text-sm font-semibold text-foreground print:text-black">Limitations</p><p className="text-sm leading-relaxed text-muted-foreground print:text-black/70">AI answers can vary and models are updated over time. This report is a snapshot from {scannedAt.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}, not a permanent ranking. Reference {referenceId} identifies this exact audit.</p></div>
          </div>
        </section>

        <section className="break-inside-avoid rounded-2xl border border-primary/20 bg-primary/4 p-6 text-center print:border-black/15 print:bg-transparent">
          <Sparkles className="mx-auto mb-2 h-5 w-5 text-primary print:text-black/60" />
          <p className="mb-1 text-sm font-medium text-foreground print:text-black">Ready to improve this result?</p>
          <p className="mb-4 text-sm text-muted-foreground print:text-black/70">Get in touch to discuss improving {report.brand_name}&rsquo;s visibility across AI models.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {branding?.contactEmail && <a href={`mailto:${branding.contactEmail}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"><Mail className="h-3.5 w-3.5" />{branding.contactEmail}</a>}
            {branding?.website && <a href={branding.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"><Globe className="h-3.5 w-3.5" />{branding.website.replace(/^https?:\/\//, '')}</a>}
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-muted-foreground/70 print:text-black/40">{branding?.isWhiteLabeled ? branding.name : 'Generated by Presora — presora.app'} · Reference {referenceId}</p>
        <p className="mt-2 text-center text-xs text-muted-foreground print:hidden">This report was shared by its owner. Anyone with this link can view it.</p>
      </article>
    </div>
  );
};

export default SharedReport;
