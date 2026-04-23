import { test, expect, type Page } from '@playwright/test';

async function createMesa(page: Page, name = 'Juan') {
  await page.goto('/');
  await page.getByPlaceholder('ej. Juan').first().fill(name);
  await page.getByRole('button', { name: /crear mesa/i }).click();
  await page.waitForURL(/\/s\/[A-Z0-9]{6}/);
  await page.waitForSelector('.session-title');
}

test('quantity: 3 × Cerveza 500 = 1500 line, claimed split between 2', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  await createMesa(host, 'Juan');
  const code = host.url().match(/\/s\/([A-Z0-9]{6})/)![1];

  // Add 3 × Cerveza @ 500 each = 1500 total
  await host.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Cerveza');
  await host.locator('.qty-input').fill('3');
  await host.getByPlaceholder('Precio').fill('500');
  await host.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();

  // Line total shown is 1500, badge shows "3×"
  await expect(host.locator('.item-qty', { hasText: '3×' })).toBeVisible();
  const line = await host.locator('.item-price-main').first().textContent();
  expect((line ?? '').replace(/\D/g, '')).toBe('150000');

  // Guest joins and also claims
  await guest.goto(`/s/${code}`);
  await guest.getByPlaceholder('ej. Juan').fill('Ana');
  await guest.getByRole('button', { name: 'Entrar' }).click();
  await guest.waitForSelector('.session-title');
  await guest.getByText('Cerveza').click();

  // Host also claims
  await host.getByText('Cerveza').click();

  // Each pays 1500 / 2 = 750
  const digits = (s: string | null) => (s ?? '').replace(/\D/g, '');
  await expect
    .poll(async () => digits(await host.locator('[data-testid="my-total"]').textContent()))
    .toBe('75000');
  await expect
    .poll(async () => digits(await guest.locator('[data-testid="my-total"]').textContent()))
    .toBe('75000');

  await hostCtx.close();
  await guestCtx.close();
});

test('scan: modal opens with a single file picker, can be cancelled', async ({ page }) => {
  await createMesa(page);
  await page.getByRole('button', { name: /Escanear ticket/i }).click();
  await expect(page.getByRole('heading', { name: /Escanear ticket/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Elegir imagen/i })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('heading', { name: /Escanear ticket/i })).not.toBeVisible();
});
