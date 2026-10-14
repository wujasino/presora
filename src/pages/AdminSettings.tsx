import { useState, useEffect, useCallback } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle, Power, Tag, Megaphone, ShieldAlert, UserCog, Search, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useIsAdmin } from '@/hooks/useAccountInfo';
import { Button } from '@/components/ui/button';

/**
 * Admin kill-switch for brand scanning (app_settings.scanning_enabled).
 * Turning it off makes the app tell users scanning is paused instead of
 * letting every scan fail on the model calls — useful when OpenRouter
 * can't serve requests (no credits, revoked key, provider outage).
 */
type TargetUser = {
  id: string;
  email: string;
  plan: string;
  credits: number;
  analyses_this_month: number;
  subscription_status: string | null;
  is_admin: boolean;
};

type ScanDisableReason =
  | { source: 'manual' | 'auto'; at?: string; failures?: number; lastError?: string }
  | null;

type TempGrant = {
  granted_plan: string;
  previous_plan: string;
  expires_at: string;
} | null;

const AdminSettings = () => {
  const { data: isAdmin = false, isLoading } = useIsAdmin();

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [reason, setReason] = useState<ScanDisableReason>(null);
  const [failureCount, setFailureCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastFailureAt, setLastFailureAt] = useState<string | null>(null);
  const [autoDisable, setAutoDisable] = useState(false);
  const [openrouterEnabled, setOpenrouterEnabled] = useState(true);
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const authedFetch = useCallback(async (init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('You must be signed in.');
    const res = await fetch('/.netlify/functions/toggle-scanning', {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(init?.headers || {}),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setStatus('loading');
    authedFetch()
      .then((json) => {
        setEnabled(json.enabled);
        setUpdatedAt(json.updatedAt);
        setReason(json.reason ?? null);
        setFailureCount(json.failureCount ?? 0);
        setLastError(json.lastError ?? null);
        setLastFailureAt(json.lastFailureAt ?? null);
        setAutoDisable(json.autoDisable === true);
        setOpenrouterEnabled(json.openrouterEnabled !== false);
        setStatus('idle');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message);
      });
  }, [isAdmin, authedFetch]);

  // ── User management (plan / credits / usage) ──────────────────────
  const [lookupEmail, setLookupEmail] = useState('');
  const [target, setTarget] = useState<TargetUser | null>(null);
  const [userStatus, setUserStatus] = useState<'idle' | 'loading' | 'saving' | 'ok' | 'error'>('idle');
  const [userMessage, setUserMessage] = useState('');
  const [planDraft, setPlanDraft] = useState('');
  const [creditsDraft, setCreditsDraft] = useState('');

  // ── Temporary access (time-boxed plan grant) ───────────────────────
  const [tempGrant, setTempGrant] = useState<TempGrant>(null);
  const [tempDays, setTempDays] = useState('14');
  const [tempStatus, setTempStatus] = useState<'idle' | 'loading' | 'saving' | 'error'>('idle');
  const [tempMessage, setTempMessage] = useState('');

  const userFetch = useCallback(async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('You must be signed in.');
    const res = await fetch(`/.netlify/functions/admin-update-user${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(init?.headers || {}),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  }, []);

  const applySnapshot = (u: TargetUser) => {
    setTarget(u);
    setPlanDraft(u.plan ?? 'free');
    setCreditsDraft(String(u.credits ?? 0));
  };

  const tempFetch = useCallback(async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('You must be signed in.');
    const res = await fetch(`/.netlify/functions/admin-grant-temp-access${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(init?.headers || {}),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  }, []);

  const lookup = async () => {
    setUserStatus('loading');
    setUserMessage('');
    setTarget(null);
    setTempGrant(null);
    setTempMessage('');
    const email = lookupEmail.trim();
    try {
      const json = await userFetch(`?email=${encodeURIComponent(email)}`);
      applySnapshot(json.user);
      setUserStatus('idle');
    } catch (err) {
      setUserStatus('error');
      setUserMessage(err instanceof Error ? err.message : 'Lookup failed.');
      return;
    }
    try {
      const grantJson = await tempFetch(`?email=${encodeURIComponent(email)}`);
      setTempGrant(grantJson.grant ?? null);
    } catch {
      // Non-fatal — the account lookup above already succeeded; the temp
      // access panel just won't show an existing grant until the next
      // successful lookup.
    }
  };

  const grantTempAccess = async () => {
    if (!target) return;
    const days = Number(tempDays);
    if (!Number.isInteger(days) || days < 1) {
      setTempStatus('error');
      setTempMessage('Enter a whole number of days (1 or more).');
      return;
    }
    setTempStatus('saving');
    setTempMessage('');
    try {
      const json = await tempFetch('', {
        method: 'POST',
        body: JSON.stringify({ email: target.email, plan: planDraft, days }),
      });
      applySnapshot(json.user);
      setTempGrant(json.grant);
      setTempStatus('idle');
      setTempMessage(`Granted ${planDraft} until ${new Date(json.grant.expires_at).toLocaleString()}.`);
    } catch (err) {
      setTempStatus('error');
      setTempMessage(err instanceof Error ? err.message : 'Grant failed.');
    }
  };

  const revokeTempAccess = async () => {
    if (!target) return;
    setTempStatus('saving');
    setTempMessage('');
    try {
      const json = await tempFetch('', {
        method: 'POST',
        body: JSON.stringify({ email: target.email, revoke: true }),
      });
      applySnapshot(json.user);
      setTempGrant(null);
      setTempStatus('idle');
      setTempMessage(`Reverted to ${json.user.plan}.`);
    } catch (err) {
      setTempStatus('error');
      setTempMessage(err instanceof Error ? err.message : 'Revoke failed.');
    }
  };

  const saveUser = async (extra: Record<string, unknown> = {}) => {
    if (!target) return;
    setUserStatus('saving');
    setUserMessage('');
    try {
      const body: Record<string, unknown> = { email: target.email, ...extra };
      if (!('resetUsage' in extra)) {
        if (planDraft && planDraft !== target.plan) body.plan = planDraft;
        const c = Number(creditsDraft);
        if (Number.isInteger(c) && c !== target.credits) body.credits = c;
      }
      if (Object.keys(body).length === 1) {
        setUserStatus('idle');
        setUserMessage('No changes to save.');
        return;
      }
      const json = await userFetch('', { method: 'POST', body: JSON.stringify(body) });
      applySnapshot(json.user);
      setUserStatus('ok');
      setUserMessage('Saved.');
    } catch (err) {
      setUserStatus('error');
      setUserMessage(err instanceof Error ? err.message : 'Save failed.');
    }
  };

  const toggle = async (next: boolean) => {
    setStatus('saving');
    setMessage('');
    try {
      const json = await authedFetch({ method: 'POST', body: JSON.stringify({ enabled: next }) });
      setEnabled(next);
      setUpdatedAt(new Date().toISOString());
      setReason(next ? null : { source: 'manual' });
      // Only claim the streak is cleared when the server says it cleared it.
      // This optimistically set 0 regardless, which is why a silently failing
      // counter reset went unnoticed: the panel read 0 while the database
      // still held 3, and scanning switched itself off again on the next
      // failure.
      if (json?.warning) {
        setStatus('error');
        setMessage(json.warning);
        return;
      }
      setFailureCount(0);
      setLastError(null);
      setLastFailureAt(null);
      setStatus('ok');
      setMessage(next ? 'Scanning is back on.' : 'Scanning paused for all users.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Power className="w-4.5 h-4.5 text-primary" />
          </div>
          <h1 className="text-2xl font-display text-foreground">Scanning</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6 ml-12">
          Pause brand scanning across the whole app. Users get an honest
          "scanning is paused" message instead of a failed scan, guests don't
          burn their free allowance, and scheduled re-scans are skipped.
        </p>

        <div className="rounded-2xl border border-border bg-card/60 p-6">
          {status === 'loading' || enabled === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading current state…
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <p className="text-sm font-medium text-foreground">
                      {enabled ? 'Scanning is enabled' : 'Scanning is paused'}
                    </p>
                  </div>
                  {updatedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last changed {new Date(updatedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <Button
                  variant={enabled ? 'outline-solid' : 'default'}
                  disabled={status === 'saving'}
                  onClick={() => toggle(!enabled)}
                  className="gap-1.5 shrink-0"
                >
                  {status === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {enabled ? 'Pause scanning' : 'Enable scanning'}
                </Button>
              </div>

              {!enabled && reason?.source === 'auto' && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <ShieldAlert className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="text-foreground font-medium">Paused automatically</p>
                    <p className="text-muted-foreground mt-0.5">
                      {reason.failures} consecutive scans failed at the model provider.
                      {reason.lastError && (
                        <> Last error: <span className="font-mono text-xs">{reason.lastError}</span></>
                      )}
                    </p>
                    <p className="text-muted-foreground mt-1">
                      Fix the cause (credits, API key, provider outage) before turning it back on —
                      it won't re-enable itself.
                    </p>
                  </div>
                </div>
              )}

              {/* Off by default: a provider outage that lasts turns every scan
                  into "temporarily paused", and only an admin here can undo
                  it. Kept as a choice rather than removed outright. */}
              <label className="mt-4 flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  id="auto-disable"
                  name="autoDisable"
                  checked={autoDisable}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    setAutoDisable(next);
                    try {
                      await authedFetch({ method: 'POST', body: JSON.stringify({ autoDisable: next }) });
                    } catch {
                      setAutoDisable(!next);
                    }
                  }}
                  className="mt-0.5 accent-primary"
                />
                <span className="text-xs text-muted-foreground">
                  Pause scanning automatically after 3 failed scans in a row.
                  Failures are recorded either way; this only controls whether the
                  switch above flips by itself.
                </span>
              </label>

              {/* Independent of the main switch above: skips a known-broken
                  OpenRouter balance and goes straight to the direct
                  Anthropic fallback, instead of paying OpenRouter's timeout
                  on all 6 models before falling through anyway. Flip back
                  the moment OpenRouter credits are topped up — no redeploy
                  needed. */}
              <label className="mt-3 flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  id="openrouter-enabled"
                  name="openrouterEnabled"
                  checked={openrouterEnabled}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    setOpenrouterEnabled(next);
                    try {
                      await authedFetch({ method: 'POST', body: JSON.stringify({ openrouterEnabled: next }) });
                    } catch {
                      setOpenrouterEnabled(!next);
                    }
                  }}
                  className="mt-0.5 accent-primary"
                />
                <span className="text-xs text-muted-foreground">
                  Use OpenRouter for scans. Turn off to skip it entirely and scan
                  directly via Anthropic instead — useful while OpenRouter's balance
                  is empty. Re-enable once it's topped up.
                </span>
              </label>

              {/* While a streak is building, the cause matters more than the
                  count — the count alone sent whoever saw it into the Netlify
                  logs to find out what actually broke. */}
              {enabled && failureCount > 0 && (
                <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/6 p-3">
                  <p className="text-xs text-foreground">
                    {failureCount} recent scan failure{failureCount === 1 ? '' : 's'} — scanning pauses automatically at 3 in a row.
                    {lastFailureAt && (
                      <span className="text-muted-foreground"> Last: {new Date(lastFailureAt).toLocaleString()}.</span>
                    )}
                  </p>
                  {lastError && (
                    <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground wrap-break-word">
                      {lastError}
                    </p>
                  )}
                </div>
              )}

              {message && (
                <div className={`mt-4 flex items-start gap-2 text-sm ${status === 'error' ? 'text-destructive' : 'text-emerald-500'}`}>
                  {status === 'error'
                    ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{message}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── User management ────────────────────────────────────── */}
        <div className="flex items-center gap-3 mt-10 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <UserCog className="w-4.5 h-4.5 text-primary" />
          </div>
          <h2 className="text-2xl font-display text-foreground">User account</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6 ml-12">
          Change a user's plan, set their credit balance, or reset this month's
          usage counter. Plan drives the monthly analysis limit; credits are the
          separately-purchased pool.
        </p>

        <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-5">
          <div>
            <label htmlFor="admin-user-email" className="text-xs font-medium text-muted-foreground mb-1.5 block">Account email</label>
            <div className="flex gap-2">
              <Input
                id="admin-user-email"
                name="lookupEmail"
                type="email"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookup()}
                placeholder="client@company.com"
                className="bg-background"
              />
              <Button
                variant="outline"
                onClick={lookup}
                disabled={userStatus === 'loading' || !lookupEmail.trim()}
                className="gap-1.5 shrink-0"
              >
                {userStatus === 'loading'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Search className="w-3.5 h-3.5" />}
                Find
              </Button>
            </div>
          </div>

          {target && (
            <>
              <div className="rounded-xl border border-border bg-background/40 p-4 text-sm">
                <p className="text-foreground font-medium">{target.email}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Used {target.analyses_this_month} analyses this month
                  {target.subscription_status ? ` · subscription: ${target.subscription_status}` : ''}
                  {target.is_admin ? ' · admin' : ''}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="admin-user-plan" className="text-xs font-medium text-muted-foreground mb-1.5 block">Plan</label>
                  <select
                    id="admin-user-plan"
                    name="plan"
                    value={planDraft}
                    onChange={(e) => setPlanDraft(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground"
                  >
                    {['free', 'starter', 'solo', 'growth', 'enterprise', 'agency'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="admin-user-credits" className="text-xs font-medium text-muted-foreground mb-1.5 block">Credits</label>
                  <Input
                    id="admin-user-credits"
                    name="credits"
                    type="number"
                    min="0"
                    step="1"
                    value={creditsDraft}
                    onChange={(e) => setCreditsDraft(e.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => saveUser()} disabled={userStatus === 'saving'} className="gap-1.5">
                  {userStatus === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => saveUser({ resetUsage: true })}
                  disabled={userStatus === 'saving'}
                >
                  Reset monthly usage
                </Button>
              </div>

              {/* ── Temporary access ─────────────────────────────────
                  Grants the plan currently selected above for a fixed
                  number of days — e.g. a trial for a prospect — without a
                  real subscription. expire-temp-access.js (hourly)
                  reverts it automatically; "Revoke now" ends it early. */}
              <div className="rounded-xl border border-border bg-background/40 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">Temporary access</p>
                </div>
                {tempGrant ? (
                  <div className="text-xs text-muted-foreground mb-3">
                    <span className="text-foreground font-medium">{tempGrant.granted_plan}</span> until{' '}
                    <span className="text-foreground font-medium">{new Date(tempGrant.expires_at).toLocaleString()}</span>
                    {' '}— reverts to <span className="text-foreground font-medium">{tempGrant.previous_plan}</span> automatically.
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mb-3">
                    Grants the plan selected above for a fixed number of days, then reverts to {target.plan} automatically.
                  </p>
                )}
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label htmlFor="admin-temp-days" className="text-xs font-medium text-muted-foreground mb-1.5 block">Days</label>
                    <Input
                      id="admin-temp-days"
                      name="tempDays"
                      type="number"
                      min="1"
                      step="1"
                      value={tempDays}
                      onChange={(e) => setTempDays(e.target.value)}
                      className="bg-background w-24"
                    />
                  </div>
                  <Button onClick={grantTempAccess} disabled={tempStatus === 'saving'} className="gap-1.5">
                    {tempStatus === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {tempGrant ? 'Extend / update' : 'Grant temporary access'}
                  </Button>
                  {tempGrant && (
                    <Button variant="outline" onClick={revokeTempAccess} disabled={tempStatus === 'saving'}>
                      Revoke now
                    </Button>
                  )}
                </div>
                {tempMessage && (
                  <div className={`flex items-start gap-2 text-xs mt-2 ${tempStatus === 'error' ? 'text-destructive' : 'text-emerald-500'}`}>
                    {tempStatus === 'error'
                      ? <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      : <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                    <span>{tempMessage}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {userMessage && (
            <div className={`flex items-start gap-2 text-sm ${userStatus === 'error' ? 'text-destructive' : 'text-emerald-500'}`}>
              {userStatus === 'error'
                ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{userMessage}</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-4 text-sm">
          <Link to="/admin/pricing" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <Tag className="w-3.5 h-3.5" /> Custom plan price
          </Link>
          <Link to="/admin/announcements" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <Megaphone className="w-3.5 h-3.5" /> Announcements
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
