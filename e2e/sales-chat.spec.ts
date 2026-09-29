import { test, expect } from './fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('dialog', { name: 'Cookie consent' }).getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await page.getByRole('button', { name: 'Open chat', exact: true }).click();
});

test('formats answers, keeps follow-up context, and supports keyboard dismissal', async ({ page }, testInfo) => {
  const requests: { messages: { role: string; text: string }[] }[] = [];
  await page.route('**/.netlify/functions/chat-sales', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { reply: '**Start with a scan.**\n\n- Compare your results\n- Prioritize improvements\n\n<script>alert(1)</script>' } });
  });
  const panel = page.getByRole('dialog', { name: 'Ask Presora' });
  const input = panel.getByRole('textbox', { name: 'Ask a question' });
  await expect(input).toBeFocused();
  await panel.getByRole('button', { name: 'How can Presora help my agency?' }).click();
  await expect(panel.locator('strong')).toHaveText('Start with a scan.');
  await expect(panel.getByRole('listitem')).toHaveCount(2);
  await expect(panel.getByText('<script>alert(1)</script>', { exact: true })).toBeVisible();
  await expect(panel.locator('script')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('chat-layout.png') });
  await input.fill('What should I do next?');
  await input.press('Shift+Enter');
  await expect(input).toHaveValue('What should I do next?\n');
  await input.press('Enter');
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[0].messages).toEqual([{ role: 'user', text: 'How can Presora help my agency?' }]);
  expect(requests[1].messages.map(m => m.role)).toEqual(['user', 'assistant', 'user']);
  const box = await panel.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await input.press('Escape');
  await expect(panel).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open chat', exact: true })).toBeFocused();
});

test('retries a failed answer without duplicating the question', async ({ page }) => {
  let calls = 0;
  await page.route('**/.netlify/functions/chat-sales', async route => {
    calls++;
    await route.fulfill(calls === 1
      ? { status: 503, body: 'Unavailable' }
      : { json: { reply: 'You can explore the available plans on the pricing page.' } });
  });
  const panel = page.getByRole('dialog', { name: 'Ask Presora' });
  await panel.getByRole('button', { name: 'How much does it cost?' }).click();
  await expect(panel.getByRole('alert')).toContainText('Please try again');
  await panel.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(panel.getByText('You can explore the available plans on the pricing page.')).toBeVisible();
  await expect(panel.getByText('How much does it cost?', { exact: true })).toHaveCount(1);
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(panel.getByRole('link', { name: 'See all plans and pricing' })).toHaveAttribute('href', '/pricing');
});
