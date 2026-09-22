import { BarChart3, Bell, Bot, ChevronRight, CircleHelp, FileText, Gauge, Home, LockKeyhole, Menu, Palette, RefreshCw, Search, Sparkles, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { lazy, Suspense, useState } from 'react';
import { useTheme } from 'next-themes';

const RealDashboard = lazy(() => import('@/pages/Dashboard'));
const RealAutomations = lazy(() => import('@/pages/Automations'));
const RealGoogleVisibility = lazy(() => import('@/pages/GoogleVisibility'));
const RealCompetitorTracker = lazy(() => import('@/pages/CompetitorTracker'));
const RealPricing = lazy(() => import('@/pages/Pricing'));

const RealBrandScan = () => <RealDashboard demoScan />;

const REAL_SCREENS = {
  'Brand Scan': RealBrandScan,
  Automations: RealAutomations,
  'Google Visibility': RealGoogleVisibility,
  'Competitor Tracker': RealCompetitorTracker,
  Subscription: RealPricing,
} as const;

const REPORTS = [
  { score: 34, name: 'Hipets', date: 'Aug 20, 2026' },
  { score: 26, name: 'Presora', date: 'Aug 19, 2026' },
  { score: 41, name: 'Semcore', date: 'Aug 17, 2026' },
  { score: 32, name: 'Pikseo', date: 'Aug 17, 2026' },
  { score: 36, name: 'Greenparrot', date: 'Aug 17, 2026' },
];

const DIMENSIONS = [
  { name: 'Authority', value: 25 },
  { name: 'Sentiment', value: 54 },
  { name: 'Accuracy', value: 38 },
  { name: 'Mentions', value: 19 },
  { name: 'Recency', value: 35 },
];

const MODELS = ['GPT-4o', 'Claude', 'Gemini', 'Perplexity', 'Mistral', 'Llama 3'];

export const LandingProductMockup = () => (
  <LandingProductMockupContent />
);

const LandingProductMockupContent = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const [activeNav, setActiveNav] = useState('Home');
  const [notice, setNotice] = useState('');
  const [scanUrl, setScanUrl] = useState('hipets.com');
  const [automationPrompt, setAutomationPrompt] = useState('');
  const [automationTab, setAutomationTab] = useState<'Chat' | 'Preview'>('Chat');
  const [googleTab, setGoogleTab] = useState<'Audit a page' | 'Generate tags'>('Audit a page');
  const [googleUrl, setGoogleUrl] = useState('');
  const [tagFields, setTagFields] = useState({
    brand: 'Acme Inc.',
    title: 'Acme Inc. — Cloud accounting for small teams',
    description: '',
    canonical: 'https://acme.com/',
    image: 'https://acme.com/og-image.png',
    logo: 'https://acme.com/logo.png',
    socials: 'https://x.com/acme\nhttps://linkedin.com/company/acme',
  });
  const [selectedCompetitor, setSelectedCompetitor] = useState('Semcore');
  const [selectedReport, setSelectedReport] = useState('');
  const [clientBranding, setClientBranding] = useState({
    name: 'Presora Agency',
    email: 'hello@presora.agency',
    website: 'presora.agency',
  });

  const goTo = (label: string) => {
    const pageScrollY = window.scrollY;
    setActiveNav(label);
    const restorePageScroll = () => {
      window.scrollTo(0, pageScrollY);
    };
    window.requestAnimationFrame(restorePageScroll);
    window.setTimeout(restorePageScroll, 0);
    window.setTimeout(restorePageScroll, 100);
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  };

  const renderSection = () => {
    const RealScreen = REAL_SCREENS[activeNav as keyof typeof REAL_SCREENS];
    if (RealScreen) {
      return (
        <Suspense fallback={<div className="flex min-h-[320px] items-center justify-center text-xs text-slate-400">Loading dashboard view...</div>}>
          <div className="min-h-[320px] overflow-hidden rounded-lg bg-background [&_main]:!min-h-0">
            <RealScreen />
          </div>
        </Suspense>
      );
    }

    if (activeNav === 'Home') {
      return (
        <>
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-100">Home</span>
                <button onClick={() => goTo('Brand Scan')} className="rounded-md bg-slate-200 px-2 py-1 text-[8px] font-medium text-slate-900 transition hover:bg-white">⌕&nbsp; Run new scan</button>
              </div>
              <p className="mt-1 text-[9px] text-slate-400">Your AI visibility, at a glance.</p>
            </div>
            <div className="flex gap-2">
              <div className="hidden items-center gap-2 rounded-lg border border-slate-700 bg-[#101725] px-2 py-1.5 sm:flex">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-[3px] border-rose-400 text-[7px] font-semibold text-slate-200">34</span>
                <span className="text-[7px] leading-tight text-slate-400">Dimension<br /><b className="text-slate-300">health</b><br /><i className="text-rose-400 not-italic">• 5 critical</i></span>
              </div>
              <div className="hidden min-w-[120px] rounded-lg border border-slate-700 bg-[#101725] px-2 py-1.5 text-[8px] text-slate-400 sm:block">Analyses this month <b className="float-right text-slate-200">0&nbsp; - unlimited</b><br /><span className="mt-1 block border-t border-slate-800 pt-1">Plan · <b className="text-slate-200">Agency</b><span className="float-right text-slate-500">›</span></span></div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_190px]">
            <div className="rounded-lg border border-slate-700 bg-[#101725] p-4">
              <div className="flex justify-between text-[8px] uppercase tracking-widest text-slate-500">AI visibility score <span className="normal-case tracking-normal">Aug 20, 2026</span></div>
              <div className="mt-1 text-sm font-semibold text-slate-200">Hipets</div>
              <div className="mt-1 flex items-baseline gap-1"><span className="text-3xl font-semibold text-rose-400">34</span><span className="text-xs text-slate-500">/100</span><span className="ml-2 text-[8px] text-slate-500">First scan</span></div>
              <div className="mt-4 grid grid-cols-5 gap-2 border-t border-slate-800 pt-3">
                {DIMENSIONS.map((item) => <div key={item.name} className="min-w-0"><div className="truncate text-[7px] text-slate-400">{item.name}</div><div className="mt-2 h-1 rounded bg-slate-700"><div className="h-full rounded bg-rose-400" style={{ width: `${item.value}%` }} /></div><div className="mt-1 text-[8px] text-slate-300">{item.value}%</div></div>)}
              </div>
              <button onClick={() => goTo('Reports')} className="mt-4 text-[9px] font-medium text-slate-300 transition hover:text-white">View full report <ChevronRight className="inline h-3 w-3" /></button>
            </div>
            <div className="rounded-lg border border-slate-700 bg-[#101725] p-3">
              <div className="text-[8px] uppercase tracking-widest text-slate-500">By AI model</div>
              <div className="mt-2 space-y-2 text-[9px] text-slate-400">{MODELS.map((model) => <div key={model} className="flex justify-between"><span>{model}</span><span className="text-slate-300">+ Enable & rescan</span></div>)}</div>
              <div className="mt-3 rounded border border-amber-500/20 bg-amber-500/10 p-2 text-[8px] leading-tight text-slate-300"><Sparkles className="mr-1 inline h-3 w-3 text-amber-400" />Incomplete picture — 6 of 6 models already paid for.</div>
            </div>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-[9px] font-semibold text-slate-300"><span>Recent reports</span><button onClick={() => goTo('Reports')} className="font-normal text-slate-500 hover:text-white">View all →</button></div>
            <div className="divide-y divide-slate-800 rounded-lg border border-slate-700 bg-[#101725]">{REPORTS.map((report) => <button key={report.name} onClick={() => showNotice(`${report.name} report selected`)} className="grid w-full grid-cols-[32px_1fr_70px_75px] items-center px-3 py-2 text-left text-[9px] transition hover:bg-slate-800/60"><span className="font-semibold text-rose-400">{report.score}</span><span className="font-medium text-slate-200">{report.name}</span><span className="text-slate-500">First scan</span><span className="text-right text-slate-400">{report.date}</span></button>)}</div>
          </div>
          <div className="mt-6">
            <div className="mb-2 text-[9px] font-semibold text-slate-300">Continue where you left off</div>
            <div className="grid gap-2 sm:grid-cols-2"><button onClick={() => showNotice('Demo scan started')} className="flex items-center justify-between rounded-lg border border-slate-700 bg-[#151d2b] p-3 text-left text-[9px] text-slate-200 transition hover:border-slate-500"><span><RefreshCw className="mr-2 inline h-3 w-3" />Re-scan Hipets<br /><small className="pl-5 text-slate-500">Last scanned Aug 20, 2026</small></span><ChevronRight className="h-3 w-3" /></button><button onClick={() => goTo('Automations')} className="flex items-center justify-between rounded-lg border border-slate-700 bg-[#101725] p-3 text-left text-[9px] text-slate-200 transition hover:border-slate-500"><span><Bot className="mr-2 inline h-3 w-3" />Track it automatically<br /><small className="pl-5 text-slate-500">Set up weekly monitoring</small></span><ChevronRight className="h-3 w-3" /></button></div>
          </div>
        </>
      );
    }

    if (activeNav === 'Brand Scan') {
      return <div className="flex min-h-[300px] flex-col items-center justify-center px-2 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-600 bg-slate-800/70 text-slate-200">
          <Search className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">Brand analysis</h3>
        <p className="mt-2 text-xs text-slate-400">Enter the brand name you want to analyze</p>
        <form onSubmit={(event) => { event.preventDefault(); showNotice(`Demo scan queued for ${scanUrl || 'your brand'}`); }} className="mt-8 flex w-full max-w-xl gap-2">
          <input aria-label="Brand name" value={scanUrl} onChange={(event) => setScanUrl(event.target.value)} placeholder="e.g. Apple, Tesla, Nike..." className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-[#101725] px-5 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-400 focus:border-slate-500" />
          <button className="rounded-xl bg-slate-200 px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-white">Analyze</button>
        </form>
        <p className="mt-6 text-[9px] uppercase tracking-[0.2em] text-slate-500">Or try a popular brand</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {['Coca-Cola', 'Tesla', 'Nike'].map((brand) => <button key={brand} type="button" onClick={() => setScanUrl(brand)} className="rounded-xl border border-slate-700 bg-[#101725] px-4 py-2 text-xs text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"><Sparkles className="mr-1 inline h-3 w-3" />{brand}</button>)}
        </div>
      </div>;
    }

    if (activeNav === 'Automations') {
      const examples = ['“Monitor Nike, and track Adidas and Puma weekly”', '“Alert me when my sentiment drops below 60”', '“Only query ChatGPT and Claude”'];
      return <div className="relative min-h-[390px] pb-16">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-300"><Bot className="h-4 w-4" /></div>
            <div><h3 className="text-sm font-semibold text-slate-100">Automations</h3><p className="text-[9px] text-slate-400">Set up monitoring by chat — no forms</p></div>
          </div>
          <button onClick={() => showNotice('Voice replies enabled in demo')} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[9px] text-slate-300 hover:border-slate-500">◖ Voice replies</button>
        </div>
        <div className="mt-4 inline-flex rounded-lg border border-slate-700 bg-[#101725] p-1">
          {(['Chat', 'Preview'] as const).map((tab) => <button key={tab} onClick={() => setAutomationTab(tab)} className={`rounded px-4 py-1.5 text-[9px] ${automationTab === tab ? 'bg-[#0b101b] text-slate-100' : 'text-slate-400 hover:text-white'}`}>{tab === 'Chat' ? '▱ ' : '◇ '}{tab}</button>)}
        </div>
        {automationTab === 'Chat' ? <div className="mt-10 rounded-xl border border-slate-700 bg-[#101725] p-4">
          <p className="text-xs leading-relaxed text-slate-300">Tell me what to monitor and I'll set it up — you review and confirm before anything saves.</p>
          <p className="mt-1 text-xs text-slate-300">Try:</p>
          <div className="mt-3 space-y-2">{examples.map((example) => <button key={example} onClick={() => setAutomationPrompt(example.replace(/[“”]/g, ''))} className="block w-full rounded-lg border border-slate-700 bg-[#0b101b] px-3 py-2 text-left text-xs text-slate-300 hover:border-slate-500">{example}</button>)}</div>
        </div> : <div className="mt-10 rounded-xl border border-slate-700 bg-[#101725] p-4 text-xs text-slate-400">Your automation preview will appear here before it is saved.</div>}
        <form onSubmit={(event) => { event.preventDefault(); if (automationPrompt.trim()) showNotice('Automation prepared for review'); }} className="absolute bottom-0 left-0 right-0 flex items-center gap-2 rounded-xl border border-slate-700 bg-[#101725] p-1.5">
          <button type="button" onClick={() => showNotice('Automation options opened')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400">⌄</button>
          <input aria-label="Automation prompt" value={automationPrompt} onChange={(event) => setAutomationPrompt(event.target.value)} placeholder="e.g. track Tesla and Rivian daily" className="min-w-0 flex-1 bg-transparent px-2 text-[10px] text-slate-200 outline-none placeholder:text-slate-400" />
          <button aria-label="Send automation prompt" className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500 text-slate-950 hover:bg-slate-300">↑</button>
        </form>
      </div>;
    }

    if (activeNav === 'Google Visibility') {
      return <div className="space-y-4">
        <div className="flex items-start gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-600 bg-slate-800/70 text-slate-300">◉</div>
          <div><h3 className="text-sm font-semibold text-slate-100">Google visibility</h3><p className="max-w-xl text-[9px] leading-relaxed text-slate-400">Check whether a page is set up to be found and understood by Google, and generate the meta tags and structured data to fix what's missing. This looks at the page itself — no Google account or Search Console access needed.</p></div>
        </div>
        <div className="inline-flex rounded-lg border border-slate-800 bg-[#101725] p-1">
          {(['Audit a page', 'Generate tags'] as const).map((tab) => <button key={tab} onClick={() => setGoogleTab(tab)} className={`rounded px-3 py-1.5 text-[9px] ${googleTab === tab ? 'bg-[#0b101b] font-medium text-slate-100' : 'text-slate-400 hover:text-white'}`}>{tab}</button>)}
        </div>
        {googleTab === 'Audit a page' ? <form onSubmit={(event) => { event.preventDefault(); showNotice(`Demo audit started for ${googleUrl || 'the example page'}`); }} className="flex gap-2">
          <input aria-label="Page URL" value={googleUrl} onChange={(event) => setGoogleUrl(event.target.value)} placeholder="example.com or https://example.com/page" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#101725] px-3 py-2 text-[10px] text-slate-200 outline-none placeholder:text-slate-500" />
          <button className="rounded-lg bg-slate-300 px-3 py-2 text-[10px] font-medium text-slate-900">⌕ Run audit</button>
        </form> : <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
          <div className="space-y-3 rounded-xl border border-slate-700 bg-[#101725] p-3">
            {[
              ['brand', 'Brand / organisation name', 'input'],
              ['title', 'Page title', 'input'],
              ['description', 'Meta description', 'textarea'],
              ['canonical', 'Page URL (canonical)', 'input'],
              ['image', 'Social preview image URL', 'input'],
              ['logo', 'Logo URL (for structured data)', 'input'],
              ['socials', 'Social profile URLs (one per line, optional)', 'textarea'],
            ].map(([key, label, type]) => {
              const value = tagFields[key as keyof typeof tagFields];
              const setValue = (nextValue: string) => setTagFields((current) => ({ ...current, [key]: nextValue }));
              return <label key={key} className="block text-[8px] font-medium text-slate-400">{label}{(key === 'title' || key === 'description') && <span className="float-right font-normal text-slate-500">{key === 'title' ? value.length : value.length} chars</span>}{type === 'textarea' ? <textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder={key === 'description' ? 'A one-sentence summary of the page, written for someone who has never heard of you.' : 'https://x.com/acme'} className="mt-1 min-h-14 w-full resize-none rounded-lg border border-slate-700 bg-[#0b101b] px-2.5 py-2 text-[10px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-slate-500" /> : <input value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0b101b] px-2.5 py-2 text-[10px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-slate-500" />}</label>;
            })}
          </div>
          <div className="rounded-xl border border-slate-700 bg-[#101725] p-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200"><span>Generated tags</span><button onClick={() => { void navigator.clipboard?.writeText(`<title>${tagFields.title}</title>\n<meta name="description" content="${tagFields.description}">\n<link rel="canonical" href="${tagFields.canonical}">`); showNotice('Tags copied'); }} className="rounded-lg border border-slate-700 px-2 py-1 text-[9px] text-slate-400 hover:text-white">▣ Copy</button></div>
            <pre className="mt-3 min-h-[250px] whitespace-pre-wrap rounded-xl border border-slate-700 bg-[#0b101b] p-3 font-mono text-[9px] leading-relaxed text-slate-300">{`Fill in the fields on the left — the tags to paste into your page's <head> will show up here.\n\n${tagFields.brand ? `<meta property="og:site_name" content="${tagFields.brand}">` : ''}${tagFields.title ? `\n<title>${tagFields.title}</title>` : ''}${tagFields.description ? `\n<meta name="description" content="${tagFields.description}">` : ''}\n<link rel="canonical" href="${tagFields.canonical}">`}</pre>
            <p className="mt-3 text-[8px] leading-relaxed text-slate-500">Paste this inside your page's &lt;head&gt;. This doesn't touch your Google account or Search Console — it only prepares the tags; you (or your CMS) still publish them.</p>
          </div>
        </div>}
      </div>;
    }

    if (activeNav === 'Reports') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/60"><FileText className="h-4 w-4 text-slate-300" /></div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Reports</h3>
              <p className="text-[9px] text-slate-400">Your brand analysis history — filter, download and delete.</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-lg border border-slate-700 p-1 text-[9px] text-slate-400">
              {['7 days', '30 days', '90 days', 'All'].map((period) => (
                <button key={period} type="button" onClick={() => showNotice(`${period} selected`)} className={`rounded px-2.5 py-1.5 transition ${period === '30 days' ? 'bg-slate-700 text-slate-100' : 'hover:bg-slate-800 hover:text-slate-200'}`}>{period}</button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border border-slate-700 p-1 text-[9px] text-slate-400">
              <button type="button" className="rounded bg-slate-700 px-2.5 py-1.5 text-slate-100">↓ Highest score</button>
              <button type="button" className="rounded px-2.5 py-1.5 hover:bg-slate-800">↑ Lowest score</button>
            </div>
          </div>
          <div className="flex min-h-[250px] flex-col items-center justify-center rounded-xl border border-slate-700 bg-[#101725] px-4 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800/60"><FileText className="h-4 w-4 text-slate-400" /></div>
            <p className="text-[11px] font-semibold text-slate-100">No reports in this period</p>
            <p className="mt-1 text-[9px] text-slate-400">Run a brand analysis on the home page to see it here.</p>
            <button type="button" onClick={() => goTo('Brand Scan')} className="mt-4 rounded-lg bg-slate-200 px-4 py-2 text-[10px] font-medium text-slate-900 hover:bg-white">New analysis</button>
          </div>
          {selectedReport && <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-[9px] text-emerald-300">{selectedReport} report opened in demo mode.</div>}
        </div>
      );
    }

    if (activeNav === 'Action Plan') {
      const actionReports = [
        ['Hipets', '20 Aug 2026', '34'],
        ['Presora', '19 Aug 2026', '26'],
        ['Semcore', '17 Aug 2026', '41'],
        ['Pikseo', '17 Aug 2026', '32'],
        ['Greenparrot', '17 Aug 2026', '36'],
        ['Traffic Trends', '17 Aug 2026', '33'],
        ['Kotowskakama.pl', '17 Aug 2026', '27'],
        ['Tearsofojoy.pl', '17 Aug 2026', '33'],
        ['Kaman Marketing', '17 Aug 2026', '29'],
        ['One Day', '17 Aug 2026', '42'],
        ['Salestube', '16 Aug 2026', '39'],
      ];
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/60"><Bot className="h-4 w-4 text-slate-300" /></div>
            <div>
              <div className="flex items-center gap-2"><h3 className="text-base font-semibold text-slate-100">Action Plan</h3><span className="rounded border border-slate-600 px-1 py-0.5 text-[7px] text-slate-400">BETA</span></div>
              <p className="mt-1 max-w-2xl text-[9px] leading-relaxed text-slate-400">Every brand where AI models currently recommend your competitors instead of you — open a report to see its AI-generated remediation checklist.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {actionReports.map(([name, date, score]) => (
              <button key={name} type="button" onClick={() => { setSelectedReport(name); showNotice(`${name} action plan opened`); }} className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-[#101725] px-3 py-2.5 text-left transition hover:border-slate-500 hover:bg-slate-800/60">
                <span><span className="block text-[10px] font-semibold text-slate-200">{name}</span><span className="text-[8px] text-slate-400">{date}</span></span>
                <span className="flex items-center gap-2 text-[10px] font-semibold text-rose-400">{score}% <ChevronRight className="h-3 w-3 text-slate-400" /></span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (activeNav === 'Competitor Tracker') {
      return <div className="space-y-3"><div className="flex items-center justify-between rounded-lg border border-slate-700 bg-[#101725] p-3"><span className="text-[9px] text-slate-400">Compare against</span><select value={selectedCompetitor} onChange={(event) => setSelectedCompetitor(event.target.value)} className="rounded border border-slate-700 bg-[#0b101b] px-2 py-1 text-[9px] text-slate-200"><option>Semcore</option><option>Pikseo</option><option>Greenparrot</option></select></div><div className="grid gap-2 sm:grid-cols-3">{[['Hipets', '34'], [selectedCompetitor, selectedCompetitor === 'Semcore' ? '41' : '32'], ['Market avg.', '36']].map(([name, score]) => <div key={name} className="rounded-lg border border-slate-700 bg-[#151d2b] p-3"><p className="text-[9px] text-slate-400">{name}</p><p className="mt-2 text-2xl font-semibold text-slate-100">{score}</p><div className="mt-2 h-1 rounded bg-slate-700"><div className="h-full rounded bg-rose-400" style={{ width: `${Number(score) * 2}%` }} /></div></div>)}</div></div>;
    }

    if (activeNav === 'Client Branding') {
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/60"><Palette className="h-4 w-4 text-slate-300" /></div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Client branding</h3>
              <p className="mt-1 max-w-xl text-[9px] leading-relaxed text-slate-400">Put your own identity on client-ready audits. These details appear on every branded report.</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-[#101725] p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-20 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/60 text-[9px] font-semibold text-slate-300">YOUR LOGO</div>
              <div><p className="text-[10px] font-medium text-slate-200">{clientBranding.name || 'Your agency'}</p><p className="text-[8px] text-slate-500">Client-ready PDF identity</p></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['name', 'Agency name', clientBranding.name],
                ['email', 'Contact email', clientBranding.email],
                ['website', 'Website', clientBranding.website],
              ].map(([key, label, value]) => (
                <label key={key} className="text-[8px] font-medium text-slate-400">
                  {label}
                  <input
                    value={value}
                    onChange={(event) => setClientBranding((current) => ({ ...current, [key]: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0b101b] px-2.5 py-2 text-[10px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-slate-500"
                  />
                </label>
              ))}
            </div>
            <button type="button" onClick={() => showNotice('Branding saved in demo mode')} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-3 py-2 text-[9px] font-medium text-slate-900 hover:bg-white">Save branding</button>
          </div>
        </div>
      );
    }

    const sectionData: Record<string, { description: string; stats: [string, string, string][]; rows: [string, string, string][] }> = {
      Automations: { description: 'Keep your visibility monitoring running automatically.', stats: [['Active rules', '4', 'running'], ['Checks this week', '18', 'completed'], ['Alerts', '2', 'need review']], rows: [['Weekly brand scan', 'Next run tomorrow', 'Active'], ['Competitor alerts', 'When score changes', 'Active'], ['Report email', 'Every Monday', 'Paused']] },
      'Google Visibility': { description: 'Track how your brand appears in Google results.', stats: [['Visibility', '68%', 'of tracked queries'], ['Top 10', '42', 'keywords'], ['Trend', '+8%', 'this month']], rows: [['best ai audit tool', 'Position 3', '+2'], ['ai visibility audit', 'Position 7', '+4'], ['brand monitoring', 'Position 12', '-1']] },
      Reports: { description: 'Review detailed AI visibility reports and trends.', stats: [['Reports', '24', 'generated'], ['Avg. score', '36', 'out of 100'], ['Trend', '+6%', 'vs last month']], rows: [['Hipets', '34', 'Aug 20, 2026'], ['Presora', '26', 'Aug 19, 2026'], ['Semcore', '41', 'Aug 17, 2026']] },
      'Action Plan': { description: 'Turn visibility insights into practical next steps.', stats: [['Open actions', '12', 'to improve'], ['High priority', '4', 'this week'], ['Completed', '28', 'all time']], rows: [['Add product proof points', 'High priority', 'To do'], ['Refresh comparison page', 'Medium priority', 'To do'], ['Answer pricing prompts', 'Completed', 'Done']] },
      'Competitor Tracker': { description: 'Compare your brand visibility with competitors.', stats: [['Your score', '34', 'rank #3'], ['Top competitor', '52', 'rank #1'], ['Share of voice', '18%', 'tracked market']], rows: [['You — Hipets', '34', 'Current'], ['Semcore', '41', '+7'], ['Pikseo', '32', '-2']] },
      Subscription: { description: 'Manage your Presora plan and usage.', stats: [['Current plan', 'Agency', 'renews Sep 20'], ['Audits used', '18/50', 'this month'], ['Team seats', '4/5', 'assigned']], rows: [['Agency plan', '$149 / month', 'Active'], ['AI model access', 'All 6 models', 'Included'], ['Billing details', 'Visa ending 4242', 'Updated']] },
    };
    const section = sectionData[activeNav] ?? sectionData.Reports;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-[#101725] p-4">
          <div><p className="text-[8px] uppercase tracking-widest text-slate-500">Workspace overview</p><p className="mt-2 text-xs text-slate-300">{section.description}</p></div>
          <button onClick={() => showNotice(`${activeNav} demo action started`)} className="rounded bg-slate-200 px-3 py-1.5 text-[9px] font-medium text-slate-900">Try demo</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {section.stats.map(([label, value, detail]) => <div key={label} className="rounded-lg border border-slate-700 bg-[#151d2b] p-3"><p className="text-[8px] uppercase tracking-widest text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-slate-100">{value}</p><p className="mt-1 text-[8px] text-slate-500">{detail}</p></div>)}
        </div>
        <div className="rounded-lg border border-slate-700 bg-[#101725]">
          {section.rows.map(([name, detail, status]) => <button key={name} onClick={() => showNotice(`${name} selected`)} className="grid w-full grid-cols-[1fr_1fr_auto] items-center gap-2 border-b border-slate-800 px-3 py-3 text-left last:border-0 hover:bg-slate-800/50"><span className="text-[9px] font-medium text-slate-200">{name}</span><span className="text-[8px] text-slate-400">{detail}</span><span className="rounded bg-slate-700 px-1.5 py-0.5 text-[8px] text-slate-300">{status}</span></button>)}
        </div>
      </div>
    );
  };

  return (
  <section aria-label="Presora dashboard preview" className="mt-14 w-full px-0">
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7 }}
      className={`landing-product-mockup mx-auto max-w-6xl overflow-hidden rounded-xl border text-left shadow-2xl ${isDark ? 'landing-product-mockup-dark border-slate-700/80 bg-[#0b101b] shadow-black/30' : 'landing-product-mockup-light border-slate-200 bg-white shadow-slate-300/40'}`}
    >
      <div className={`flex h-8 items-center gap-1.5 border-b px-3 ${isDark ? 'border-slate-800 bg-[#101722]' : 'border-slate-200 bg-slate-100'}`}>
        <span className="h-2 w-2 rounded-full bg-rose-400" />
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <div className={`ml-3 h-4 flex-1 rounded ${isDark ? 'bg-white/[0.04]' : 'bg-slate-200'}`} />
      </div>

      <div className="grid h-[590px] grid-cols-[132px_1fr] sm:grid-cols-[176px_1fr]">
        <aside className={`border-r p-2.5 sm:p-3 ${isDark ? 'border-slate-800 bg-[#0c121e]' : 'border-slate-200 bg-slate-50'}`}>
          <div className={`mb-5 flex items-center gap-1.5 px-1 text-[10px] font-bold tracking-tight sm:text-xs ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            <img src="/presora-mark-new-dark.png" alt="" aria-hidden="true" className="h-5 w-5 object-contain" />
            PRESORA
          </div>
          <div className="mb-3 rounded-md border border-slate-700 bg-slate-800/70 px-2 py-1.5 text-[8px] text-slate-300 sm:text-[9px]">
            <span className="block text-[7px] text-slate-500">WORKSPACE</span> Presora <span className="float-right rounded bg-slate-600 px-1">Agency</span>
          </div>
          <div className="space-y-0.5 text-[9px] text-slate-400 sm:text-[10px]">
            <button onMouseDown={(event) => event.preventDefault()} onClick={() => goTo('Home')} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition ${activeNav === 'Home' ? 'bg-slate-700/70 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Home className="h-3 w-3" /> Home</button>
            <p className="px-2 pt-3 text-[7px] uppercase tracking-widest text-slate-600">Tools</p>
            {[
              ['Brand Scan', Search],
              ['Automations', Zap],
              ['Google Visibility', Gauge],
              ['Reports', FileText],
              ['Action Plan', Bot],
              ['Competitor Tracker', CircleHelp],
              ['Client Branding', Palette],
            ].map(([label, Icon]) => (
              <button key={label as string} onMouseDown={(event) => event.preventDefault()} onClick={() => goTo(label as string)} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition ${activeNav === label ? 'bg-slate-700/70 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Icon className="h-3 w-3" /> {label as string}</button>
            ))}
          </div>
          <div className="mt-10 space-y-2 border-t border-slate-800 pt-3 text-[9px] text-slate-500">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="flex w-full cursor-not-allowed items-center justify-center gap-1 rounded bg-slate-200 py-1 text-slate-900"
            >
              <LockKeyhole className="h-3 w-3" /> Subscription
            </button>
          </div>
        </aside>

        <main className={`min-w-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-4 sm:p-7 ${isDark ? 'bg-[#0b101b]' : 'bg-white'}`}>
          <div className="mx-auto min-h-full max-w-3xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-100 sm:text-xl">{activeNav}</h2>
                  <button onClick={() => showNotice('Demo scan started')} className="hidden items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[9px] text-slate-300 transition hover:border-slate-500 hover:text-white sm:flex"><RefreshCw className="h-3 w-3" /> Run new scan</button>
                </div>
                <p className="mt-1 text-[9px] text-slate-500 sm:text-[10px]">Your AI visibility, at a glance</p>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <Bell className="h-3 w-3" /><Menu className="h-3 w-3" />
              </div>
            </div>

            {renderSection()}
            {notice && <div role="status" className="mt-3 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[9px] text-emerald-300">{notice}</div>}
          </div>
        </main>
      </div>
    </motion.div>
  </section>
  );
};
