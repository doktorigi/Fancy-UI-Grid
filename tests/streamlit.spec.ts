import { test, expect } from '@playwright/test';

test('Streamlit loads server blocks and retains rejected drafts across Python reruns', async ({ page }) => {
  test.skip(!process.env.GRID_STREAMLIT_URL, 'Set GRID_STREAMLIT_URL to test the running server_example.py app.');
  test.setTimeout(120_000);
  await page.goto(process.env.GRID_STREAMLIT_URL!);
  const grid = page.frameLocator('iframe[title="fancy_ui_grid.fancy_ui_grid"]');
  await expect(grid.locator('#cell-1-amount')).toHaveText('100', { timeout: 60_000 });
  await expect(grid.getByText('1,000,000 rows', { exact: true })).toBeVisible();
  await grid.locator('#cell-1-amount').dblclick();
  await grid.getByLabel('Edit Amount').fill('30000');
  await grid.getByLabel('Edit Amount').press('Enter');
  await grid.getByRole('button', { name: 'Save all', exact: true }).click();
  await expect(grid.getByRole('alert').filter({ hasText: 'Amount must not exceed Limit' })).toBeVisible({ timeout: 15_000 });
  await expect(grid.locator('#cell-1-amount')).toHaveText('30000');
  await grid.locator('#cell-1-amount').dblclick();
  await grid.getByLabel('Edit Amount').fill('125');
  await grid.getByLabel('Edit Amount').press('Enter');
  await grid.getByRole('button', { name: 'Save all', exact: true }).click();
  await expect(grid.getByText('0 pending changes', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(grid.locator('#cell-1-amount')).toHaveText('125');
  await grid.getByRole('button', { name: 'Refresh data' }).click();
  await expect(grid.locator('#cell-1-amount')).toHaveText('125');
  // Restore the sample database so subsequent runs are repeatable.
  await grid.locator('#cell-1-amount').dblclick();
  await grid.getByLabel('Edit Amount').fill('100');
  await grid.getByLabel('Edit Amount').press('Enter');
  await grid.getByRole('button', { name: 'Save all', exact: true }).click();
  await expect(grid.getByText('0 pending changes', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(grid.locator('#cell-1-amount')).toHaveText('100');
});
