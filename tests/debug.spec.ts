import { test, expect } from '@playwright/test';

async function host(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByPlaceholder('ej. Juan').first().fill('Juan');
  await page.getByRole('button', { name: /crear mesa/i }).click();
  await page.waitForURL(/\/s\/[A-Z0-9]{6}/);
  await page.waitForSelector('.session-title');
}

test('add: empty price shows error and does not add', async ({ page }) => {
  await host(page);
  await page.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('SinPrecio');
  await page.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();
  await expect(page.locator('.form-error')).toBeVisible();
  expect(await page.locator('.item').count()).toBe(0);
});

test('add: "1.000" is parsed as 1000', async ({ page }) => {
  await host(page);
  await page.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Pizza');
  await page.getByPlaceholder('Precio').fill('1.000');
  await page.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();
  await page.waitForSelector('.item');
  const price = await page.locator('.item-price-main').first().textContent();
  expect((price ?? '').replace(/\D/g, '')).toBe('100000');
});

test('add: "1.000,50" is parsed as 1000.50', async ({ page }) => {
  await host(page);
  await page.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Fancy');
  await page.getByPlaceholder('Precio').fill('1.000,50');
  await page.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();
  await page.waitForSelector('.item');
  const price = await page.locator('.item-price-main').first().textContent();
  expect((price ?? '').replace(/\D/g, '')).toBe('100050');
});

test('add: "12.5" stays 12.50', async ({ page }) => {
  await host(page);
  await page.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Barato');
  await page.getByPlaceholder('Precio').fill('12.5');
  await page.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();
  await page.waitForSelector('.item');
  const price = await page.locator('.item-price-main').first().textContent();
  expect((price ?? '').replace(/\D/g, '')).toBe('1250');
});
