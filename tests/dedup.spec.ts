import { test, expect } from '@playwright/test';

test('dedup: reload does not create a duplicate participant', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto('/');
  await page.getByPlaceholder('ej. Juan').first().fill('Juan');
  await page.getByRole('button', { name: /crear mesa/i }).click();
  await page.waitForURL(/\/s\/[A-Z0-9]{6}/);
  await page.waitForSelector('.session-title');

  // Count chips in "en la mesa"
  const initialCount = await page.locator('.participants .chip').count();
  expect(initialCount).toBe(1);

  // Reload
  await page.reload();
  await page.waitForSelector('.session-title');

  const afterReload = await page.locator('.participants .chip').count();
  expect(afterReload).toBe(1);

  // Reload again just to be sure (StrictMode double effects etc.)
  await page.reload();
  await page.waitForSelector('.session-title');

  const afterTwoReloads = await page.locator('.participants .chip').count();
  expect(afterTwoReloads).toBe(1);

  await ctx.close();
});

test('dedup: guest joining twice still shows as 1 guest', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  await host.goto('/');
  await host.getByPlaceholder('ej. Juan').first().fill('Host');
  await host.getByRole('button', { name: /crear mesa/i }).click();
  await host.waitForURL(/\/s\/[A-Z0-9]{6}/);
  const code = host.url().match(/\/s\/([A-Z0-9]{6})/)![1];

  // Guest joins
  await guest.goto(`/s/${code}`);
  await guest.getByPlaceholder('ej. Juan').fill('Ana');
  await guest.getByRole('button', { name: 'Entrar' }).click();
  await guest.waitForSelector('.session-title');

  // Host sees 2 participants (Host + Ana)
  await expect
    .poll(async () => await host.locator('.participants .chip').count())
    .toBe(2);

  // Guest reloads
  await guest.reload();
  await guest.waitForSelector('.session-title');

  // Still only 2 participants on host (no duplicate Ana)
  await expect
    .poll(async () => await host.locator('.participants .chip').count())
    .toBe(2);

  // Only one "Ana" chip on host
  const anaCount = await host.locator('.participants .chip', { hasText: 'Ana' }).count();
  expect(anaCount).toBe(1);

  await hostCtx.close();
  await guestCtx.close();
});
