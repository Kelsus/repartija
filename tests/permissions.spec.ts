import { test, expect, type Page } from '@playwright/test';

async function hostCreates(page: Page, name = 'Juan') {
  await page.goto('/');
  await page.getByPlaceholder('ej. Juan').first().fill(name);
  await page.getByRole('button', { name: /crear mesa/i }).click();
  await page.waitForURL(/\/s\/[A-Z0-9]{6}/);
  await page.waitForSelector('.session-title');
}

async function guestJoins(page: Page, code: string, name: string) {
  await page.goto(`/s/${code}`);
  await page.getByPlaceholder('ej. Juan').fill(name);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForSelector('.session-title');
}

test('host sees add-item form and scan button; guest does not', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  await hostCreates(host);
  const code = host.url().match(/\/s\/([A-Z0-9]{6})/)![1];

  // Host: form + scan visible
  await expect(host.locator('form.add-item')).toBeVisible();
  await expect(host.getByRole('button', { name: /Escanear ticket/i })).toBeVisible();

  // Guest joins
  await guestJoins(guest, code, 'Ana');
  await expect(guest.locator('form.add-item')).not.toBeVisible();
  await expect(guest.getByRole('button', { name: /Escanear ticket/i })).not.toBeVisible();

  // Host adds item; guest sees it and can claim it (but still cannot add/delete)
  await host.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Pizza');
  await host.getByPlaceholder('Precio').fill('1000');
  await host.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();
  await expect(guest.getByText('Pizza')).toBeVisible({ timeout: 3000 });

  // Guest does NOT see delete ✕
  await expect(guest.getByRole('button', { name: /Eliminar Pizza/i })).toHaveCount(0);
  // Host DOES see delete ✕
  await expect(host.getByRole('button', { name: /Eliminar Pizza/i })).toBeVisible();

  // Guest can claim
  await guest.getByText('Pizza').click();
  await expect(guest.locator('.item.claimed')).toBeVisible();

  await hostCtx.close();
  await guestCtx.close();
});

test('close confirm warns when items are unassigned', async ({ page }) => {
  await hostCreates(page);

  await page.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Pizza');
  await page.getByPlaceholder('Precio').fill('1000');
  await page.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();
  await expect(page.locator('.item')).toHaveCount(1);

  // Nothing claimed → unassigned = 1000
  await page.getByRole('button', { name: /Cerrar mesa/ }).click();
  await expect(page.getByRole('heading', { name: /Hay items sin reclamar/i })).toBeVisible();
  await expect(page.getByText(/sin asignar/i)).toBeVisible();
  // Cancel
  await page.getByRole('button', { name: /Volver y repartir/i }).click();
  await expect(page.getByRole('heading', { name: /Hay items sin reclamar/i })).not.toBeVisible();

  // Claim it (host can claim too)
  await page.getByText('Pizza').click();
  await expect(page.locator('.item.claimed')).toBeVisible();

  // Now close confirm is the normal one
  await page.getByRole('button', { name: /Cerrar mesa/ }).click();
  await expect(page.getByRole('heading', { name: /¿Cerrar la mesa\?/i })).toBeVisible();
});
