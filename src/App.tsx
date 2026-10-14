import { lazy, Suspense, useEffect } from 'react';
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from '@/lib/queryClient';
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OfflineBanner } from "@/components/ui/offline-banner";
import ProtectedRoute from "@/components/ProtectedRoute";
import { applySeo } from "@/hooks/useSeo";
import { useFaviconTheme } from "@/hooks/useFaviconTheme";

// AppShell (sidebar, app navbar, AI chat) is only used on authenticated app routes —
// code-split it so it stays out of the initial bundle served on landing/login/register.
const AppShell = lazy(() =>
  import("@/components/layout/AppShell").then(m => ({ default: m.AppShell }))
);

// Route-level code splitting — each page loads only when navigated to
const Landing        = lazy(() => import("./pages/Landing"));
const About          = lazy(() => import("./pages/About"));
const Contact        = lazy(() => import("./pages/Contact"));
const Agencies       = lazy(() => import("./pages/Agencies"));
const Features       = lazy(() => import("./pages/Features"));
const Status         = lazy(() => import("./pages/Status"));
const Dashboard      = lazy(() => import("./pages/Dashboard"));
const Automations    = lazy(() => import("./pages/Automations"));
const GoogleVisibility = lazy(() => import("./pages/GoogleVisibility"));
const Changelog      = lazy(() => import("./pages/Changelog"));
const Pricing        = lazy(() => import("./pages/Pricing"));
const Profile        = lazy(() => import("./pages/Profile"));
const Login          = lazy(() => import("./pages/Login"));
const Register       = lazy(() => import("./pages/Register"));
const Privacy        = lazy(() => import("./pages/Privacy"));
const Terms          = lazy(() => import("./pages/Terms"));
const NewsletterTerms = lazy(() => import("./pages/NewsletterTerms"));
const Settings       = lazy(() => import("./pages/Settings"));
const Reports        = lazy(() => import("./pages/Reports"));
const AuditBranding  = lazy(() => import("./pages/AuditBranding"));
const ActionPlanHub  = lazy(() => import("./pages/ActionPlanHub"));
const CompetitorTracker = lazy(() => import("./pages/CompetitorTracker"));
const ReputationGuard = lazy(() => import("./pages/ReputationGuard"));
const AdminAnnouncements = lazy(() => import("./pages/AdminAnnouncements"));
const AdminPricing   = lazy(() => import("./pages/AdminPricing"));
const AdminCreditCodes = lazy(() => import("./pages/AdminCreditCodes"));
const AdminSettings  = lazy(() => import("./pages/AdminSettings"));
const AuditReport    = lazy(() => import("./pages/AuditReport"));
const SharedReport   = lazy(() => import("./pages/SharedReport"));
const Developers     = lazy(() => import("./pages/Developers"));
const ApiDocs        = lazy(() => import("./pages/ApiDocs"));
const NotFound       = lazy(() => import("./pages/NotFound"));
const ResetPassword  = lazy(() => import("./pages/ResetPassword"));
const AuthConfirm    = lazy(() => import("./pages/AuthConfirm"));
const Onboarding     = lazy(() => import("./pages/Onboarding"));
const GoogleCallback = lazy(() => import("./pages/GoogleCallback"));

const PageTitle = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    applySeo(pathname);
  }, [pathname]);
  return null;
};

const FaviconTheme = () => {
  useFaviconTheme();
  return null;
};

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <OfflineBanner />
        <PageTitle />
        <FaviconTheme />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/status" element={<Status />} />
            <Route path="/agencies" element={<Agencies />} />
            <Route path="/features" element={<Features />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppShell><Dashboard /></AppShell>
                </ProtectedRoute>
              }
            />
            {/* /brand-visibility stays open to guests — it's where the free,
                no-login scan happens (guest limit enforced server-side in
                netlify/functions/analyze.js). */}
            <Route path="/brand-visibility" element={<AppShell><Dashboard /></AppShell>} />
            <Route
              path="/automations"
              element={
                <ProtectedRoute>
                  <AppShell><Automations /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/google-visibility"
              element={
                <ProtectedRoute>
                  <AppShell><GoogleVisibility /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/changelog"
              element={
                <ProtectedRoute>
                  <AppShell><Changelog /></AppShell>
                </ProtectedRoute>
              }
            />
            {/* Not wrapped in AppShell on purpose: opened from the app navbar's
                "Subscription" link in a new tab, it should read as a normal
                page you can navigate away from (its own Navbar/Footer), not
                a nested copy of the dashboard chrome. */}
            <Route path="/pricing" element={<Pricing />} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <AppShell><Profile /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/polityka-prywatnosci" element={<Privacy />} />
            <Route path="/regulamin" element={<Terms />} />
            <Route path="/regulamin-newslettera" element={<NewsletterTerms />} />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppShell><Settings /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <AppShell><Reports /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/action-plan"
              element={
                <ProtectedRoute>
                  <AppShell><ActionPlanHub /></AppShell>
                </ProtectedRoute>
              }
            />
            {/* Plan gate lives inside the page (an upsell, not a redirect) —
                same convention as /audit-branding. */}
            <Route
              path="/competitor-tracker"
              element={
                <ProtectedRoute>
                  <AppShell><CompetitorTracker /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reputation-guard"
              element={
                <ProtectedRoute>
                  <AppShell><ReputationGuard /></AppShell>
                </ProtectedRoute>
              }
            />
            {/* Plan gate lives inside the page (an upsell, not a redirect) —
                the sidebar link is hidden for non-agency plans anyway. */}
            <Route
              path="/audit-branding"
              element={
                <ProtectedRoute>
                  <AppShell><AuditBranding /></AppShell>
                </ProtectedRoute>
              }
            />
            {/* Further gated inside the page itself (useIsAdmin) — redirects
                non-admins to /dashboard rather than just hiding the nav link. */}
            <Route
              path="/admin/announcements"
              element={
                <ProtectedRoute>
                  <AppShell><AdminAnnouncements /></AppShell>
                </ProtectedRoute>
              }
            />
            {/* Also gated inside the page itself (useIsAdmin). */}
            <Route
              path="/admin/pricing"
              element={
                <ProtectedRoute>
                  <AppShell><AdminPricing /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/credit-codes"
              element={
                <ProtectedRoute>
                  <AppShell><AdminCreditCodes /></AppShell>
                </ProtectedRoute>
              }
            />
            {/* Also gated inside the page itself (useIsAdmin). */}
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute>
                  <AppShell><AdminSettings /></AppShell>
                </ProtectedRoute>
              }
            />
            {/* No AppShell — this is a standalone, print-optimized view meant
                to be exported as a PDF and handed to a client, not browsed
                inside the app chrome. */}
            <Route
              path="/audit/:id"
              element={
                <ProtectedRoute>
                  <AuditReport />
                </ProtectedRoute>
              }
            />
            <Route path="/shared-report/:token" element={<SharedReport />} />
            <Route
              path="/developers"
              element={
                <ProtectedRoute>
                  <AppShell><Developers /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route path="/docs/api" element={<ApiDocs />} />
            <Route path="/reset-password"        element={<ResetPassword />} />
            <Route path="/auth/confirm"          element={<AuthConfirm />} />
            <Route path="/auth/google/callback"  element={<GoogleCallback />} />
            <Route path="/onboarding"            element={<Onboarding />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
