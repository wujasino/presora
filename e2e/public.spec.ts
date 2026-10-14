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

  test('mockup automations stay inside the preview and do not scroll their screen', async ({ page }) => {
    await page.goto('/');
    const mockup = page.getByRole('region', { name: 'Presora dashboard preview' });
    const automationsButton = mockup.getByRole('button', { name: 'Automations' });

    await automationsButton.click();
    const pageScrollY = await page.evaluate(() => window.scrollY);
    await expect(mockup.getByText('Set up monitoring by chat — no forms')).toBeVisible();
    await expect(mockup.getByRole('textbox', { name: 'Automation prompt' })).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollY);

    const screen = mockup.locator('main');
    await expect(screen).toHaveCSS('overflow-y', 'hidden');
    const screenBox = await screen.boundingBox();
    if (!screenBox) throw new Error('Mockup screen is not visible');
    await page.mouse.move(screenBox.x + screenBox.width / 2, screenBox.y + screenBox.height / 2);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(150);
    expect(await screen.evaluate(element => element.scrollTop)).toBe(0);
    expect(await screen.evaluate(element => element.scrollTop)).toBe(0);
    await expect(mockup).toBeVisible();
  });

  test('Google Visibility generate-tags view fits inside the mockup screen', async ({ page }) => {
    await page.goto('/');
    const cookieDialog = page.getByRole('dialog', { name: 'Cookie consent' });
    if (await cookieDialog.isVisible()) {
      await cookieDialog.getByRole('button', { name: 'Accept all' }).click();
    }
    const mockup = page.getByRole('region', { name: 'Presora dashboard preview' });
    await mockup.getByRole('button', { name: 'Google Visibility' }).click();
    await expect(mockup.getByText('What the audit checks')).toBeVisible();
    await expect(mockup.getByRole('textbox', { name: 'Page URL' })).toHaveValue('https://acme.com/');
    await mockup.getByRole('button', { name: 'Generate tags' }).click();

    const screen = mockup.locator('main');
    const screenBox = await screen.boundingBox();
    if (!screenBox) throw new Error('Mockup screen is not visible');

    if ((page.viewportSize()?.width ?? 0) < 640) {
      await expect(mockup.getByRole('tab', { name: 'Edit fields' })).toBeVisible();
      await expect(mockup.getByLabel('Brand / organisation name')).toBeVisible();
    }
    await expect(mockup.getByLabel('Brand / organisation name')).toHaveValue('Acme Inc.');
    await mockup.getByLabel('Brand / organisation name').fill('Presora demo');
    await mockup.getByLabel('Page title').fill('Presora search preview');
    if ((page.viewportSize()?.width ?? 0) < 640) {
      await mockup.getByRole('tab', { name: 'Preview tags' }).click();
    } else {
      for (const text of [
        'Social profile URLs (one per line, optional)',
        'Generated tags',
        'Paste this inside your page',
      ]) {
        const box = await mockup.getByText(text, { exact: false }).boundingBox();
        expect(box, `${text} should be visible`).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThanOrEqual(screenBox.y + screenBox.height);
      }
    }
    await expect(mockup.getByText('<title>Presora search preview</title>', { exact: false })).toBeVisible();
    await expect(mockup.getByText('"name": "Presora demo"', { exact: false })).toBeVisible();
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockup.getByRole('button', { name: 'Copy' }).click();
    await expect(mockup.getByRole('button', { name: 'Copied' })).toBeVisible();
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
