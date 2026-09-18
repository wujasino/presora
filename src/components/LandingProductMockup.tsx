import { BarChart3, ChevronDown, Circle, Folder, LayoutDashboard, Plus, Search, Settings2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const SCANS = [
  { name: 'Tesla', detail: 'AI visibility audit', status: 'Live', color: 'bg-emerald-400' },
  { name: 'Northstar Studio', detail: 'Last scan 18 min ago', status: '78 / 100', color: 'bg-violet-400' },
  { name: 'Morrow Coffee', detail: 'Last scan yesterday', status: '64 / 100', color: 'bg-amber-400' },
  { name: 'Arcform', detail: 'Queued for analysis', status: 'Queued', color: 'bg-slate-500' },
];

export const LandingProductMockup = () => (
  <section aria-label="Presora product preview" className="px-4 pb-20 sm:pb-28">
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7 }}
      className="mx-auto max-w-6xl"
    >
      <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-[#111318] shadow-2xl shadow-slate-950/30">
        <div className="flex h-9 items-center gap-1.5 border-b border-white/10 bg-[#17191e] px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <div className="ml-3 hidden h-5 flex-1 rounded-md bg-white/[0.04] sm:block" />
        </div>

        <div className="grid min-h-[360px] grid-cols-1 md:grid-cols-[190px_1fr]">
          <aside className="hidden border-r border-white/10 bg-[#0b0c0f] p-4 md:block">
            <div className="mb-8 flex items-center gap-2 text-sm font-semibold text-white">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-[11px] font-bold text-slate-900">P</span>
              presora
            </div>
            <div className="space-y-1 text-xs text-slate-400">
              <div className="flex items-center gap-2 rounded-md bg-white/10 px-2.5 py-2 text-white">
                <LayoutDashboard className="h-3.5 w-3.5" /> Overview
              </div>
              <div className="flex items-center gap-2 px-2.5 py-2">
                <BarChart3 className="h-3.5 w-3.5" /> AI visibility
              </div>
              <div className="flex items-center gap-2 px-2.5 py-2">
                <Search className="h-3.5 w-3.5" /> Audits
              </div>
            </div>
            <div className="mt-8 flex items-center gap-2 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              <Folder className="h-3.5 w-3.5" /> Workspaces
            </div>
            <div className="mt-2 space-y-1 text-xs text-slate-400">
              <div className="flex items-center justify-between px-2.5 py-1.5 text-slate-200">
                <span>Acme Agency</span><ChevronDown className="h-3 w-3" />
              </div>
              <div className="pl-5 text-slate-500">Client audits</div>
              <div className="pl-5 text-slate-500">Reports</div>
            </div>
            <div className="mt-10 flex items-center gap-2 px-2.5 text-xs text-slate-500">
              <Settings2 className="h-3.5 w-3.5" /> Settings
            </div>
          </aside>

          <div className="p-5 sm:p-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">Workspace / client audits</p>
                <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">AI visibility audits</h2>
                <p className="mt-1 text-xs text-slate-500">See which brands AI assistants recommend.</p>
              </div>
              <button className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-200">
                <Plus className="h-3.5 w-3.5" /> New audit
              </button>
            </div>

            <div className="mb-5 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-slate-500">
              <Search className="h-3.5 w-3.5" />
              Search audits
              <div className="ml-auto hidden items-center gap-1 sm:flex">
                <span className="rounded bg-white/10 px-2 py-1 text-[10px] text-slate-300">All</span>
                <span className="px-2 py-1 text-[10px]">Active</span>
                <span className="px-2 py-1 text-[10px]">Archived</span>
              </div>
            </div>

            <div className="divide-y divide-white/[0.07] rounded-lg border border-white/[0.08]">
              {SCANS.map((scan, index) => (
                <div key={scan.name} className="flex items-center gap-3 px-3 py-3.5 sm:px-4">
                  <Circle className={`h-3.5 w-3.5 shrink-0 ${index === 0 ? 'fill-emerald-400 text-emerald-400' : 'text-slate-600'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                      {scan.name}
                      {index === 0 && <Sparkles className="h-3 w-3 text-emerald-400" />}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{scan.detail}</p>
                  </div>
                  <div className="hidden items-center gap-2 text-[11px] text-slate-400 sm:flex">
                    <span className={`h-1.5 w-1.5 rounded-full ${scan.color}`} />
                    {scan.status}
                  </div>
                  <span className="text-slate-600">···</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2 text-[11px] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Scans run across ChatGPT, Claude, Gemini and 3 more models
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  </section>
);
