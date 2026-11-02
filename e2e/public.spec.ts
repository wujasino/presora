import { test, expect } from './fixtures';

// Public marketing pages need no auth and no mocked backend — sanity-check
// that they render and stay free of console errors across the render.
test.describe('Public pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('landing page renders the hero and navbar', async ({ page, consoleIssues }) => {
    await page.goto('/');
    // On mobile the navbar collapses "Sign in" behind a hamburger menu, so
    // check for the wordmark instead — present in both layouts.
    await expect(page.getByRole('link', { name: 'Presora — AI brand visibility' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Are ChatGPT and Claude hiding your company from customers?',
    );
    await expect(page.getByText('Illustrative AI visibility example')).toBeVisible();
    await expect(page.getByText('AI recommendation share')).toBeVisible();
    await expect(page.getByText('60-point visibility gap')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Check your score free in 30 seconds' })).toHaveAttribute('href', '/register');
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      const mainNavigation = page.getByLabel('Main');
      await mainNavigation.getByRole('button', { name: 'Home' }).hover();
      await expect(mainNavigation.getByRole('link', { name: 'FAQ' })).toBeVisible();
      await expect(mainNavigation.getByRole('link', { name: 'Contact' })).toBeVisible();
      await expect(mainNavigation.getByRole('link', { name: 'About' })).toBeVisible();
    }
    expect(consoleIssues, JSON.stringify(consoleIssues)).toEqual([]);
  });

  test('pricing page lists plans', async ({ page, consoleIssues }) => {
    await page.goto('/pricing');
    await expect(page.getByText(/free/i).first()).toBeVisible();
    expect(consoleIssues, JSON.stringify(consoleIssues)).toEqual([]);
  });

  test('landing hero labels its sample scores as illustrative', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Illustrative AI visibility example')).toBeVisible();
    await expect(page.getByText('Your brand', { exact: true })).toBeVisible();
    await expect(page.getByText('Top competitor', { exact: true })).toBeVisible();
    await expect(page.getByText('15%', { exact: true })).toBeVisible();
    await expect(page.getByText('75%', { exact: true })).toBeVisible();
  });

  test('about page renders', async ({ page, consoleIssues }) => {
    await page.goto('/about');
    await expect(page.locator('body')).toBeVisible();
    expect(consoleIssues, JSON.stringify(consoleIssues)).toEqual([]);
  });

  test('contact page renders a working form', async ({ page, consoleIssues }) => {
    await page.goto('/contact');
    await expect(page.getByLabel('Full name *')).toBeVisible();
    await expect(page.getByLabel('Work email *')).toBeVisible();
    await expect(page.getByLabel('Company / Agency name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
    expect(consoleIssues, JSON.stringify(consoleIssues)).toEqual([]);
  });

  test('contact form blocks submission until the consent checkbox is checked', async ({ page, consoleIssues }) => {
    await page.goto('/contact');
    const submit = page.getByRole('button', { name: 'Send message' });
    const consent = page.locator('#contact-consent');

    await expect(submit).toBeDisabled();
    await consent.click();
    await expect(submit).toBeEnabled();
    await consent.click();
    await expect(submit).toBeDisabled();
    expect(consoleIssues, JSON.stringify(consoleIssues)).toEqual([]);
  });

  test('status page reports live health check results', async ({ page, consoleIssues }) => {
    await page.route('**/.netlify/functions/health*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'operational',
        timestamp: new Date().toISOString(),
        checks: { app: { status: 'operational' }, database: { status: 'operational', latencyMs: 42 } },
      }),
    }));

    await page.goto('/status');
    await expect(page.getByText('Operational').first()).toBeVisible();
    await expect(page.getByText('42ms')).toBeVisible();
    expect(consoleIssues, JSON.stringify(consoleIssues)).toEqual([]);
  });

  test('unauthenticated visitor is redirected away from a protected route', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
