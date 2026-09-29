import { test as base, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';

type ConsoleIssue = { type: 'pageerror' | 'console-error'; text: string };

// Noise that's expected in this sandboxed/mocked environment and isn't a
// real regression — keep this list short and specific, never a blanket filter.
const IGNORED_PATTERNS = [
  /favicon/i,
  /ERR_CONNECTION_RESET/,
  /ERR_TUNNEL_CONNECTION_FAILED/,
  // External assets such as Google Fonts are blocked in restricted E2E
  // environments; Chromium reports those expected network denials as errors.
  /Failed to load resource: net::ERR_NETWORK_ACCESS_DENIED/,
];

type Fixtures = {
  loginPage: LoginPage;
  registerPage: RegisterPage;
  dashboardPage: DashboardPage;
  settingsPage: SettingsPage;
  /** Collects uncaught page errors and console.error() calls for the current test. */
  consoleIssues: ConsoleIssue[];
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },

  consoleIssues: async ({ page }, use) => {
    const issues: ConsoleIssue[] = [];
    page.on('pageerror', e => issues.push({ type: 'pageerror', text: e.message }));
    page.on('console', msg => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (IGNORED_PATTERNS.some(p => p.test(text))) return;
      issues.push({ type: 'console-error', text });
    });
    await use(issues);
  },
});

export { expect };
