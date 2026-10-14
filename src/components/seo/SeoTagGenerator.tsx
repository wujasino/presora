import { useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormState {
  brandName: string;
  pageTitle: string;
  description: string;
  pageUrl: string;
  imageUrl: string;
  logoUrl: string;
  sameAs: string;
}

const EMPTY: FormState = {
  brandName: '', pageTitle: '', description: '', pageUrl: '', imageUrl: '', logoUrl: '', sameAs: '',
};

const CounterLabel = ({ label, value, recommended }: { label: string; value: string; recommended: [number, number] }) => {
  const len = value.length;
  const inRange = len > 0 && len >= recommended[0] && len <= recommended[1];
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <span className={cn('text-[10px] font-data', len === 0 ? 'text-muted-foreground' : inRange ? 'text-emerald-500' : 'text-amber-500')}>
        {len} chars {len > 0 && !inRange ? `(aim ${recommended[0]}–${recommended[1]})` : ''}
      </span>
    </div>
  );
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Pure client-side generator — no Google account, no API call. Produces
 * ready-to-paste <head> tags (title/description/canonical/OG/Twitter) plus
 * a JSON-LD Organization block, since structured data is what actually
 * makes Google eligible to show rich results, not just the meta tags.
 */
export const SeoTagGenerator = ({
  compact = false,
  initialValues,
}: {
  compact?: boolean;
  initialValues?: Partial<FormState>;
}) => {
  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY, ...initialValues }));
  const [copied, setCopied] = useState(false);
  const [compactView, setCompactView] = useState<'fields' | 'preview'>('fields');
  const set = (patch: Partial<FormState>) => { setForm(prev => ({ ...prev, ...patch })); setCopied(false); };

  const sameAsList = useMemo(
    () => form.sameAs.split('\n').map(s => s.trim()).filter(Boolean),
    [form.sameAs]
  );

  const snippet = useMemo(() => {
    const title = form.pageTitle.trim() || form.brandName.trim();
    const desc = form.description.trim();
    const url = form.pageUrl.trim();
    const image = form.imageUrl.trim();
    const lines: string[] = [];
    if (title) lines.push(`<title>${escapeHtml(title)}</title>`);
    if (desc) lines.push(`<meta name="description" content="${escapeHtml(desc)}">`);
    if (url) lines.push(`<link rel="canonical" href="${escapeHtml(url)}">`);
    if (title || desc || url || image) {
      lines.push('<meta property="og:type" content="website">');
      if (title) lines.push(`<meta property="og:title" content="${escapeHtml(title)}">`);
      if (desc) lines.push(`<meta property="og:description" content="${escapeHtml(desc)}">`);
      if (url) lines.push(`<meta property="og:url" content="${escapeHtml(url)}">`);
      if (image) lines.push(`<meta property="og:image" content="${escapeHtml(image)}">`);
      lines.push('<meta name="twitter:card" content="summary_large_image">');
      if (title) lines.push(`<meta name="twitter:title" content="${escapeHtml(title)}">`);
      if (desc) lines.push(`<meta name="twitter:description" content="${escapeHtml(desc)}">`);
      if (image) lines.push(`<meta name="twitter:image" content="${escapeHtml(image)}">`);
    }

    if (form.brandName.trim() || url || form.logoUrl.trim() || sameAsList.length > 0) {
      const jsonLd: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
      };
      if (form.brandName.trim()) jsonLd.name = form.brandName.trim();
      if (url) jsonLd.url = url;
      if (form.logoUrl.trim()) jsonLd.logo = form.logoUrl.trim();
      if (sameAsList.length > 0) jsonLd.sameAs = sameAsList;
      lines.push('<script type="application/ld+json">');
      lines.push(JSON.stringify(jsonLd, null, 2));
      lines.push('</script>');
    }

    return lines.join('\n');
  }, [form, sameAsList]);

  const hasAnything = snippet.length > 0;

  const handleCopy = async () => {
    if (!hasAnything) return;
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('grid grid-cols-1', compact ? 'min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1.05fr_0.95fr]' : 'lg:grid-cols-2 gap-5')}>
      {compact && (
        <div className="col-span-full flex gap-1 sm:hidden" role="tablist" aria-label="Tag generator view">
          {(['fields', 'preview'] as const).map(view => (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={compactView === view}
              onClick={() => setCompactView(view)}
              className={cn(
                'flex-1 rounded-md border px-2 py-1.5 text-[10px] capitalize',
                compactView === view
                  ? 'border-slate-600 bg-slate-700 text-white'
                  : 'border-slate-800 text-slate-400',
              )}
            >
              {view === 'fields' ? 'Edit fields' : 'Preview tags'}
            </button>
          ))}
        </div>
      )}
      <div className={cn(
        'glass-card',
        compact
          ? cn('grid min-h-0 grid-cols-2 content-start gap-x-2 gap-y-1.5 overflow-hidden p-2.5', compactView === 'preview' && 'hidden sm:grid')
          : 'space-y-4 p-5',
      )}>
        <div>
          <Label htmlFor={compact ? 'mockup-seo-brand' : 'seo-brand'} className={compact ? 'text-[10px] leading-tight text-muted-foreground' : 'text-xs text-muted-foreground'}>Brand / organisation name</Label>
          <Input id={compact ? 'mockup-seo-brand' : 'seo-brand'} value={form.brandName} onChange={(e) => set({ brandName: e.target.value })} placeholder="Acme Inc." className={cn('mt-1', compact && 'h-7 rounded-md px-2 text-[10px]')} />
        </div>
        <div>
          {compact
            ? <div className="flex items-center justify-between gap-1"><Label htmlFor="mockup-seo-title" className="text-[10px] leading-tight text-muted-foreground">Page title</Label><span className="text-[9px] text-muted-foreground">{form.pageTitle.length}/60</span></div>
            : <CounterLabel label="Page title" value={form.pageTitle} recommended={[15, 60]} />}
          <Input id={compact ? 'mockup-seo-title' : undefined} value={form.pageTitle} onChange={(e) => set({ pageTitle: e.target.value })} placeholder="Acme Inc. — Cloud accounting for small teams" className={cn('mt-1', compact && 'h-7 rounded-md px-2 text-[10px]')} />
        </div>
        <div>
          {compact
            ? <div className="flex items-center justify-between gap-1"><Label htmlFor="mockup-seo-description" className="text-[10px] leading-tight text-muted-foreground">Meta description</Label><span className="text-[9px] text-muted-foreground">{form.description.length}/160</span></div>
            : <CounterLabel label="Meta description" value={form.description} recommended={[50, 160]} />}
          <textarea
            id={compact ? 'mockup-seo-description' : undefined}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={compact ? 3 : 3}
            placeholder="A one-sentence summary of the page, written for someone who has never heard of you."
            className={cn('mt-1 w-full bg-background/60 border border-[hsl(var(--glass-border))] text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-primary/40 transition-colors', compact ? 'h-12 rounded-md px-2 py-1 text-[10px]' : 'rounded-xl text-sm px-3 py-2')}
          />
        </div>
        <div>
          <Label htmlFor={compact ? 'mockup-seo-url' : 'seo-url'} className={compact ? 'text-[10px] leading-tight text-muted-foreground' : 'text-xs text-muted-foreground'}>Page URL (canonical)</Label>
          <Input id={compact ? 'mockup-seo-url' : 'seo-url'} value={form.pageUrl} onChange={(e) => set({ pageUrl: e.target.value })} placeholder="https://acme.com/" className={cn('mt-1', compact && 'h-7 rounded-md px-2 text-[10px]')} />
        </div>
        <div>
          <Label htmlFor={compact ? 'mockup-seo-image' : 'seo-image'} className={compact ? 'text-[10px] leading-tight text-muted-foreground' : 'text-xs text-muted-foreground'}>Social preview image URL</Label>
          <Input id={compact ? 'mockup-seo-image' : 'seo-image'} value={form.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://acme.com/og-image.png" className={cn('mt-1', compact && 'h-7 rounded-md px-2 text-[10px]')} />
        </div>
        <div>
          <Label htmlFor={compact ? 'mockup-seo-logo' : 'seo-logo'} className={compact ? 'text-[10px] leading-tight text-muted-foreground' : 'text-xs text-muted-foreground'}>Logo URL (for structured data)</Label>
          <Input id={compact ? 'mockup-seo-logo' : 'seo-logo'} value={form.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} placeholder="https://acme.com/logo.png" className={cn('mt-1', compact && 'h-7 rounded-md px-2 text-[10px]')} />
        </div>
        <div>
          <Label htmlFor={compact ? 'mockup-seo-sameas' : 'seo-sameas'} className={compact ? 'text-[10px] leading-tight text-muted-foreground' : 'text-xs text-muted-foreground'}>Social profile URLs (one per line, optional)</Label>
          <textarea
            id={compact ? 'mockup-seo-sameas' : 'seo-sameas'}
            value={form.sameAs}
            onChange={(e) => set({ sameAs: e.target.value })}
            rows={compact ? 3 : 3}
            placeholder={'https://x.com/acme\nhttps://linkedin.com/company/acme'}
            className={cn('mt-1 w-full bg-background/60 border border-[hsl(var(--glass-border))] text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-primary/40 transition-colors font-data', compact ? 'h-12 rounded-md px-2 py-1 text-[10px]' : 'rounded-xl text-sm px-3 py-2')}
          />
        </div>
      </div>

      <div className={cn(
        'glass-card flex flex-col',
        compact
          ? cn('min-h-0 min-w-0 overflow-hidden p-3', compactView === 'fields' && 'hidden sm:flex')
          : 'p-5',
      )}>
        <div className={cn('flex items-center justify-between', compact ? 'mb-1.5 gap-1' : 'mb-3')}>
          <p className={compact ? 'text-[12px] font-semibold text-foreground' : 'text-sm font-semibold text-foreground'}>Generated tags</p>
          <Button size="sm" variant="outline" onClick={handleCopy} disabled={!hasAnything} className={cn('gap-1.5', compact && 'h-7 px-2 text-[9px]')}>
            {copied ? <Check className={compact ? 'h-3 w-3' : 'w-3.5 h-3.5'} /> : <Copy className={compact ? 'h-3 w-3' : 'w-3.5 h-3.5'} />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <pre className={cn('flex-1 overflow-auto font-data bg-background/60 border border-[hsl(var(--glass-border))] whitespace-pre-wrap break-words text-foreground/80', compact ? 'h-[180px] min-h-0 flex-none rounded-lg p-2.5 text-[9px] leading-relaxed' : 'text-xs rounded-xl p-4 min-h-[280px]')}>
          {hasAnything ? snippet : 'Fill in the fields on the left — the tags to paste into your page\'s <head> will show up here.'}
        </pre>
        <p className={cn('text-muted-foreground leading-relaxed', compact ? 'mt-2 text-[9px]' : 'text-[11px] mt-3')}>
          Paste this inside your page's <code className="font-data">&lt;head&gt;</code>{compact ? '.' : '. This doesn\'t touch your Google account or Search Console — it only prepares the tags; you (or your CMS) still publish them.'}
        </p>
      </div>
    </div>
  );
};
