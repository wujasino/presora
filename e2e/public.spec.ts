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
    await expect(page.getByText('AI competitive intelligence for agencies')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Find out why competitors get recommended by AI — and what to do to outrank them.',
    );
    await expect(
      page.getByText('Give clients a reason to keep improving, not a dashboard they check once.', { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'A repeatable path from gap to growth' })).toBeVisible();
    for (const step of ['Measure', 'Explain', 'Act', 'Measure again']) {
      await expect(page.getByText(step, { exact: true })).toBeVisible();
    }
    expect(consoleIssues, JSON.stringify(consoleIssues)).toEqual([]);
  });

  test('pricing page lists plans', async ({ page, consoleIssues }) => {
    await page.goto('/pricing');
    await expect(page.getByText(/free/i).first()).toBeVisible();
    expect(consoleIssues, JSON.stringify(consoleIssues)).toEqual([]);
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
