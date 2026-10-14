import { ArrowRight, Bot, CircleAlert, MessageSquare, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const SCORE_ROWS = [
  {
    label: 'Your brand',
    value: 15,
    barClass: 'bg-rose-400',
    valueClass: 'text-rose-300',
  },
  {
    label: 'Top competitor',
    value: 75,
    barClass: 'bg-primary',
    valueClass: 'text-primary',
  },
];

export const HeroProofMockup = () => (
  <div className="mx-auto w-full max-w-5xl">
    <div className="overflow-hidden rounded-3xl border border-slate-700/80 bg-[#080d18] text-left shadow-2xl shadow-black/25">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <span className="font-data text-[9px] uppercase tracking-[0.18em] text-slate-500">
          Illustrative AI visibility example
        </span>
      </div>

      <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="border-b border-slate-800 p-5 sm:p-7 lg:border-b-0 lg:border-r">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="font-data text-[10px] uppercase tracking-[0.18em] text-primary">You vs. the competition</p>
              <h2 className="mt-2 text-lg font-semibold text-white sm:text-xl">AI recommendation share</h2>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-5">
            {SCORE_ROWS.map((row) => (
              <div key={row.label}>
                <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-slate-200">{row.label}</span>
                  <span className={`font-data text-lg font-semibold ${row.valueClass}`}>{row.value}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                  <div className={`h-full rounded-full ${row.barClass}`} style={{ width: `${row.value}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/8 p-4">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <div>
              <p className="text-sm font-semibold text-rose-200">60-point visibility gap</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">Your competitor is far more likely to appear in an AI recommendation.</p>
            </div>
          </div>
        </section>

        <section className="p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500">Proof from the answer</p>
              <h2 className="mt-1 text-lg font-semibold text-white">What your customer sees</h2>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5">
            <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-slate-800 px-4 py-3 text-sm leading-relaxed text-slate-200">
              Which SEO tool would you recommend?
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-tl-md border border-slate-800 bg-slate-900 px-4 py-3 text-sm leading-relaxed text-slate-300">
                I recommend <span className="font-semibold text-white">Top Competitor</span> because it has strong category authority, consistent reviews and clear product information…
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-slate-800 pt-3 text-xs text-slate-500">
              <span className="line-through decoration-rose-400/80 decoration-2">Your Brand</span>
              <span>was not mentioned.</span>
            </div>
          </div>
        </section>
      </div>
    </div>

    <div className="mt-6 text-center">
      <Link
        to="/register"
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:opacity-95 sm:w-auto sm:text-base"
      >
        Check your score free in 30 seconds
        <ArrowRight className="h-4 w-4" />
      </Link>
      <p className="mt-2 text-xs text-muted-foreground">Free first scan · No credit card required</p>
    </div>
  </div>
);
