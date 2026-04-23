import { test, expect } from '@playwright/test';

test('create flow: requires host name before creating a mesa', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Crear mesa$/i }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByText(/Ingresá tu nombre para crear la mesa/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Crear mesa/i })).toBeVisible();
});

test('create flow: from home enters the session directly without asking for name again', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('ej. Juan').first().fill('Juan');
  await page.getByPlaceholder('ej. Cumple de Ana').fill('Asado');
  await page.getByRole('button', { name: /^Crear mesa$/i }).click();

  await page.waitForURL(/\/s\/[A-Z0-9]{6}/);
  await expect(page.locator('.session-title')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Cómo te llamás/i })).toHaveCount(0);
});

test('join flow: requires both name and code before navigating', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Unirme$/i }).click();

  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByText(/Ingresá tu nombre para unirte a la mesa/i)).toBeVisible();

  await page.getByPlaceholder('ej. Ana').fill('Ana');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByText(/Ingresá el código de la mesa/i)).toBeVisible();
});

test('join flow: from home enters the session directly without asking for name again', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  await host.goto('/');
  await host.getByPlaceholder('ej. Juan').first().fill('Host');
  await host.getByRole('button', { name: /^Crear mesa$/i }).click();
  await host.waitForURL(/\/s\/[A-Z0-9]{6}/);

  const code = host.url().match(/\/s\/([A-Z0-9]{6})/)![1];

  await guest.goto('/');
  await guest.getByRole('button', { name: /^Unirme$/i }).click();
  await guest.getByPlaceholder('ej. Ana').fill('Ana');
  await guest.getByPlaceholder('ABC123').fill(code);
  await guest.getByRole('button', { name: /^Entrar$/i }).click();

  await guest.waitForURL(new RegExp(`/s/${code}$`));
  await expect(guest.locator('.session-title')).toBeVisible();
  await expect(guest.getByRole('heading', { name: /Cómo te llamás/i })).toHaveCount(0);

  await hostCtx.close();
  await guestCtx.close();
});
