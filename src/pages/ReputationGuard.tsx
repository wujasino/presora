import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSessionUser } from '@/hooks/useAccountInfo';
import { cn } from '@/lib/utils';

type IncidentStatus = 'open' | 'resolved' | 'ignored';
type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

interface ReputationIncident {
  id: string;
  analysis_id: string | null;
  brand_name: string;
  incident_type: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  summary: string;
  recommended_action: string;
  evidence: Record<string, unknown>;
  first_detected_at: string;
  last_seen_at: string;
}

const STATUS_TABS: { value: IncidentStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'ignored', label: 'Ignored' },
];

const TYPE_LABEL: Record<string, string> = {
  low_visibility: 'Low visibility',
  score_drop: 'Score drop',
  low_accuracy: 'Accuracy risk',
  model_uncertainty: 'Model uncertainty',
  competitor_gap: 'Competitor gap',
};

const SEVERITY_STYLE: Record<IncidentSeverity, string> = {
  low: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  medium: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  high: 'border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  critical: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
};

const formatDate = (iso: string) => new Date(iso).toLocaleString(undefined, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const ReputationGuard = () => {
  const navigate = useNavigate();
  const { data: sessionUser, isLoading: userLoading } = useSessionUser();
  const userId = sessionUser?.id ?? null;
  const [incidents, setIncidents] = useState<ReputationIncident[]>([]);
  const [activeStatus, setActiveStatus] = useState<IncidentStatus>('open');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadIncidents = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('reputation_incidents')
      .select('id, analysis_id, brand_name, incident_type, severity, status, title, summary, recommended_action, evidence, first_detected_at, last_seen_at')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false })
      .limit(100);
    if (loadError) {
      setError(loadError.code === '42P01'
        ? 'Reputation Guard is waiting for its database migration.'
        : 'Could not load reputation incidents.');
      setIncidents([]);
    } else {
      setIncidents((data as ReputationIncident[]) ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userLoading) return;
    if (!userId) {
      navigate('/login');
      return;
    }
    void loadIncidents();
  }, [userId, userLoading, navigate, loadIncidents]);

  const updateStatus = async (incidentId: string, status: IncidentStatus) => {
    setUpdatingId(incidentId);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please sign in again.');
      const response = await fetch('/.netlify/functions/reputation-incident-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ incidentId, status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not update incident.');
      setIncidents((current) => current.map((incident) => (
        incident.id === incidentId ? { ...incident, status } : incident
      )));
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Could not update incident.');
    } finally {
      setUpdatingId(null);
    }
  };

  const counts = useMemo(() => ({
    open: incidents.filter((incident) => incident.status === 'open').length,
    critical: incidents.filter((incident) => incident.status === 'open' && incident.severity === 'critical').length,
    brands: new Set(incidents.filter((incident) => incident.status === 'open').map((incident) => incident.brand_name)).size,
  }), [incidents]);

  const visible = incidents.filter((incident) => incident.status === activeStatus);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-display font-semibold text-foreground">Reputation Guard</h1>
            <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary">Beta</span>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Presora watches scheduled AI scans, records evidence-backed reputation incidents and closes them automatically when the signal recovers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadIncidents()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="text-xs text-muted-foreground">Open incidents</p>
          <p className="mt-1 text-2xl font-display font-semibold text-foreground">{counts.open}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="text-xs text-muted-foreground">Critical</p>
          <p className={cn('mt-1 text-2xl font-display font-semibold', counts.critical ? 'text-red-500' : 'text-foreground')}>{counts.critical}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="text-xs text-muted-foreground">Brands affected</p>
          <p className="mt-1 text-2xl font-display font-semibold text-foreground">{counts.brands}</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2 border-b border-border pb-4">
        {STATUS_TABS.map((tab) => {
          const count = incidents.filter((incident) => incident.status === tab.value).length;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveStatus(tab.value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                activeStatus === tab.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label} · {count}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reputation signals…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 px-6 py-14 text-center">
          {activeStatus === 'open' ? <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-emerald-500" /> : <Eye className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />}
          <p className="text-sm font-semibold text-foreground">
            {activeStatus === 'open' ? 'No active reputation incidents' : `No ${activeStatus} incidents`}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            {activeStatus === 'open'
              ? 'The guard will add evidence-backed incidents after scheduled monitoring runs. It does not create warnings from fallback or fabricated scan data.'
              : 'Incidents moved here will remain available as an audit trail.'}
          </p>
          {activeStatus === 'open' && (
            <button type="button" onClick={() => navigate('/automations')} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Configure monitoring <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((incident) => (
            <article key={incident.id} className="rounded-2xl border border-border bg-card/50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={cn('rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', SEVERITY_STYLE[incident.severity])}>
                      {incident.severity}
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {TYPE_LABEL[incident.incident_type] || incident.incident_type}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Last seen {formatDate(incident.last_seen_at)}</span>
                  </div>
                  <h2 className="text-base font-semibold text-foreground">{incident.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{incident.summary}</p>
                  {typeof incident.evidence?.groqAnalysis === 'string' && (
                    <div className="mt-3 rounded-lg border border-primary/15 bg-primary/5 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Groq AI review</p>
                      <p className="mt-1 text-sm leading-relaxed text-foreground/90">{incident.evidence.groqAnalysis}</p>
                    </div>
                  )}
                </div>
                <ShieldAlert className={cn('h-5 w-5 shrink-0', incident.severity === 'critical' ? 'text-red-500' : 'text-amber-500')} />
              </div>

              <div className="mt-4 rounded-xl border border-border/70 bg-background/40 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recommended next action</p>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{incident.recommended_action}</p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {incident.analysis_id && (
                  <button
                    type="button"
                    onClick={() => navigate(`/brand-visibility?id=${incident.analysis_id}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Open latest report <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
                {incident.status === 'open' ? (
                  <>
                    <button
                      type="button"
                      disabled={updatingId === incident.id}
                      onClick={() => void updateStatus(incident.id, 'resolved')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark resolved
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === incident.id}
                      onClick={() => void updateStatus(incident.id, 'ignored')}
                      className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                    >
                      Ignore
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={updatingId === incident.id}
                    onClick={() => void updateStatus(incident.id, 'open')}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                  >
                    Reopen
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReputationGuard;
