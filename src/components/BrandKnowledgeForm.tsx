import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Plus, Trash2, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useSessionUser } from '@/hooks/useAccountInfo';

interface Fragment {
  id: string;
  content: string;
  created_at: string;
}

interface BrandKnowledgeFormProps {
  brandName: string;
  /** Bump this to force the form open and scroll it into view — used by the
   *  low-confidence banner on the results screen, which is the natural
   *  bridge into "add context to improve this". */
  forceExpandSignal?: number;
}

export default function BrandKnowledgeForm({ brandName, forceExpandSignal }: BrandKnowledgeFormProps) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [loadingFragments, setLoadingFragments] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Collapsed by default everywhere — on the results screen this used to be
  // expanded-by-default on desktop and pushed the actual scan (the reason
  // someone is on the page) below the fold, empty or not. Auto-expands once
  // if it turns out there's already saved content, so a returning user
  // isn't hiding notes they already wrote; a user who deliberately
  // collapses it afterwards is left alone (autoExpandedRef fires once).
  const [expanded, setExpanded] = useState(false);
  const autoExpandedRef = useRef(false);
  const [expandedFragment, setExpandedFragment] = useState<string | null>(null);

  const { data: sessionUser } = useSessionUser();
  const userId = sessionUser?.id ?? null;

  const loadFragments = useCallback(async () => {
    if (!brandName.trim() || !userId) return;
    setLoadingFragments(true);
    try {
      const { data } = await supabase
        .from('brand_knowledge')
        .select('id, content, created_at')
        .eq('user_id', userId)
        .eq('brand_name', brandName.trim())
        .order('created_at', { ascending: false });
      setFragments(data ?? []);
    } finally {
      setLoadingFragments(false);
    }
  }, [brandName, userId]);

  useEffect(() => {
    loadFragments();
  }, [loadFragments]);

  useEffect(() => {
    if (!loadingFragments && fragments.length > 0 && !autoExpandedRef.current) {
      autoExpandedRef.current = true;
      setExpanded(true);
    }
  }, [loadingFragments, fragments.length]);

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!forceExpandSignal) return;
    setExpanded(true);
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [forceExpandSignal]);

  const handleSave = async () => {
    if (!brandName.trim()) { setStatus('error'); setMessage('Enter a brand name first.'); return; }
    if (text.trim().length < 20) { setStatus('error'); setMessage('Min. 20 characters.'); return; }

    setStatus('loading');
    setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('You must be signed in.');

      const res = await fetch('/.netlify/functions/ingest-knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ brandName, text }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save.');

      setStatus('ok');
      setMessage(`Saved ${result.inserted} fragment(s).`);
      setText('');
      await loadFragments();
      setTimeout(() => { setStatus('idle'); setMessage(''); }, 3000);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Unknown error.');
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await supabase.from('brand_knowledge').delete().eq('id', id);
      setFragments(prev => prev.filter(f => f.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const charCount = text.length;
  const isValid = text.trim().length >= 20;
  const isEmpty = !loadingFragments && fragments.length === 0;

  // Collapsed and confirmed empty: a single slim bar rather than the full
  // icon+badge+subtitle header below — that fuller header pulled focus even
  // when there was nothing in it yet to justify the space.
  if (!expanded && isEmpty) {
    return (
      <div ref={rootRef}>
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/20 bg-primary/4 hover:bg-primary/8 transition-colors text-left"
        >
          <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs text-muted-foreground flex-1">Add brand context to improve accuracy</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary shrink-0">
            <Plus className="w-3.5 h-3.5" /> Add
          </span>
        </button>
      </div>
    );
  }

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/25 bg-primary/5 backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <BookOpen className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Brand knowledge base</p>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                Improves results
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loadingFragments ? 'Loading…' : fragments.length > 0
                ? `${fragments.length} fragment${fragments.length === 1 ? '' : 's'} · ${brandName}`
                : 'Add context to help AI better understand your brand'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {fragments.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
              {fragments.length}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-5 border-t border-[hsl(var(--glass-border))]">

              {/* Add new fragment */}
              <div className="pt-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Paste a description, positioning, or facts about the brand. The analysis will use this as verified context instead of relying only on the model's general knowledge.
                </p>
                <div className="relative">
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="E.g. Brand X is a manufacturer... founded in... their flagship product is... their values are..."
                    rows={4}
                    className="w-full bg-background/60 border border-[hsl(var(--glass-border))] rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 px-4 py-3 resize-none focus:outline-hidden focus:border-primary/40 transition-colors"
                  />
                  <span className={cn(
                    'absolute bottom-2.5 right-3 text-[10px] font-data',
                    charCount > 2000 ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    {charCount}/2000
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleSave}
                    disabled={status === 'loading' || !isValid || charCount > 2000}
                    size="sm"
                    className="gap-1.5"
                  >
                    {status === 'loading'
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                      : <><Plus className="w-3.5 h-3.5" /> Add fragment</>}
                  </Button>

                  <AnimatePresence mode="wait">
                    {message && (
                      <motion.span
                        key={message}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                          'flex items-center gap-1.5 text-xs',
                          status === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                        )}
                      >
                        {status === 'ok'
                          ? <CheckCircle2 className="w-3.5 h-3.5" />
                          : <AlertCircle className="w-3.5 h-3.5" />}
                        {message}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Saved fragments */}
              {fragments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 pt-1">
                    Saved fragments
                  </p>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {fragments.map(fragment => (
                      <div
                        key={fragment.id}
                        className="rounded-xl border border-[hsl(var(--glass-border))] bg-muted/20 p-3 group"
                      >
                        <div className="flex items-start gap-2.5">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap wrap-break-word',
                              expandedFragment !== fragment.id && 'line-clamp-2'
                            )}>
                              {fragment.content}
                            </p>
                            {fragment.content.length > 120 && (
                              <button
                                onClick={() => setExpandedFragment(expandedFragment === fragment.id ? null : fragment.id)}
                                className="text-[10px] text-primary hover:underline mt-1"
                              >
                                {expandedFragment === fragment.id ? 'Collapse' : 'Expand'}
                              </button>
                            )}
                            <p className="text-[10px] text-muted-foreground/40 mt-1.5 font-data">
                              {new Date(fragment.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDelete(fragment.id)}
                            disabled={deletingId === fragment.id}
                            className="shrink-0 w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 flex items-center justify-center transition-all"
                            aria-label="Delete fragment"
                          >
                            {deletingId === fragment.id
                              ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                              : <Trash2 className="w-3 h-3 text-destructive/70" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!loadingFragments && fragments.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground/50">
                    No saved knowledge for "{brandName}". Add your first fragment above.
                  </p>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
