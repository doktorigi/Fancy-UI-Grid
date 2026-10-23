import { test, expect, type Locator, type Page } from '@playwright/test';

async function edit(region: Locator, id: number, field: string, value: string) {
  await region.locator(`#cell-${id}-${field}`).dblclick();
  const input = region.locator(`#cell-${id}-${field} input`);
  await input.fill(value);
  await input.press('Enter');
}
async function view(page: Page, region: Locator, name: string) {
  await region.getByRole('button', { name: 'Saved grid views' }).click();
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/workflows');
  await expect(page.locator('section[aria-label="Server data demo"] #cell-1-amount')).toHaveText('100');
});

test('invalid edits are marked; failed saves retain drafts; retry commits once', async ({ page }) => {
  const region = page.getByRole('region', { name: 'Batch editing demo' });
  await edit(region, 1, 'amount', '-1');
  await expect(region.locator('#cell-1-amount')).toHaveAttribute('aria-invalid', 'true');
  await expect(region.getByRole('button', { name: 'Save all', exact: true })).toBeDisabled();
  await edit(region, 1, 'amount', '250');
  await expect(region.locator('#cell-1-amount')).toHaveAttribute('data-pending', 'true');
  await expect(region.getByText('Committed amount: 174,750')).toBeVisible();
  await region.getByLabel('Simulate a failed save').check();
  await region.getByRole('button', { name: 'Save all', exact: true }).click();
  await expect(region.getByRole('alert')).toContainText('Your draft is intact');
  await expect(region.locator('#cell-1-amount')).toHaveText('250');
  await region.getByRole('button', { name: 'Save all', exact: true }).click();
  await expect(region.getByText('Saved batches: 1')).toBeVisible();
  await expect(region.locator('#cell-1-amount')).not.toHaveAttribute('data-pending', 'true');
  await expect(region.getByText('Committed amount: 174,900')).toBeVisible();
});

test('500-cell paste is one undoable draft batch and one save', async ({ page }) => {
  const region = page.getByRole('region', { name: 'Batch editing demo' });
  await region.locator('#cell-1-amount').click();
  await region.locator('#cell-1-amount').evaluate(element => {
    const clipboard = new DataTransfer();
    clipboard.setData('text/plain', Array.from({ length: 500 }, (_, i) => String(1000 + i)).join('\n'));
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: clipboard }));
  });
  await expect(region.getByText('500 pending changes', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(region.getByText('0 pending changes', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+y');
  await expect(region.getByText('500 pending changes', { exact: true })).toBeVisible();
  await region.getByRole('button', { name: 'Review changes' }).click();
  await expect(region.getByRole('button', { name: 'Next changes' })).toBeEnabled();
  await region.getByRole('button', { name: 'Save all', exact: true }).click();
  await expect(region.getByText('Saved batches: 1')).toBeVisible();
  await expect(region.getByText('Committed amount: 624,750')).toBeVisible();
});

test('Save and Discard finish an open editor; Escape cancels without a draft', async ({ page }) => {
  const region = page.getByRole('region', { name: 'Batch editing demo' });
  const cell = region.locator('#cell-1-amount');
  await edit(region, 1, 'amount', '-1');
  await expect(cell).toHaveAttribute('aria-invalid', 'true');
  await cell.dblclick();
  await region.getByLabel('Edit Amount').fill('125');
  await region.getByRole('button', { name: 'Save all', exact: true }).click();
  await expect(region.getByText('Saved batches: 1')).toBeVisible();
  await expect(cell).toHaveText('125');
  await expect(region.getByText('0 pending changes', { exact: true })).toBeVisible();
  await edit(region, 1, 'amount', '-1');
  await expect(cell).toHaveAttribute('aria-invalid', 'true');
  await cell.dblclick();
  await region.getByLabel('Edit Amount').fill('250');
  await region.getByRole('button', { name: 'Discard all' }).click();
  await expect(cell).toHaveText('125');
  await cell.dblclick();
  await region.getByLabel('Edit Amount').fill('500');
  await region.getByLabel('Edit Amount').press('Escape');
  await expect(cell).toHaveText('125');
  await expect(region.getByText('0 pending changes', { exact: true })).toBeVisible();
});

test('typed editors and cross-field validation share the draft and discard path', async ({ page }) => {
  const region = page.getByRole('region', { name: 'Batch editing demo' });
  await region.locator('#cell-1-region').dblclick();
  await region.getByLabel('Edit Region').selectOption('NY');
  await region.getByLabel('Edit Region').press('Enter');
  await region.locator('#cell-1-active').dblclick();
  await region.getByLabel('Edit Active').selectOption('true');
  await region.getByLabel('Edit Active').press('Enter');
  await edit(region, 1, 'date', '2026-11-01');
  await edit(region, 1, 'amount', '30000');
  await expect(region.getByRole('alert')).toContainText('Amount must not exceed Limit');
  await edit(region, 1, 'limit', '40000');
  await expect(region.getByRole('button', { name: 'Save all', exact: true })).toBeEnabled();
  await region.getByRole('button', { name: 'Discard all' }).click();
  await expect(region.locator('#cell-1-region')).toHaveText('CA');
  await expect(region.locator('#cell-1-active')).toHaveText('false');
  await expect(region.locator('#cell-1-date')).toHaveText('2026-10-01');
});

test('server blocks reach the last row; groups load children; pivots return full totals', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const region = page.getByRole('region', { name: 'Server data demo' });
  await region.locator('[data-grid-viewport]').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(region.locator('#cell-25000-id')).toHaveText('25000');
  expect(await region.locator('tbody tr').count()).toBeLessThan(40);
  await view(page, region, 'Regions with totals');
  await expect(region.getByRole('button', { name: 'Expand group CA' })).toBeVisible();
  await region.getByRole('button', { name: 'Expand group CA' }).click();
  await expect(region.locator('#cell-1-region')).toHaveText('CA');
  await expect(region.locator('#cell-5-region')).toHaveText('CA');
  await view(page, region, 'Region by status');
  await expect(region.locator('tfoot')).toContainText('114,987,500');
  await expect(region.locator('tbody tr')).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('SQLite handles one million rows, server filters, group totals and pivot totals', async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(!process.env.GRID_SQLITE_URL, 'Set GRID_SQLITE_URL to run the live SQLite acceptance test.');
  const region = page.getByRole('region', { name: 'Server data demo' });
  await region.getByLabel('Backend address').fill(process.env.GRID_SQLITE_URL!);
  await region.getByRole('button', { name: 'Connect SQLite' }).click();
  await expect(region.getByText('1,000,000 rows', { exact: true })).toBeVisible();
  await region.locator('[data-grid-viewport]').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(region.locator('#cell-1000000-id')).toHaveText('1000000');
  expect(await region.locator('tbody tr').count()).toBeLessThan(40);
  await region.getByRole('textbox', { name: 'Global search input' }).fill('CA');
  await expect(region.getByText('250,000 rows', { exact: true })).toBeVisible({ timeout: 15_000 });
  await region.getByRole('textbox', { name: 'Global search input' }).fill('');
  await expect(region.getByText('1,000,000 rows', { exact: true })).toBeVisible();
  await view(page, region, 'Regions with totals');
  await region.getByRole('button', { name: 'Expand group CA' }).click();
  await expect(region.locator('#cell-1-region')).toHaveText('CA');
  await view(page, region, 'Region by status');
  await expect(region.locator('tfoot')).toContainText('5,099,500,000', { timeout: 15_000 });
  await expect(region.locator('tbody tr')).toHaveCount(4);
});
