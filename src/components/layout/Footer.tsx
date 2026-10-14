import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';

// lucide-react doesn't ship a TikTok glyph — hand-drawn to match the stroke
// weight/viewBox of the lucide icons it sits next to in the socials row.
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

// Same story — no lucide glyph for Discord either. Unlike the hand-drawn
// TikTok stroke icon, Discord's mark only reads as itself when filled
// (it's a solid mascot silhouette, not a line shape), so this one uses the
// brand's own official glyph path with fill="currentColor" instead of a
// stroke outline — same as most social-icon rows mixing line icons with a
// recognizable filled brand mark.
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.369a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.373-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.121.1.247.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.076.076 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.83 19.83 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.956 2.42-2.157 2.42zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.42-2.157 2.42z" />
  </svg>
);

const LINK_GROUPS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', to: '/features' },
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'For Agencies', to: '/agencies' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'API Docs', to: '/docs/api' },
      { label: 'System Status', to: '/status' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', to: '/polityka-prywatnosci' },
      { label: 'Terms of Service', to: '/regulamin' },
    ],
  },
];

// Only profiles that actually exist. The Twitter/LinkedIn/GitHub entries
// removed here pointed at placeholder handles that were never registered —
// a dead social icon in the footer reads as an abandoned product.
const SOCIALS = [
  { href: 'https://www.instagram.com/presora.app', Icon: Instagram, label: 'Instagram' },
  { href: 'https://www.tiktok.com/@presora.app', Icon: TikTokIcon, label: 'TikTok' },
  { href: 'https://discord.gg/HGyJfCVCGH', Icon: DiscordIcon, label: 'Discord' },
];

export const Footer = () => {
  return (
    <footer className="border-t border-[hsl(var(--glass-border))] bg-card/20 px-4 py-12">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_2fr] lg:gap-16">
        <div>
          <Link to="/" className="flex w-fit items-center gap-2.5">
            <Wordmark className="text-2xl" />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Monitor how leading AI models describe and recommend your brand.
          </p>
          <div className="mt-5 flex items-center gap-3">
            {SOCIALS.map(({ href, Icon, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[hsl(var(--glass-border))] bg-card/50 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-9 sm:grid-cols-4">
          {LINK_GROUPS.map((group) => (
            <nav key={group.title} aria-label={`${group.title} links`}>
              <h2 className="font-data text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground">
                {group.title}
              </h2>
              <ul className="mt-4 space-y-3">
                {group.links.map(({ label, to }) => (
                  <li key={label}>
                    <Link to={to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-2 border-t border-[hsl(var(--glass-border))] pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Presora. All rights reserved.</p>
        <p>AI visibility and reputation management.</p>
      </div>
    </footer>
  );
};

export default Footer;
