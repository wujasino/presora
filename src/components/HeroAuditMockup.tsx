import { ArrowRight, Search, Sparkles } from 'lucide-react';

const EXAMPLES = ['Tesla', 'Apple', 'Nike'];
const MODELS = [
  { name: 'ChatGPT', color: 'bg-emerald-400' },
  { name: 'Claude', color: 'bg-orange-400' },
  { name: 'Gemini', color: 'bg-blue-400' },
  { name: 'Perplexity', color: 'bg-cyan-400' },
  { name: 'Mistral', color: 'bg-orange-500' },
  { name: 'Llama', color: 'bg-blue-500' },
];

export const HeroAuditMockup = () => (
  <div aria-label="AI audit form preview" className="w-full">
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/75 p-2 shadow-lg shadow-slate-900/5 backdrop-blur-xl sm:flex-row dark:border-white/10 dark:bg-slate-950/70 dark:shadow-black/20">
      <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left text-sm text-muted-foreground">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="truncate">Your company or a competitor (e.g. Apple)</span>
      </div>
      <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
        <Sparkles className="h-4 w-4" />
        Generate my free AI audit
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>

    <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
      <span className="mr-1 uppercase tracking-[0.18em] text-muted-foreground/70">Try</span>
      {EXAMPLES.map((example) => (
        <button
          key={example}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/60 px-3 py-1.5 font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 dark:border-white/10 dark:bg-white/[0.04]"
        >
          <Sparkles className="h-3 w-3" />
          {example}
        </button>
      ))}
    </div>

    <p className="mt-4 text-center text-xs text-muted-foreground">
      Result in ~15 seconds · 3 free scans to start · No credit card required
    </p>

    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground/75">
      <span className="uppercase tracking-[0.14em]">Live analysis across</span>
      {MODELS.map((model) => (
        <span key={model.name} className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${model.color}`} />
          {model.name}
        </span>
      ))}
    </div>
  </div>
);
