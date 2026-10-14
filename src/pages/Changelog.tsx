import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Megaphone, ArrowRight } from 'lucide-react';

type Tag = 'New' | 'Improved' | 'Soon';
const TAG_STYLES: Record<Tag, string> = {
  New:      'bg-primary/15 text-primary border-primary/20',
  Improved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  Soon:     'bg-muted text-muted-foreground border-border',
};

const NEWS: { tag: Tag; date: string; title: string; desc: string; to?: string }[] = [
  {
    tag: 'New', date: 'Jul 2026',
    title: 'A real home dashboard',
    desc: 'Home now leads with your latest visibility score, the delta since your last scan, a per-model breakdown and your recent reports — not just links.',
    to: '/dashboard',
  },
  {
    tag: 'New', date: 'Jul 2026',
    title: 'Set up monitoring by chat',
    desc: 'The Automations tool configures brands, competitors, schedules and alerts from a conversation — you review and confirm before anything saves.',
    to: '/automations',
  },
  {
    tag: 'Improved', date: 'Jul 2026',
    title: 'Brand Scan is now its own workspace',
    desc: 'Scanning moved into a dedicated Tools section, so home stays focused on your results.',
    to: '/brand-visibility',
  },
  {
    tag: 'New', date: 'Jun 2026',
    title: 'Action plan on every scan',
    desc: 'Each report now ends with a prioritized, plain-English list of what to publish and optimize to get recommended.',
  },
  {
    tag: 'Soon', date: 'Coming soon',
    title: 'Weekly digest emails',
    desc: 'A short recap of how your AI visibility moved, delivered to your inbox every Monday.',
  },
];

const Changelog = () => (
  <div className="min-h-screen bg-background">
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-2 mb-8">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
          <Megaphone className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-display text-foreground leading-tight">What's new</h1>
          <p className="text-xs text-muted-foreground">Product updates and what's coming next</p>
        </div>
      </div>

      <div className="relative pl-5 space-y-5 before:absolute before:left-[7px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-border">
        {NEWS.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            className="relative"
          >
            <span className="absolute left-[-18px] top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-background" />
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${TAG_STYLES[item.tag]}`}>
                  {item.tag}
                </span>
                <span className="text-[11px] text-muted-foreground">{item.date}</span>
              </div>
              <h2 className="text-sm font-semibold text-foreground mb-1">{item.title}</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              {item.to && (
                <Link to={item.to} className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                  Open <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

export default Changelog;
