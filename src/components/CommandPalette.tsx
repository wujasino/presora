import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { Search, Bot, FileText, CreditCard, Home, Megaphone, Code2, Settings, User, ShieldCheck } from 'lucide-react';

/** Global ⌘K / Ctrl-K command palette for fast navigation and actions. */
export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const go = (to: string) => { setOpen(false); navigate(to); };
  const iconCls = 'mr-2 h-4 w-4 text-muted-foreground';

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or jump to…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go('/brand-visibility')}>
            <Search className={iconCls} /> Run a brand scan
          </CommandItem>
          <CommandItem onSelect={() => go('/automations')}>
            <Bot className={iconCls} /> Set up monitoring
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => go('/dashboard')}><Home className={iconCls} /> Home</CommandItem>
          <CommandItem onSelect={() => go('/brand-visibility')}><Search className={iconCls} /> Brand Scan</CommandItem>
          <CommandItem onSelect={() => go('/automations')}><Bot className={iconCls} /> Automations</CommandItem>
          <CommandItem onSelect={() => go('/reputation-guard')}><ShieldCheck className={iconCls} /> Reputation Guard</CommandItem>
          <CommandItem onSelect={() => go('/reports')}><FileText className={iconCls} /> Reports</CommandItem>
          <CommandItem onSelect={() => go('/changelog')}><Megaphone className={iconCls} /> What's new</CommandItem>
          <CommandItem onSelect={() => go('/pricing')}><CreditCard className={iconCls} /> Subscription</CommandItem>
          <CommandItem onSelect={() => go('/profile')}><User className={iconCls} /> Profile</CommandItem>
          <CommandItem onSelect={() => go('/settings')}><Settings className={iconCls} /> Settings</CommandItem>
          <CommandItem onSelect={() => go('/developers')}><Code2 className={iconCls} /> Developers</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
