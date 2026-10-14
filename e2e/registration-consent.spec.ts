import { expect, test } from '@playwright/test';

test('sales email consent is optional and unchecked by default', async ({ page }) => {
  await page.goto('/register');

  const consent = page.getByRole('checkbox', { name: /practical AI visibility tips/i });
  await expect(consent).toBeVisible();
  await expect(consent).not.toBeChecked();
  await expect(page.getByText(/Optional — unsubscribe anytime/i)).toBeVisible();

  await consent.check();
  await expect(consent).toBeChecked();
});
