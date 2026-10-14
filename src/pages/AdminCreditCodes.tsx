import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Copy, Loader2, Tag, Ticket, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIsAdmin } from '@/hooks/useAccountInfo';
import { supabase } from '@/lib/supabase';

interface CreditCode {
  id: string;
  code: string;
  credits_per_redemption: number;
  max_redemptions: number;
  redemption_count: number;
  is_active: boolean;
  created_at: string;
}

const AdminCreditCodes = () => {
  const { data: isAdmin = false, isLoading } = useIsAdmin();
  const [codes, setCodes] = useState<CreditCode[]>([]);
  const [code, setCode] = useState('');
  const [credits, setCredits] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const request = useCallback(async (method: 'GET' | 'POST' | 'PATCH', body?: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('You must be signed in.');
    const response = await fetch('/.netlify/functions/admin-credit-codes', {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Could not process credit code request.');
    return result;
  }, []);

  const loadCodes = useCallback(async () => {
    setLoadingCodes(true);
    try {
      const result = await request('GET');
      setCodes(result.codes ?? []);
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : 'Could not load credit codes.');
    } finally {
      setLoadingCodes(false);
    }
  }, [request]);

  useEffect(() => {
    if (isAdmin) void loadCodes();
  }, [isAdmin, loadCodes]);

  const createCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(false);
    setMessage('');
    try {
      const result = await request('POST', {
        code: code.trim().toUpperCase(),
        credits: Number(credits),
        maxRedemptions: Number(maxRedemptions),
      });
      setCodes(current => [result.code, ...current]);
      setCode('');
      setCredits('');
      setMaxRedemptions('');
      setMessage(`Code ${result.code.code} created.`);
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : 'Could not create code.');
    } finally {
      setSaving(false);
    }
  };

  const deactivateCode = async (item: CreditCode) => {
    setBusyId(item.id);
    setError(false);
    setMessage('');
    try {
      await request('PATCH', { id: item.id, isActive: false });
      setCodes(current => current.map(codeItem =>
        codeItem.id === item.id ? { ...codeItem, is_active: false } : codeItem
      ));
      setMessage(`Code ${item.code} deactivated.`);
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : 'Could not deactivate code.');
    } finally {
      setBusyId(null);
    }
  };

  const copyCheckoutLink = async (item: CreditCode) => {
    const url = new URL('/pricing', window.location.origin);
    url.searchParams.set('plan', 'enterprise');
    url.searchParams.set('credit_code', item.code);
    try {
      await navigator.clipboard.writeText(url.toString());
      setError(false);
      setMessage(`Agency checkout link for ${item.code} copied.`);
    } catch {
      setError(true);
      setMessage('Could not copy the link. Check browser clipboard permissions.');
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 text-muted-foreground animate-spin" /></div>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Ticket className="w-4.5 h-4.5 text-primary" />
          </div>
          <h1 className="text-2xl font-display text-foreground">Agency credit codes</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6 ml-12">
          Codes are entered during Agency checkout in Stripe. They do not reduce the price;
          credits are added only after Stripe confirms payment. Each account can redeem a code once,
          and the usage limit applies across all customers.
        </p>

        <form onSubmit={createCode} className="space-y-5 rounded-2xl border border-border bg-card/60 p-6">
          <div>
            <label htmlFor="credit-code" className="text-xs font-medium text-muted-foreground mb-1.5 block">Code</label>
            <Input
              id="credit-code"
              value={code}
              onChange={event => setCode(event.target.value.toUpperCase())}
              placeholder="AGENCY-START"
              maxLength={32}
              pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}"
              required
              className="bg-background uppercase"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="credit-amount" className="text-xs font-medium text-muted-foreground mb-1.5 block">Credits per successful payment</label>
              <Input
                id="credit-amount"
                type="number"
                min="1"
                max="100000"
                step="1"
                value={credits}
                onChange={event => setCredits(event.target.value)}
                placeholder="50"
                required
                className="bg-background"
              />
            </div>
            <div>
              <label htmlFor="credit-limit" className="text-xs font-medium text-muted-foreground mb-1.5 block">Total redemption limit</label>
              <Input
                id="credit-limit"
                type="number"
                min="1"
                max="1000000"
                step="1"
                value={maxRedemptions}
                onChange={event => setMaxRedemptions(event.target.value)}
                placeholder="25"
                required
                className="bg-background"
              />
            </div>
          </div>

          {message && (
            <div className={`flex items-center gap-2 text-sm ${error ? 'text-red-500' : 'text-emerald-500'}`}>
              {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              {message}
            </div>
          )}

          <Button type="submit" disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
            Create credit code
          </Button>
        </form>

        <section className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Existing codes</h2>
          {loadingCodes ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : codes.length === 0 ? (
            <p className="rounded-xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">No credit codes yet.</p>
          ) : codes.map(item => (
            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border bg-card/40 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground">{item.code}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.credits_per_redemption} credits · {item.redemption_count}/{item.max_redemptions} uses
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void copyCheckoutLink(item)} className="gap-1.5">
                  <Copy className="w-3.5 h-3.5" /> Copy Agency link
                </Button>
                {item.is_active && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === item.id}
                    onClick={() => void deactivateCode(item)}
                    className="gap-1.5 text-red-500 hover:text-red-600"
                  >
                    {busyId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Disable
                  </Button>
                )}
              </div>
            </div>
          ))}
        </section>

        <Link to="/admin/pricing" className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Tag className="w-3.5 h-3.5" /> Go to custom pricing
        </Link>
      </div>
    </div>
  );
};

export default AdminCreditCodes;
