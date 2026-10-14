import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';

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
  sources: Array<{ model?: string }> | null;
  audit_summary: {
    headline?: string;
    businessImpact?: string;
    narrative?: string;
  } | null;
}

const DIMENSIONS = [
  { key: 'authority', label: 'Authority' },
  { key: 'sentiment', label: 'Sentiment' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'recency', label: 'Recency' },
] as const;

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

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6">
      {loading ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error || !report ? (
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground" />
          <h1 className="text-xl font-display text-foreground">Report unavailable</h1>
          <p className="text-sm text-muted-foreground">{error || 'This share link is invalid or no longer available.'}</p>
        </div>
      ) : (
        <article className="mx-auto max-w-3xl">
          <header className="mb-8 flex items-center justify-between border-b border-border pb-5">
            <Wordmark className="text-xl" />
            <p className="text-xs text-muted-foreground">Shared AI visibility report</p>
          </header>

          <div className="rounded-2xl border border-border bg-card/60 p-6 sm:p-8">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">AI visibility report</p>
            <h1 className="mt-2 text-2xl font-display font-semibold text-foreground">{report.brand_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Generated {new Date(report.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>

            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-[160px_1fr] sm:items-center">
              <div className="rounded-xl bg-muted/50 p-5 text-center">
                <p className="text-4xl font-display font-semibold tabular-nums text-foreground">{report.trust_score}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Trust score / 100</p>
              </div>
              <div className="space-y-4">
                {DIMENSIONS.map(({ key, label }) => {
                  const value = report[key];
                  return (
                    <div key={key}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium tabular-nums text-foreground">{value}/100</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {report.audit_summary && (
              <section className="mt-8 border-t border-border pt-6">
                {report.audit_summary.headline && (
                  <h2 className="text-lg font-semibold text-foreground">{report.audit_summary.headline}</h2>
                )}
                {report.audit_summary.businessImpact && (
                  <p className="mt-3 text-sm font-medium text-foreground">{report.audit_summary.businessImpact}</p>
                )}
                {report.audit_summary.narrative && (
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{report.audit_summary.narrative}</p>
                )}
              </section>
            )}

            {report.sources?.length ? (
              <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
                Based on {report.sources.length} AI model source{report.sources.length === 1 ? '' : 's'}.
              </p>
            ) : null}
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">
            This report was shared by its owner. Anyone with this link can view it.
          </p>
        </article>
      )}
    </main>
  );
};

export default SharedReport;
