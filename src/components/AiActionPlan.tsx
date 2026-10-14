import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, Loader2, Zap, ChevronDown, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { isStepDone, setStepDone } from '@/lib/actionPlanProgress';

type Priority = 'high' | 'medium' | 'low';

interface ActionStep {
  title: string;
  description: string;
  priority?: Priority;
  category?: string;
}

interface ActionPlan {
  whyIgnored: string;
  steps: ActionStep[];
  quickWin: string;
}

const PRIORITY_STYLE: Record<Priority, { label: string; className: string }> = {
  high: { label: 'High priority', className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25' },
  medium: { label: 'Medium priority', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25' },
  low: { label: 'Low priority', className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25' },
};

const StepRow = ({ step, index, analysisId }: { step: ActionStep; index: number; analysisId: string }) => {
  const [expanded, setExpanded] = useState(false);
  // Persisted to localStorage (see lib/actionPlanProgress) so Home's "Tasks
  // Status" tile can show a real completed count next to the dimension-
  // health pie chart — still nothing sent to the backend, just remembered
  // in this browser. The strike-through on check is the psychological
  // "done" cue the original spec asked for.
  const [done, setDone] = useState(() => isStepDone(analysisId, index));

  const toggle = () => {
    setDone((v) => {
      const next = !v;
      setStepDone(analysisId, index, next);
      return next;
    });
  };
  const priority = step.priority && PRIORITY_STYLE[step.priority] ? step.priority : null;

  return (
    <li className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={done}
          onChange={toggle}
          className="mt-0.5 w-3.5 h-3.5 shrink-0 rounded border-border accent-primary cursor-pointer"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {priority && (
              <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide border', PRIORITY_STYLE[priority].className)}>
                {PRIORITY_STYLE[priority].label}
              </span>
            )}
            {step.category && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground border border-border/60">
                {step.category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs font-medium text-foreground/90', done && 'line-through text-muted-foreground')}>
              {index + 1}. {step.title}
            </span>
            <ChevronDown className={cn('w-3 h-3 text-muted-foreground shrink-0 transition-transform', expanded && 'rotate-180')} />
          </div>
          {expanded && (
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{step.description}</p>
          )}
        </button>
      </div>
    </li>
  );
};

// Generic filler shown blurred behind the paywall for Free/Starter accounts.
// Deliberately NOT real analysis content — a blur is only a visual effect,
// the underlying text is still in the DOM and readable via devtools, so the
// gated state never fetches or renders the real plan at all.
const PLACEHOLDER_PLAN: ActionPlan = {
  whyIgnored: 'AI models currently favor other brands in this category based on the signals in your scan — unlock to see exactly why, in plain language.',
  steps: [
    { title: 'Strengthen a key trust signal', description: 'Placeholder — unlock to see the real, brand-specific step.', priority: 'high', category: 'Locked' },
    { title: 'Close a visibility gap', description: 'Placeholder — unlock to see the real, brand-specific step.', priority: 'medium', category: 'Locked' },
    { title: 'Improve a weak dimension', description: 'Placeholder — unlock to see the real, brand-specific step.', priority: 'low', category: 'Locked' },
  ],
  quickWin: 'Unlock to see the one simple change you can make today.',
};

/**
 * "AI Action Plan & GEO Recommendations (Beta)" — renders directly under
 * the red "AI recommends your competitors" alert in Dashboard's ScoreHero
 * (only mounted when score < 60). Calls generate-action-plan.js once per
 * analysis; the function itself caches the result on the row, so revisiting
 * the same report is a plain read.
 *
 * Two-column layout (checklist left, Quick Win pinned right) per the
 * requested design — checkboxes and the expand/collapse per step are local
 * UI state only, never persisted; the point is the to-do-list feel, not a
 * real tracked task list.
 *
 * Free/Starter accounts see a blurred, generic placeholder plus an "Unlock
 * Premium" overlay instead of the real plan — the withheld-value hook for
 * cold-outreach demos. No API call happens for a gated account, so no real
 * plan content is ever generated or present in the DOM for it to leak.
 */
export const AiActionPlan = ({ analysisId, plan: accountPlan }: { analysisId: string; plan: string }) => {
  const navigate = useNavigate();
  const isGated = ['free', 'starter'].includes(accountPlan.toLowerCase());
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isGated) { setLoading(false); return; }
    let cancelled = false;
    setPlan(null);
    setError(false);
    setLoading(true);

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) { setLoading(false); setError(true); }
        return;
      }
      try {
        const res = await fetch('/.netlify/functions/generate-action-plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ analysisId }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (!cancelled) setPlan(data.plan);
      } catch (err) {
        console.error('AiActionPlan: failed to generate plan:', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [analysisId, isGated]);

  if (!isGated && error) return null;

  const displayPlan = isGated ? PLACEHOLDER_PLAN : plan;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.4, duration: 0.4 }}
      className="relative mt-4 rounded-xl border border-primary/20 bg-primary/4 p-4 sm:p-5 overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-0.5">
        <ClipboardList className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">AI Action Plan &amp; GEO Recommendations</p>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
          Beta
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Prioritized checklist generated by AI to improve your brand visibility in LLMs.
      </p>

      {!isGated && loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Generuję plan naprawczy…
        </div>
      )}

      {displayPlan && (
        <div className={cn('grid grid-cols-1 lg:grid-cols-10 gap-4', isGated && 'blur-xs select-none pointer-events-none')} aria-hidden={isGated}>
          {/* Left column (~70%) — why-ignored + checklist */}
          <div className="lg:col-span-7 space-y-3">
            <div>
              <p className="text-xs font-semibold text-foreground/90 mb-1">🛑 Dlaczego AI Cię pomija?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{displayPlan.whyIgnored}</p>
            </div>
            <ul className="space-y-2">
              {displayPlan.steps.map((step, i) => (
                <StepRow key={i} step={step} index={i} analysisId={analysisId} />
              ))}
            </ul>
          </div>

          {/* Right column (~30%) — Quick Win, pinned */}
          <div className="lg:col-span-3">
            <div className="h-full rounded-lg border border-emerald-500/25 bg-emerald-500/6 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs font-semibold text-foreground/90">Quick Win</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{displayPlan.quickWin}</p>
            </div>
          </div>
        </div>
      )}

      {isGated && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/50 backdrop-blur-[2px] text-center px-6">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Lock className="w-4 h-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground max-w-xs">
            Odblokuj pakiet Premium, aby zobaczyć 3 krytyczne kroki naprawcze przygotowane przez AI dla Twojej marki
          </p>
          <button
            type="button"
            onClick={() => navigate('/pricing')}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            Unlock Premium
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default AiActionPlan;
