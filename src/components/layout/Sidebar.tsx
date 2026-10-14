import { Link, useLocation } from 'react-router-dom';
import { Home, Code2, Zap, FileText, Bot, Search, Megaphone, Palette, SlidersHorizontal, Tag, Globe2, ClipboardList, Trophy, Ticket, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePlan, PLAN_LABELS, useIsAdmin, isAgencyPlan } from '@/hooks/useAccountInfo';
import { Wordmark } from '@/components/Wordmark';

interface NavItemProps {
  to: string;
  icon: React.FC<{ className?: string }>;
  label: string;
  badge?: string;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  /** Admin-only destination — rendered in amber so it never reads as product nav. */
  adminStyle?: boolean;
}

const NavItem = ({ to, icon: Icon, label, badge, active, collapsed, onNavigate, adminStyle }: NavItemProps) => (
  <Link
    to={to}
    onClick={onNavigate}
    title={collapsed ? label : undefined}
    className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
      collapsed ? 'justify-center px-2' : '',
      adminStyle
        ? active
          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium'
          : 'text-amber-600/70 dark:text-amber-400/70 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400'
        : active
          ? 'bg-accent text-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
    )}
  >
    <Icon className="w-4 h-4 shrink-0" />
    {!collapsed && <span className="flex-1">{label}</span>}
    {!collapsed && badge && (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary text-primary-foreground">
        {badge}
      </span>
    )}
  </Link>
);

const SectionLabel = ({ label, collapsed }: { label: string; collapsed: boolean }) =>
  collapsed ? <div className="h-px bg-border mx-2 my-1" /> : (
    <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">{label}</p>
  );

interface SidebarProps {
  collapsed?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar = ({ collapsed = false, mobileOpen = false, onMobileClose }: SidebarProps) => {
  const { pathname } = useLocation();
  const isMobile = useIsMobile();

  // Cached by react-query so the badge doesn't flash back to the 'Free'
  // default every time the sidebar remounts (each protected route wraps
  // its own AppShell/Sidebar instance instead of sharing one via <Outlet>).
  const { data: plan = 'Free' } = usePlan();
  const { data: isAdmin = false } = useIsAdmin();
  // Hidden rather than shown-and-gated: a non-agency user has nothing to
  // configure here, and /audit-branding renders its own upsell if reached
  // by direct link.
  const canBrandAudits = isAgencyPlan(plan);

  // On mobile the sidebar is a full drawer — never render icon-only mode
  const effectiveCollapsed = isMobile ? false : collapsed;
  const handleNavigate = isMobile ? onMobileClose : undefined;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside className={cn(
        'fixed left-0 top-0 bottom-0 flex flex-col bg-background border-r border-border z-50 transition-all duration-200',
        'w-64',
        collapsed ? 'md:w-14' : 'md:w-60',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'md:translate-x-0'
      )}>
        {/* Logo */}
        <div className={cn('flex items-center pb-4', effectiveCollapsed ? 'justify-center px-2 pt-4' : 'justify-start p-4')}>
          {!effectiveCollapsed ? (
            <Link to="/dashboard" onClick={handleNavigate} className="flex items-center">
              <Wordmark className="text-lg" />
            </Link>
          ) : (
            <Link to="/dashboard" onClick={handleNavigate} aria-label="Presora">
              <Wordmark iconOnly className="h-8 w-8" />
            </Link>
          )}
        </div>

        <div className="h-px bg-border mx-3" />

        {/* Plan badge */}
        {!effectiveCollapsed && (
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border">
              <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <span className="text-xs font-medium text-foreground flex-1">Presora</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground font-bold">{PLAN_LABELS[plan] ?? plan}</span>
            </div>
          </div>
        )}

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto px-2 pt-2 space-y-0.5">
          <NavItem to="/dashboard" icon={Home} label="Home" active={pathname === '/dashboard'} collapsed={effectiveCollapsed} onNavigate={handleNavigate} />

          <SectionLabel label="Tools" collapsed={effectiveCollapsed} />

          <NavItem to="/brand-visibility" icon={Search} label="Brand Scan" active={pathname === '/brand-visibility'} collapsed={effectiveCollapsed} onNavigate={handleNavigate} />
          <NavItem to="/automations" icon={Bot} label="Automations" active={pathname === '/automations'} collapsed={effectiveCollapsed} onNavigate={handleNavigate} />
          <NavItem to="/reputation-guard" icon={ShieldCheck} label="Reputation Guard" badge="Beta" active={pathname === '/reputation-guard'} collapsed={effectiveCollapsed} onNavigate={handleNavigate} />
          <NavItem to="/google-visibility" icon={Globe2} label="Google Visibility" active={pathname === '/google-visibility'} collapsed={effectiveCollapsed} onNavigate={handleNavigate} />
          <NavItem to="/reports" icon={FileText} label="Reports" active={pathname === '/reports'} collapsed={effectiveCollapsed} onNavigate={handleNavigate} />
          <NavItem to="/action-plan" icon={ClipboardList} label="Action Plan" active={pathname === '/action-plan'} collapsed={effectiveCollapsed} onNavigate={handleNavigate} />
          <NavItem to="/competitor-tracker" icon={Trophy} label="Competitor Tracker" active={pathname === '/competitor-tracker'} collapsed={effectiveCollapsed} onNavigate={handleNavigate} />
          {canBrandAudits && (
            <NavItem to="/audit-branding" icon={Palette} label="Client Branding" active={pathname === '/audit-branding'} collapsed={effectiveCollapsed} onNavigate={handleNavigate} />
          )}

          {isAdmin && (
            <>
              {/* Visually fenced off from the product nav. These three write
                  to other people's accounts and to a global scanning switch;
                  sitting flush against Reports invites a mis-click in
                  production. */}
              {!effectiveCollapsed && (
                <div className="flex items-center gap-2 px-3 pt-4 pb-1">
                  <p className="text-[10px] uppercase tracking-widest text-amber-500/80 font-semibold">Admin mode</p>
                  <div className="flex-1 h-px bg-amber-500/20" />
                </div>
              )}
              {effectiveCollapsed && <div className="h-px bg-amber-500/30 mx-2 my-1" />}
              <NavItem adminStyle to="/admin/announcements" icon={Megaphone} label="Announcements" active={pathname === '/admin/announcements'} collapsed={effectiveCollapsed} onNavigate={handleNavigate} />
              <NavItem adminStyle to="/admin/settings" icon={SlidersHorizontal} label="Users & Scanning" active={pathname === '/admin/settings'} collapsed={effectiveCollapsed} onNavigate={handleNavigate} />
              <NavItem adminStyle to="/admin/pricing" icon={Tag} label="Custom Pricing" active={pathname === '/admin/pricing'} collapsed={effectiveCollapsed} onNavigate={handleNavigate} />
              <NavItem adminStyle to="/admin/credit-codes" icon={Ticket} label="Credit Codes" active={pathname === '/admin/credit-codes'} collapsed={effectiveCollapsed} onNavigate={handleNavigate} />
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className={cn('p-3 border-t border-border space-y-1', effectiveCollapsed && 'flex flex-col items-center')}>
          {/* Developers link */}
          <NavItem to="/developers" icon={Code2} label="Developers" badge="Dev" active={pathname === '/developers'} collapsed={effectiveCollapsed} onNavigate={handleNavigate} />

          {/* Subscription / Upgrade CTA — the single entry point to plans */}
          <Link
            to="/pricing"
            onClick={handleNavigate}
            title={effectiveCollapsed ? 'Subscription' : undefined}
            className={cn(
              'flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors',
              effectiveCollapsed && 'w-8 h-8 p-0 rounded-lg'
            )}
          >
            <Zap className="w-4 h-4 shrink-0" />
            {!effectiveCollapsed && (plan === 'Free' ? 'Upgrade — Subscription' : 'Subscription')}
          </Link>
        </div>
      </aside>
    </>
  );
};
