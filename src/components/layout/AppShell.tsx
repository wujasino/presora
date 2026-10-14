import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AppNavbar } from './AppNavbar';
import { AiChatSidebar } from './AiChatSidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { cn } from '@/lib/utils';

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div
        className={cn(
          'flex-1 flex flex-col overflow-hidden transition-all duration-200 min-w-0',
          collapsed ? 'md:ml-14' : 'md:ml-60',
          chatOpen && 'md:mr-80'
        )}
      >
        <AppNavbar
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
          onMobileToggle={() => setMobileOpen(o => !o)}
          chatOpen={chatOpen}
          onChatToggle={() => setChatOpen(o => !o)}
        />
        <main id="main-content" className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      <AiChatSidebar open={chatOpen} onClose={() => setChatOpen(false)} />
      <CommandPalette />
    </div>
  );
};
