import { test, expect } from '@playwright/test';

test('delete: asks for confirmation before removing an item', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('ej. Juan').first().fill('Juan');
  await page.getByRole('button', { name: /crear mesa/i }).click();
  await page.waitForURL(/\/s\/[A-Z0-9]{6}/);
  await page.waitForSelector('.session-title');

  await page.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Pizza');
  await page.getByPlaceholder('Precio').fill('1000');
  await page.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();
  await expect(page.locator('.item')).toHaveCount(1);

  // Click the small X button (host-only)
  await page.getByRole('button', { name: /Eliminar Pizza/i }).click();

  // Confirm dialog appears
  await expect(page.getByRole('heading', { name: /Eliminar item/i })).toBeVisible();

  // Cancel → item stays
  await page.locator('.confirm-modal').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('heading', { name: /Eliminar item/i })).not.toBeVisible();
  await expect(page.locator('.item')).toHaveCount(1);

  // Try again and confirm → item goes away
  await page.getByRole('button', { name: /Eliminar Pizza/i }).click();
  await page.locator('.confirm-modal').getByRole('button', { name: /^Eliminar$/ }).click();
  await expect(page.locator('.item')).toHaveCount(0);
});
