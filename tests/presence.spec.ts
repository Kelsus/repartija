import { test, expect, type Page } from '@playwright/test';

async function host(page: Page, name = 'Juan') {
  await page.goto('/');
  await page.getByPlaceholder('ej. Juan').first().fill(name);
  await page.getByRole('button', { name: /crear mesa/i }).click();
  await page.waitForURL(/\/s\/[A-Z0-9]{6}/);
  await page.waitForSelector('.session-title');
}

async function joinAs(page: Page, code: string, name: string) {
  await page.goto(`/s/${code}`);
  await page.getByPlaceholder('ej. Juan').fill(name);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('duplicate name: second guest using same name gets rejected with error', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const a = await browser.newContext();
  const b = await browser.newContext();

  const hostPage = await hostCtx.newPage();
  const anaPage = await a.newPage();
  const duplicatePage = await b.newPage();

  await host(hostPage, 'Host');
  const code = hostPage.url().match(/\/s\/([A-Z0-9]{6})/)![1];

  await joinAs(anaPage, code, 'Ana');
  await anaPage.waitForSelector('.session-title');

  await joinAs(duplicatePage, code, 'Ana');
  // Should land back on needName with an error
  await expect(duplicatePage.getByText(/Ya hay alguien con el nombre/i)).toBeVisible({ timeout: 5000 });
  await expect(duplicatePage.getByRole('heading', { name: /Cómo te llamás/i })).toBeVisible();

  // Second attempt with a different name works
  await duplicatePage.getByPlaceholder('ej. Juan').fill('Ana 2');
  await duplicatePage.getByRole('button', { name: 'Entrar' }).click();
  await expect(duplicatePage.locator('.session-title')).toBeVisible();

  await hostCtx.close(); await a.close(); await b.close();
});

test('offline: closing a guest tab removes them from the chips and totals', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const hostPage = await hostCtx.newPage();
  const guestPage = await guestCtx.newPage();

  await host(hostPage, 'Host');
  const code = hostPage.url().match(/\/s\/([A-Z0-9]{6})/)![1];

  // Host adds an item
  await hostPage.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Pizza');
  await hostPage.getByPlaceholder('Precio').fill('1000');
  await hostPage.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();

  // Guest joins and claims
  await joinAs(guestPage, code, 'Ana');
  await guestPage.waitForSelector('.session-title');
  await guestPage.getByText('Pizza').click();

  // Host sees 2 participants
  await expect.poll(
    async () => hostPage.locator('.participants .chip').count()
  ).toBe(2);

  // Guest closes their tab → presence goes offline
  await guestPage.close();

  // Host should eventually see only themselves (offline guests hidden)
  await expect.poll(
    async () => hostPage.locator('.participants .chip').count(),
    { timeout: 8000 }
  ).toBe(1);

  // Pizza should now be unassigned in the totals list (not attributed to Ana)
  await expect(hostPage.locator('.totals-list li.unassigned')).toBeVisible();

  await hostCtx.close(); await guestCtx.close();
});
