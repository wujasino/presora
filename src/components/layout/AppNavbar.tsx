import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { LogOut, Settings, User, Code2, CreditCard, MessageSquare, Send, X, Bot, PanelLeftClose, PanelLeftOpen, Menu, Megaphone, Sun, Moon } from 'lucide-react';
import { logoutAndClearSession } from '@/lib/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import AvatarNotifications from '@/components/ui/avatar-notifications';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { PLAN_LIMITS, PLAN_LABELS, usePlan, useAnalysesUsedThisMonth, useSessionUser, useAvatarUrl } from '@/hooks/useAccountInfo';

const DropdownLink = ({ to, icon: Icon, label, onClick, openInNewTab }: { to: string; icon: React.FC<{ className?: string }>; label: string; onClick?: () => void; openInNewTab?: boolean }) => (
  <Link
    to={to}
    onClick={onClick}
    {...(openInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent transition-colors"
  >
    <Icon className="w-4 h-4 text-muted-foreground" />
    {label}
  </Link>
);

const SECTION_TITLES: Record<string, string> = {
  '/dashboard':  '',            // Home already reads as sidebar item + page heading
  '/brand-visibility': 'Brand Scan',
  '/automations': 'Automations',
  '/reputation-guard': 'Reputation Guard',
  '/pricing':    'Pricing',
  '/reports':    'Reports',
  '/profile':    'Profile',
  '/settings':   'Settings',
  '/developers': 'Developers',
  '/changelog':  "What's new",
};

interface AppNavbarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  onMobileToggle?: () => void;
  chatOpen?: boolean;
  onChatToggle?: () => void;
}

export const AppNavbar = ({ collapsed = false, onToggle, onMobileToggle, chatOpen = false, onChatToggle }: AppNavbarProps) => {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const { pathname } = useLocation();
  const sectionTitle = SECTION_TITLES[pathname] ?? 'Presora';
  const [open, setOpen] = useState(false);
  const { data: sessionUser } = useSessionUser();
  const userEmail = sessionUser?.email ?? null;
  const userName = sessionUser?.name ?? null;
  const { data: userAvatar = null } = useAvatarUrl();
  const { data: plan = 'Free' } = usePlan();
  const { data: analysesUsed = 0 } = useAnalysesUsedThisMonth();

  const initials = userName
    ? userName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : userEmail ? userEmail[0].toUpperCase() : '?';

  const limit = PLAN_LIMITS[plan] ?? 3;
  // Agency/Enterprise store their "no real cap" as 999999 in PLAN_LIMITS —
  // real for the DB check constraint, but showing that raw number as
  // "999999 analyses" / "999999 remaining" reads as a bug, not a plan perk.
  const unlimited = limit >= 9999;
  const usedPct = unlimited ? 0 : Math.min(100, Math.round((analysesUsed / limit) * 100));
  const remaining = unlimited ? Infinity : Math.max(0, limit - analysesUsed);

  // Feedback state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const handleFeedbackSend = () => {
    if (!feedbackText.trim()) return;
    setFeedbackSent(true);
    setTimeout(() => { setFeedbackSent(false); setFeedbackText(''); setFeedbackOpen(false); }, 1500);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-1 sm:gap-2 border-b border-border bg-background/90 backdrop-blur-sm px-2 sm:px-6">
      {/* Mobile hamburger — opens sidebar drawer */}
      <button
        onClick={onMobileToggle}
        className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Collapse/expand toggle — desktop only */}
      <button
        onClick={onToggle}
        className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
      </button>
      <span className="text-sm font-semibold text-foreground truncate min-w-0">{sectionTitle}</span>

      <div className="flex-1" />

      {/* Feedback */}
      <Popover open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <PopoverTrigger asChild>
          <button
            className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
            aria-label="Feedback"
            title="Send feedback"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[calc(100vw-1.5rem)] max-w-72 p-4">
          <p className="text-sm font-semibold text-foreground mb-1">Send feedback</p>
          <p className="text-xs text-muted-foreground mb-3">Tell us what you think or report an issue.</p>
          {feedbackSent ? (
            <p className="text-sm text-primary font-medium text-center py-2">Thanks for your feedback!</p>
          ) : (
            <>
              <textarea
                className="w-full rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground p-2.5 resize-none focus:outline-hidden focus:ring-1 focus:ring-primary mb-2"
                rows={4}
                placeholder="Your feedback..."
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
              />
              <button
                onClick={handleFeedbackSend}
                disabled={!feedbackText.trim()}
                className="flex items-center gap-1.5 w-full justify-center py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>

      {/* What's new */}
      <Link
        to="/changelog"
        className="hidden sm:flex relative items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
        aria-label="What's new"
        title="What's new"
      >
        <Megaphone className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
      </Link>

      {/* AI Chat toggle */}
      <button
        onClick={onChatToggle}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-lg transition-colors shrink-0',
          chatOpen ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
        aria-label="AI Assistant — ask a question"
        title="AI Assistant"
      >
        <Bot className="w-4 h-4" />
      </button>

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
        aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="shrink-0">
        <AvatarNotifications />
      </div>

      {userEmail && (
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <Popover open={open} onOpenChange={setOpen}>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    className="flex items-center gap-2 pl-2 border-l border-border hover:opacity-80 transition-opacity"
                    aria-label="Account menu"
                    title="Account"
                  >
                    <Avatar className="h-7 w-7 cursor-pointer">
                      <AvatarImage src={userAvatar ?? undefined} />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-medium">{PLAN_LABELS[plan] ?? plan} — credits this month</p>
                <p className="text-muted-foreground">{unlimited ? `${analysesUsed} used · unlimited` : `${analysesUsed} / ${limit} used (${usedPct}%)`}</p>
              </TooltipContent>

          <PopoverContent align="end" className="w-[calc(100vw-1.5rem)] max-w-64 p-0 overflow-hidden">
            {/* Balance */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Credits</span>
                <Link
                  to="/pricing"
                  onClick={() => setOpen(false)}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Upgrade
                </Link>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Total</span>
                <span className="font-medium text-foreground">{unlimited ? '∞' : `${limit} analyses`}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>Remaining</span>
                <span className={cn('font-medium', !unlimited && remaining <= 2 ? 'text-destructive' : 'text-foreground')}>{unlimited ? '∞' : remaining}</span>
              </div>
              {/* No progress bar on an unlimited plan — a bar against infinity has nothing to fill. */}
              {!unlimited && (
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', usedPct >= 80 ? 'bg-destructive' : 'bg-primary')}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
              )}
            </div>

            {/* User info */}
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-foreground truncate">{userName || userEmail}</p>
              <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
              <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">{PLAN_LABELS[plan] ?? plan}</span>
            </div>

            {/* Nav links */}
            <div className="p-2 border-b border-border space-y-0.5">
              <DropdownLink to="/profile"    icon={User}       label="Profile"       onClick={() => setOpen(false)} />
              <DropdownLink to="/settings"   icon={Settings}   label="Settings"   onClick={() => setOpen(false)} />
              <DropdownLink to="/pricing"    icon={CreditCard} label="Subscription"  onClick={() => setOpen(false)} openInNewTab />
              <DropdownLink to="/developers" icon={Code2}      label="Developers"   onClick={() => setOpen(false)} />
            </div>

            {/* Sign out */}
            <div className="p-2">
              <button
                onClick={async () => {
                  setOpen(false);
                  // Order here no longer needs to win a timing race —
                  // ProtectedRoute itself now recognizes (and ignores) a
                  // stale re-render of the outgoing route once the browser
                  // has already moved on to a different URL, so it can't
                  // clobber this navigate() regardless of exactly when the
                  // session-user cache clears mid-signOut. See its comment
                  // for the actual mechanism.
                  await logoutAndClearSession();
                  navigate('/', { replace: true });
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </PopoverContent>
            </Popover>
          </Tooltip>
        </TooltipProvider>
      )}
    </header>
  );
};
