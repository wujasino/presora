import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Webhook, Copy, Trash2, Plus, Check, ExternalLink, Eye, EyeOff,
  CircleCheck, CircleX, Loader2, BookOpen, Zap, AlertCircle, MoreVertical,
  Pencil, Activity as ActivityIcon, Ban, PlayCircle, X as XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useSessionUser } from '@/hooks/useAccountInfo';

// ── Types — mirror the shape dev-keys.js / dev-webhooks.js return ──
type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};
type KeyUsage = {
  id: string;
  api_key_id: string;
  created_at: string;
};
type WebhookEvent = 'analysis.completed' | 'analysis.failed' | 'sentiment.dropped' | 'score.changed';
type WebhookRow = {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  secret: string;
  created_at: string;
};
type Delivery = {
  id: string;
  webhook_id: string;
  event: WebhookEvent;
  status_code: number | null;
  ok: boolean;
  error: string | null;
  created_at: string;
};

const ALL_EVENTS: { id: WebhookEvent; label: string; desc: string }[] = [
  { id: 'analysis.completed', label: 'analysis.completed', desc: 'Sent when a brand analysis is completed' },
  { id: 'analysis.failed',    label: 'analysis.failed',    desc: 'Sent when an analysis fails' },
  { id: 'sentiment.dropped',  label: 'sentiment.dropped',  desc: 'Sent when a monitored brand\'s sentiment crosses below its alert threshold' },
  { id: 'score.changed',      label: 'score.changed',      desc: 'Sent when a monitored brand\'s visibility score changes' },
];

const authedFetch = async (path: string, init: RequestInit = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You must be signed in.');
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

// ── Tabs ────────────────────────────────────────────────────────
type Tab = 'keys' | 'webhooks';

const Developers = () => {
  const [tab, setTab] = useState<Tab>('keys');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<KeyUsage[]>([]);
  const [hooks, setHooks] = useState<WebhookRow[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const { data: sessionUser, isLoading: userLoading } = useSessionUser();

  const refresh = useCallback(async () => {
    setLoadError('');
    try {
      const [keysRes, hooksRes] = await Promise.all([
        authedFetch('/.netlify/functions/dev-keys'),
        authedFetch('/.netlify/functions/dev-webhooks'),
      ]);
      setKeys(keysRes.keys || []);
      setUsage(keysRes.usage || []);
      setHooks(hooksRes.webhooks || []);
      setDeliveries(hooksRes.deliveries || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userLoading) return;
    if (!sessionUser?.id) { setLoading(false); return; }
    refresh();
  }, [sessionUser, userLoading, refresh]);

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-6 pb-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] uppercase tracking-[0.2em] text-primary font-data">
                Developers
              </span>
            </div>
            <h1 className="text-3xl font-display text-foreground">API & Webhooks</h1>
            <p className="text-muted-foreground text-sm mt-1.5">
              Integrate Presora with your own stack. Manage API keys and webhooks.
            </p>
          </div>
          <Link
            to="/docs/api"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline self-start"
          >
            <BookOpen className="w-4 h-4" />
            API Documentation
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[hsl(var(--glass-border))]">
          {([
            { id: 'keys',     label: 'API Keys',  icon: Key },
            { id: 'webhooks', label: 'Webhooks',   icon: Webhook },
          ] as { id: Tab; label: string; icon: typeof Key }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : loadError ? (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" /> {loadError}
          </div>
        ) : (
          <>
            {tab === 'keys' && <KeysSection keys={keys} usage={usage} onChange={refresh} />}
            {tab === 'webhooks' && (
              <WebhooksSection hooks={hooks} deliveries={deliveries} onChange={refresh} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── Keys section ────────────────────────────────────────────────
const KeysSection = ({ keys, usage, onChange }: { keys: ApiKey[]; usage: KeyUsage[]; onChange: () => void }) => {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [activityId, setActivityId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const key = await authedFetch('/.netlify/functions/dev-keys', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      setNewSecret(key.secret);
      setName('');
      onChange();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create key.');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm('Revoke this key? Apps using it will stop working — this cannot be undone.')) return;
    setBusyId(id);
    try {
      await authedFetch('/.netlify/functions/dev-keys', { method: 'DELETE', body: JSON.stringify({ id }) });
      onChange();
    } catch (err) {
      setRowError({ id, message: err instanceof Error ? err.message : 'Failed to revoke key.' });
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (key: ApiKey) => {
    setBusyId(key.id);
    try {
      await authedFetch('/.netlify/functions/dev-keys', {
        method: 'PATCH',
        body: JSON.stringify({ id: key.id, active: !key.active }),
      });
      onChange();
    } catch (err) {
      setRowError({ id: key.id, message: err instanceof Error ? err.message : 'Failed to update key.' });
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (key: ApiKey) => {
    setEditingId(key.id);
    setEditName(key.name);
    setActivityId(null);
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setBusyId(id);
    try {
      await authedFetch('/.netlify/functions/dev-keys', {
        method: 'PATCH',
        body: JSON.stringify({ id, name: editName.trim() }),
      });
      setEditingId(null);
      onChange();
    } catch (err) {
      setRowError({ id, message: err instanceof Error ? err.message : 'Failed to rename key.' });
    } finally {
      setBusyId(null);
    }
  };

  const activeKeys = keys.filter(k => !k.revoked_at);

  return (
    <div className="space-y-5">
      {/* Create form */}
      <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-card/40 backdrop-blur-xl p-5">
        <h3 className="text-sm font-medium text-foreground mb-1">Generate new key</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Name the key so you can easily tell it apart (e.g. "Production", "Slack Backend").
        </p>
        <Label htmlFor="new-key-name" className="sr-only">Key name</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="new-key-name"
            name="key-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name"
            className="flex-1"
          />
          <Button onClick={create} disabled={!name.trim() || creating} className="gap-2">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Generate key
          </Button>
        </div>
        {createError && <p className="text-xs text-destructive mt-2">{createError}</p>}
      </div>

      {/* Newly created secret reveal */}
      <AnimatePresence>
        {newSecret && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl border border-primary/40 bg-primary/5 p-5"
          >
            <div className="flex items-start gap-3">
              <CircleCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Key generated</p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                  Copy it now — for security we will only show it once.
                </p>
                <SecretCopyBox secret={newSecret} />
                <button
                  onClick={() => setNewSecret(null)}
                  className="text-xs text-muted-foreground hover:text-foreground mt-3"
                >
                  I've saved the key, close
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keys list */}
      <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-card/40 backdrop-blur-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(var(--glass-border))] flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Your keys ({activeKeys.length})
          </p>
        </div>
        {activeKeys.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Key className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No API keys. Generate your first one.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[hsl(var(--glass-border))]">
            {activeKeys.map((k) => {
              const isEditing = editingId === k.id;
              const isActivityOpen = activityId === k.id;
              const keyUsage = usage.filter(u => u.api_key_id === k.id);
              const busy = busyId === k.id;
              return (
                <li key={k.id} className="px-5 py-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`edit-key-name-${k.id}`} className="sr-only">Key name</Label>
                          <Input
                            id={`edit-key-name-${k.id}`}
                            name="key-name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(k.id); if (e.key === 'Escape') setEditingId(null); }}
                            className="h-8 text-sm max-w-xs"
                            autoFocus
                          />
                          <Button size="sm" className="h-8 gap-1.5" disabled={!editName.trim() || busy} onClick={() => saveEdit(k.id)}>
                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </Button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:text-foreground">
                            <XIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground truncate">{k.name}</span>
                          <code className="text-xs font-data px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {k.prefix}…
                          </code>
                          {!k.active && (
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              Disabled
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Created {new Date(k.created_at).toLocaleDateString()} ·{' '}
                        {k.last_used_at ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never used'}
                      </p>
                      {rowError?.id === k.id && (
                        <p className="text-[11px] text-destructive mt-1">{rowError.message}</p>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                          aria-label="Key actions"
                          disabled={busy}
                        >
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startEdit(k)}>
                          <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setActivityId(isActivityOpen ? null : k.id); setEditingId(null); }}>
                          <ActivityIcon className="w-3.5 h-3.5 mr-2" /> Activity
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(k)}>
                          {k.active ? <Ban className="w-3.5 h-3.5 mr-2" /> : <PlayCircle className="w-3.5 h-3.5 mr-2" />}
                          {k.active ? 'Disable' : 'Enable'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => revoke(k.id)} className="text-destructive focus:text-destructive">
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Revoke
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <AnimatePresence>
                    {isActivityOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 rounded-xl border border-[hsl(var(--glass-border))] bg-muted/20 overflow-hidden"
                      >
                        {keyUsage.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-muted-foreground">
                            No activity yet — shows the last 50 authorized requests once this key is used.
                          </p>
                        ) : (
                          <ul className="divide-y divide-[hsl(var(--glass-border))] max-h-48 overflow-y-auto">
                            {keyUsage.map(u => (
                              <li key={u.id} className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                                <CircleCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                Authorized request · {new Date(u.created_at).toLocaleString()}
                              </li>
                            ))}
                          </ul>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Keys authorize requests to the public API — send them in the{' '}
        <code className="font-data text-foreground bg-muted px-1.5 py-0.5 rounded">Authorization: Bearer …</code> header.
        See the <Link to="/docs/api" className="text-primary hover:underline">API docs</Link> for endpoints.
      </p>
    </div>
  );
};

const SecretCopyBox = ({ secret }: { secret: string }) => {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(true);
  const copy = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="flex items-center gap-2 bg-background border border-[hsl(var(--glass-border))] rounded-lg p-2">
      <code className="flex-1 text-xs font-data text-foreground/90 truncate">
        {visible ? secret : '•'.repeat(secret.length)}
      </code>
      <button onClick={() => setVisible(v => !v)} className="p-1.5 text-muted-foreground hover:text-foreground">
        {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
      <button onClick={copy} className="p-1.5 text-muted-foreground hover:text-foreground">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};

// ── Webhooks section ────────────────────────────────────────────
const WebhooksSection = ({ hooks, deliveries, onChange }: {
  hooks: WebhookRow[];
  deliveries: Delivery[];
  onChange: () => void;
}) => {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEvent[]>(['analysis.completed']);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [testing, setTesting] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const toggleEvent = (e: WebhookEvent) =>
    setEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);

  const isValidUrl = useMemo(() => {
    try { return new URL(url).protocol === 'https:'; } catch { return false; }
  }, [url]);

  const create = async () => {
    if (!isValidUrl || events.length === 0) return;
    setCreating(true);
    setCreateError('');
    try {
      const hook = await authedFetch('/.netlify/functions/dev-webhooks', {
        method: 'POST',
        body: JSON.stringify({ url, events }),
      });
      setNewSecret(hook.secret);
      setUrl('');
      setEvents(['analysis.completed']);
      onChange();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to add webhook.');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (hook: WebhookRow) => {
    try {
      await authedFetch('/.netlify/functions/dev-webhooks', {
        method: 'PATCH',
        body: JSON.stringify({ id: hook.id, active: !hook.active }),
      });
      onChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update webhook.');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    try {
      await authedFetch('/.netlify/functions/dev-webhooks', { method: 'DELETE', body: JSON.stringify({ id }) });
      onChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete webhook.');
    }
  };

  const test = async (hook: WebhookRow) => {
    setTesting(hook.id);
    try {
      await authedFetch('/.netlify/functions/dev-webhooks', {
        method: 'POST',
        body: JSON.stringify({ action: 'test', id: hook.id }),
      });
      onChange();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Test delivery failed.');
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Create form */}
      <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-card/40 backdrop-blur-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-1">Add webhook</h3>
          <p className="text-xs text-muted-foreground">
            We send a signed POST with JSON to the given URL when the selected event occurs.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="webhook-url" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Endpoint URL</Label>
          <Input
            id="webhook-url"
            name="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-domain.com/webhooks/presora"
            className={cn(
              url && !isValidUrl && 'border-red-500/60'
            )}
          />
          {url && !isValidUrl && (
            <p className="text-[11px] text-red-400">A valid HTTPS URL is required</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Events</Label>
          <div className="grid sm:grid-cols-2 gap-2">
            {ALL_EVENTS.map(ev => {
              const checked = events.includes(ev.id);
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => toggleEvent(ev.id)}
                  className={cn(
                    'text-left p-3 rounded-xl border transition-colors',
                    checked
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-[hsl(var(--glass-border))] bg-muted/20 hover:bg-muted/40'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-3.5 h-3.5 rounded border flex items-center justify-center',
                      checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                    )}>
                      {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    <code className="text-xs font-data text-foreground">{ev.label}</code>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 ml-5.5">{ev.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <Button onClick={create} disabled={!isValidUrl || events.length === 0 || creating} className="gap-2">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add webhook
        </Button>
        {createError && <p className="text-xs text-destructive">{createError}</p>}
      </div>

      {/* Newly created secret reveal */}
      <AnimatePresence>
        {newSecret && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl border border-primary/40 bg-primary/5 p-5"
          >
            <div className="flex items-start gap-3">
              <CircleCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Webhook added</p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                  Signing secret — use it to verify the <code className="font-data">X-Presora-Signature</code> header on incoming deliveries.
                </p>
                <SecretCopyBox secret={newSecret} />
                <button
                  onClick={() => setNewSecret(null)}
                  className="text-xs text-muted-foreground hover:text-foreground mt-3"
                >
                  I've saved the secret, close
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-card/40 backdrop-blur-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(var(--glass-border))]">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Your webhooks ({hooks.length})
          </p>
        </div>
        {hooks.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Webhook className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No webhooks. Add your first one above.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[hsl(var(--glass-border))]">
            {hooks.map((h) => (
              <li key={h.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      'inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded',
                      h.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground'
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', h.active ? 'bg-emerald-400' : 'bg-muted-foreground')} />
                      {h.active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <code className="text-xs font-data text-foreground/90 break-all">{h.url}</code>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {h.events.map(ev => (
                      <span key={ev} className="text-[10px] font-data px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => test(h)} disabled={testing === h.id} className="gap-1.5">
                    {testing === h.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    Test
                  </Button>
                  <button
                    onClick={() => toggleActive(h)}
                    className="px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {h.active ? 'Pause' : 'Resume'}
                  </button>
                  <button onClick={() => remove(h.id)} className="p-2 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Deliveries */}
      <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-card/40 backdrop-blur-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(var(--glass-border))]">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Recent deliveries
          </p>
        </div>
        {deliveries.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No deliveries yet. Click "Test" on a webhook to send a sample event.
          </div>
        ) : (
          <ul className="divide-y divide-[hsl(var(--glass-border))]">
            {deliveries.map(d => {
              const hook = hooks.find(h => h.id === d.webhook_id);
              return (
                <li key={d.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                  {d.ok
                    ? <CircleCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    : <CircleX className="w-4 h-4 text-red-400 shrink-0" />}
                  <code className="text-xs font-data text-foreground">{d.event}</code>
                  <span className="text-xs text-muted-foreground truncate flex-1">{hook?.url ?? '—'}</span>
                  <span className={cn(
                    'text-xs font-data font-medium',
                    d.ok ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {d.status_code ? `HTTP ${d.status_code}` : (d.error || 'Failed')}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(d.created_at).toLocaleTimeString()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Developers;
