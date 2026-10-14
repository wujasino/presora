import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { motion, useReducedMotion } from 'framer-motion';
import { LogOut, User, Settings, Code2, Sun, Moon, KeyRound, Mail, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Wordmark } from '@/components/Wordmark';
import { logoutAndClearSession } from '@/lib/auth';
import { useSessionUser, useAvatarUrl } from '@/hooks/useAccountInfo';

interface NavbarProps {
  /** Opt-in — only the landing page shows this; other pages using this navbar
      (Terms/Privacy/etc.) have dark-only content that isn't theme-aware. */
  showThemeToggle?: boolean;
  /** Opt-in — swaps the "Sign up" button copy for "Start free trial" on the
      landing page (Sign in stays the same either way). */
  landingCta?: boolean;
}

export const Navbar = ({ showThemeToggle = false, landingCta = false }: NavbarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const { resolvedTheme, setTheme } = useTheme();
  const { data: sessionUser, isLoading: authLoading } = useSessionUser();
  const userEmail = sessionUser?.email ?? null;
  const userName = sessionUser?.name ?? null;
  const { data: userAvatar = null } = useAvatarUrl();
  const isAuthed = !!userEmail;
  // Signed out here, but "Remember me" was checked on a previous visit
  // (see Login.tsx) — a returning user, not a fresh prospect.
  const isReturning = (() => {
    try { return localStorage.getItem('rememberMe') === 'true'; } catch { return false; }
  })();
  const handleLogout = () => {
    setAvatarOpen(false);
    // Navigate first, synchronously — see the comment on AppNavbar.tsx's
    // sign-out handler for why the order matters (avoids a race against
    // ProtectedRoute's own /login redirect on whatever app route this
    // fires from).
    navigate('/');
    logoutAndClearSession().catch(e => console.error('Logout failed', e));
  };

  // Initials: from display name if set, otherwise first letter of email
  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : userEmail ? userEmail[0].toUpperCase() : '?';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[hsl(var(--glass-border))] bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between gap-4">

          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-4">
            {/* Mobile hamburger */}
            <Popover open={mobileOpen} onOpenChange={setMobileOpen}>
              <PopoverTrigger asChild>
                <Button
                  className="group size-8 md:hidden"
                  variant="ghost"
                  size="icon"
                  aria-label="Toggle menu"
                >
                  <svg
                    className="pointer-events-none"
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path
                      d="M4 12L20 12"
                      className="origin-center -translate-y-[7px] transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-x-0 group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[315deg]"
                    />
                    <path
                      d="M4 12H20"
                      className="origin-center transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.8)] group-aria-expanded:rotate-45"
                    />
                    <path
                      d="M4 12H20"
                      className="origin-center translate-y-[7px] transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[135deg]"
                    />
                  </svg>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-2 md:hidden">
                <nav className="flex flex-col gap-1">
                  {/* Home with sub-links on mobile */}
                  <Link
                    to="/"
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-2 rounded-md text-sm transition-colors ${
                      location.pathname === '/'
                        ? 'text-primary bg-primary/10 font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    Home
                  </Link>
                  <a
                    href="/#faq"
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-2 pl-6 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    FAQ
                  </a>
                  <a
                    href="/contact"
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-2 pl-6 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    Contact
                  </a>
                  <Link
                    to="/about"
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-2 pl-6 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    About
                  </Link>
                  <Link
                    to="/agencies"
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-2 rounded-md text-sm transition-colors ${
                      location.pathname === '/agencies'
                        ? 'text-primary bg-primary/10 font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    Agencies
                  </Link>
                  <Link
                    to="/features"
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-2 rounded-md text-sm transition-colors ${
                      location.pathname === '/features'
                        ? 'text-primary bg-primary/10 font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    Features
                  </Link>
                  <Link
                    to="/pricing"
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-2 rounded-md text-sm transition-colors ${
                      location.pathname === '/pricing'
                        ? 'text-primary bg-primary/10 font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    Pricing
                  </Link>
                  <div className="my-1 h-px bg-border" />
                  {!authLoading && (
                    isAuthed ? (
                      <button
                        onClick={() => { setMobileOpen(false); handleLogout(); }}
                        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    ) : (
                      <>
                        {isReturning && (
                          <Link
                            to="/login?mode=forgot"
                            onClick={() => setMobileOpen(false)}
                            className="px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent underline-offset-2 hover:underline"
                          >
                            Forgot password?
                          </Link>
                        )}
                        <Link
                          to="/login"
                          onClick={() => setMobileOpen(false)}
                          className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent"
                        >
                          Log in
                        </Link>
                        <Link
                          to="/register"
                          onClick={() => setMobileOpen(false)}
                          className="px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 text-center"
                        >
                          {landingCta ? 'Start free trial' : 'Sign up'}
                        </Link>
                      </>
                    )
                  )}
                </nav>
              </PopoverContent>
            </Popover>

            {/* Wordmark */}
            <Link to="/" aria-label="Presora — AI brand visibility" className="flex items-center gap-2 shrink-0">
              <Wordmark className="text-2xl" />
            </Link>
          </div>

          {/* Center: desktop navigation */}
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2">
            <NavigationMenu>
              <NavigationMenuList>
                {/* Home with dropdown */}
                <NavigationMenuItem className="relative">
                  <NavigationMenuTrigger
                    onClick={() => navigate('/')}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      location.pathname === '/'
                        ? 'text-primary bg-primary/10 font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    Home
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="md:left-0 md:top-[calc(100%+0.5rem)]">
                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={reduceMotion ? { duration: 0 } : {
                        type: 'spring',
                        mass: 0.5,
                        damping: 11.5,
                        stiffness: 100,
                        restDelta: 0.001,
                        restSpeed: 0.001,
                      }}
                      className="origin-top rounded-2xl border border-[hsl(var(--glass-border))] bg-background/95 p-1 shadow-xl backdrop-blur-xl"
                    >
                      <ul className="w-44 p-2 space-y-1">
                        <li>
                          <a
                            href="/#faq"
                            className="block px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          >
                            FAQ
                          </a>
                        </li>
                        <li>
                          <a
                            href="/contact"
                            className="block px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          >
                            Contact
                          </a>
                        </li>
                        <li>
                          <Link
                            to="/about"
                            className="block px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          >
                            About
                          </Link>
                        </li>
                      </ul>
                    </motion.div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Agencies */}
                <NavigationMenuItem>
                  <Link
                    to="/agencies"
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      location.pathname === '/agencies'
                        ? 'text-primary bg-primary/10 font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    Agencies
                  </Link>
                </NavigationMenuItem>

                {/* Features — chat-based setup + comparison table, moved off
                    the landing page so the long-scroll story stays focused
                    on the core scan → score → fix loop. */}
                <NavigationMenuItem>
                  <Link
                    to="/features"
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      location.pathname === '/features'
                        ? 'text-primary bg-primary/10 font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    Features
                  </Link>
                </NavigationMenuItem>

                {/* Pricing */}
                <NavigationMenuItem>
                  <Link
                    to="/pricing"
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      location.pathname === '/pricing'
                        ? 'text-primary bg-primary/10 font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    Pricing
                  </Link>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Right: theme toggle + auth */}
          <div className="flex items-center gap-2">
            {showThemeToggle && (
              <button
                type="button"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
                aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
              >
                {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}
            {authLoading ? (
              <div className="hidden md:flex items-center gap-2">
                <div className="w-16 h-8 rounded-lg bg-muted animate-pulse" />
                <div className="w-20 h-8 rounded-lg bg-muted animate-pulse" />
              </div>
            ) : isAuthed ? (
                <Button size="sm" asChild>
                  <Link to="/dashboard">Go to Dashboard</Link>
                </Button>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  {isReturning && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                        >
                          Forgot password?
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-72 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-primary" />
                          <p className="text-sm font-medium text-foreground">Resetting your password</p>
                        </div>
                        <ol className="space-y-2 text-xs text-muted-foreground">
                          <li className="flex items-start gap-2">
                            <span className="shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center mt-0.5">1</span>
                            Enter your account email
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center mt-0.5">2</span>
                            We'll email you a 6-digit code — check your inbox (and spam folder)
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center mt-0.5">3</span>
                            Enter the code and choose a new password
                          </li>
                        </ol>
                        <Button size="sm" className="w-full gap-1.5" asChild>
                          <Link to="/login?mode=forgot">
                            <Mail className="w-3.5 h-3.5" /> Reset password <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                      </PopoverContent>
                    </Popover>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/login">Log in</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link to="/register">{landingCta ? 'Start free trial' : 'Sign up'}</Link>
                  </Button>
                </div>
              )}
          </div>

        </div>
      </div>
    </header>
  );
};
