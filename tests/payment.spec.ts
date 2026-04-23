import { test, expect, type Page } from '@playwright/test';

async function hostCreatesWithId(page: Page, id: string) {
  await page.goto('/');
  await page.getByPlaceholder('ej. Juan').first().fill('Juan');
  await page.getByPlaceholder(/juan\.mp/).fill(id);
  await page.getByRole('button', { name: /crear mesa/i }).click();
  await page.waitForURL(/\/s\/[A-Z0-9]{6}/);
  await page.waitForSelector('.session-title');
}

async function addItemAndClaim(page: Page, name: string, price: string) {
  await page.getByPlaceholder('Item (ej. Pizza muzzarella)').fill(name);
  await page.getByPlaceholder('Precio').fill(price);
  await page.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();
  await page.getByText(name).click();
}

async function closeMesa(page: Page) {
  await page.getByRole('button', { name: /Cerrar mesa/ }).click();
  await page.locator('.confirm-modal').getByRole('button', { name: /Cerrar mesa/ }).click();
}

test('mesa open → PayBar is locked, no PaymentInfo card', async ({ page }) => {
  await hostCreatesWithId(page, 'juan.mp');
  await addItemAndClaim(page, 'Pizza', '1000');

  // PayBar present but locked (no action buttons)
  await expect(page.locator('.paybar')).toBeVisible();
  await expect(page.locator('.paybar.paybar-locked')).toBeVisible();
  await expect(page.getByText(/no cerró la mesa/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pagué/ })).toHaveCount(0);

  // PaymentInfo hidden while open
  await expect(page.locator('.pay-info')).toHaveCount(0);
});

test('mesa closed + fully claimed → PayBar unlocks and PaymentInfo appears', async ({ page }) => {
  await hostCreatesWithId(page, 'juan.mp');
  await addItemAndClaim(page, 'Pizza', '1000');
  await closeMesa(page);

  await expect(page.locator('.paybar.paybar-locked')).toHaveCount(0);
  await expect(page.locator('.pay-info')).toBeVisible();
  await expect(page.locator('.pay-alias-value')).toHaveText('juan.mp');
  await expect(page.locator('.pay-app')).toHaveCount(5);
  const names = await page.locator('.pay-app-name').allTextContents();
  expect(names).toEqual(['Mercado Pago', 'PayPal', 'Venmo', 'Ualá', 'PIX']);
  await expect(page.getByRole('button', { name: /Efectivo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pagué/ })).toBeVisible();
});

test('mesa closed but items unclaimed → PayBar locked with "sin reclamar" msg', async ({ page }) => {
  await hostCreatesWithId(page, 'juan.mp');

  // Host adds two items, only claims one
  await page.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Pizza');
  await page.getByPlaceholder('Precio').fill('1000');
  await page.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();
  await page.getByText('Pizza').click();

  await page.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Flan');
  await page.getByPlaceholder('Precio').fill('500');
  await page.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();
  // DON'T claim "Flan" — leaves it unassigned

  // Host force-closes despite the warning
  await page.getByRole('button', { name: /Cerrar mesa/ }).click();
  await page.locator('.confirm-modal').getByRole('button', { name: /Cerrar mesa/ }).click();

  await expect(page.locator('.paybar.paybar-locked')).toBeVisible();
  // The lock reason inside the PayBar should mention unclaimed items
  await expect(page.locator('.paybar-lock')).toContainText(/sin reclamar/i);
});

test('paid/pending totals update live for everyone as payments are marked', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  await hostCreatesWithId(host, 'juan.mp');
  const code = host.url().match(/\/s\/([A-Z0-9]{6})/)![1];

  // Host adds 2 items and claims Pizza
  await host.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Pizza');
  await host.getByPlaceholder('Precio').fill('1000');
  await host.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();
  await host.getByText('Pizza').click();

  await host.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Flan');
  await host.getByPlaceholder('Precio').fill('500');
  await host.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();

  // Guest joins and claims Flan
  await guest.goto(`/s/${code}`);
  await guest.getByPlaceholder('ej. Juan').fill('Ana');
  await guest.getByRole('button', { name: 'Entrar' }).click();
  await guest.waitForSelector('.session-title');
  await guest.getByText('Flan').click();

  await closeMesa(host);

  // Initially: 0 paid, 1500 pending — both clients see the same values
  const digits = (s: string | null) => (s ?? '').replace(/\D/g, '');
  await expect
    .poll(async () => digits(await host.locator('.paid-legend-paid strong').textContent()))
    .toBe('000');
  await expect
    .poll(async () => digits(await host.locator('.paid-legend-pending strong').textContent()))
    .toBe('150000');

  // Host marks themselves paid
  await host.getByRole('button', { name: /^Pagué/ }).click();

  await expect
    .poll(async () => digits(await guest.locator('.paid-legend-paid strong').textContent()))
    .toBe('100000');
  await expect
    .poll(async () => digits(await guest.locator('.paid-legend-pending strong').textContent()))
    .toBe('50000');

  // Guest marks paid too → everything cleared
  await guest.getByRole('button', { name: /^Pagué/ }).click();

  await expect
    .poll(async () => digits(await host.locator('.paid-legend-paid strong').textContent()))
    .toBe('150000');
  await expect
    .poll(async () => digits(await host.locator('.paid-legend-pending strong').textContent()))
    .toBe('000');

  await hostCtx.close(); await guestCtx.close();
});

test('chip shows paid status across clients in real time', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  await hostCreatesWithId(host, 'juan.mp');
  const code = host.url().match(/\/s\/([A-Z0-9]{6})/)![1];
  await addItemAndClaim(host, 'Pizza', '1000');

  await guest.goto(`/s/${code}`);
  await guest.getByPlaceholder('ej. Juan').fill('Ana');
  await guest.getByRole('button', { name: 'Entrar' }).click();
  await guest.waitForSelector('.session-title');

  await closeMesa(host);

  // Host marks paid — guest sees the chip update
  await host.getByRole('button', { name: /^Pagué/ }).click();
  await expect(guest.locator('.chip.pay-paid')).toBeVisible();

  await hostCtx.close(); await guestCtx.close();
});
