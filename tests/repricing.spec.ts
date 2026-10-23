import { test, expect } from '@playwright/test';

test('repricing stages premium changes and updates the difference after saving', async ({ page }) => {
  await page.goto('/repricing');
  await page.getByLabel('Rater Version', { exact: true }).click();
  await page.getByRole('option', { name: '1.1.0 (Proposed)' }).click();
  await page.getByLabel('Products', { exact: true }).click();
  await page.getByRole('option', { name: 'XPLTXL', exact: true }).click();
  await page.getByRole('button', { name: /Execute/ }).click();
  await page.locator('#cell-1-newPremium').dblclick();
  await page.getByLabel('Edit New Premium', { exact: true }).fill('1500');
  await page.getByLabel('Edit New Premium', { exact: true }).press('Enter');
  await expect(page.locator('#cell-1-newPremium')).toHaveAttribute('data-pending', 'true');
  await page.getByRole('button', { name: 'Save all', exact: true }).click();
  await expect(page.locator('#cell-1-newPremium')).not.toHaveAttribute('data-pending', 'true');
  await expect(page.locator('#cell-1-difference')).toHaveText('$250.00');
  await expect(page.locator('#cell-1-calc_rate_change_pct')).toHaveText('20');
});
