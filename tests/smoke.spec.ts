import { test, expect, type Page } from '@playwright/test';

test('multi-user: host creates, 2 guests join, claim items, totals match', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const anaCtx = await browser.newContext();
  const pedroCtx = await browser.newContext();

  const host = await hostCtx.newPage();
  const ana = await anaCtx.newPage();
  const pedro = await pedroCtx.newPage();

  // Host creates session
  await host.goto('/');
  await host.getByPlaceholder('ej. Juan').first().fill('Juan');
  await host.getByPlaceholder('ej. Cumple de Ana').fill('Asado');
  await host.getByRole('button', { name: /crear mesa/i }).click();
  await host.waitForURL(/\/s\/[A-Z0-9]{6}/);
  const url = host.url();
  const code = url.match(/\/s\/([A-Z0-9]{6})/)![1];

  // Host adds 2 items (qty 1 each by default)
  await host.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Pizza');
  await host.getByPlaceholder('Precio').fill('1000');
  await host.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();
  await expect(host.getByText('Pizza')).toBeVisible();

  await host.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Gaseosa');
  await host.getByPlaceholder('Precio').fill('600');
  await host.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();
  await expect(host.getByText('Gaseosa')).toBeVisible();

  // Guests join
  await joinAs(ana, code, 'Ana');
  await joinAs(pedro, code, 'Pedro');

  // Ana claims Pizza
  await ana.getByText('Pizza').click();

  // Pedro and Ana both claim Gaseosa (split)
  await pedro.getByText('Gaseosa').click();
  await ana.getByText('Gaseosa').click();

  // Wait for totals to propagate
  await ana.waitForTimeout(500);

  const digits = (s: string | null) => (s ?? '').replace(/\D/g, '');
  // Ana's total should be 1000 (Pizza) + 300 (half gaseosa) = 1300.00
  await expect
    .poll(async () => digits(await ana.locator('[data-testid="my-total"]').textContent()))
    .toBe('130000');

  // Pedro's total should be 300.00 (half gaseosa)
  await expect
    .poll(async () => digits(await pedro.locator('[data-testid="my-total"]').textContent()))
    .toBe('30000');

  await hostCtx.close();
  await anaCtx.close();
  await pedroCtx.close();
});

async function joinAs(page: Page, code: string, name: string) {
  await page.goto(`/s/${code}`);
  await page.getByPlaceholder('ej. Juan').fill(name);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForSelector('.session-title');
}
