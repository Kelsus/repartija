import { test, expect, type BrowserContext, type Page } from '@playwright/test';

test('full flow: host invites, guests split items, tip updates, close and pay', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const anaCtx = await browser.newContext();
  const betoCtx = await browser.newContext();

  const host = await hostCtx.newPage();
  const ana = await anaCtx.newPage();
  const beto = await betoCtx.newPage();

  await createMesa(host, {
    name: 'Juan',
    title: 'Asado',
    identifier: 'juan.mp'
  });
  const code = codeFrom(host);

  await host.getByRole('button', { name: /Invitar/i }).click();
  await expect(host.getByRole('heading', { name: /Invitá a la mesa/i })).toBeVisible();
  await expect(host.locator('.code-display')).toHaveText(code);
  await expect(host.locator('.join-url')).toContainText(`/s/${code}`);
  await host.getByRole('button', { name: /^Cerrar$/ }).click();

  await addItem(host, 'Pizza', '1200');
  await addItem(host, 'Gaseosa', '600');
  await addItem(host, 'Postre', '900');

  await joinViaHome(ana, code, 'Ana');
  await joinViaUrl(beto, code, 'Beto');

  await expect.poll(async () => host.locator('.participants .chip').count()).toBe(3);

  await toggleClaim(host, 'Pizza');
  await toggleClaim(ana, 'Pizza');
  await toggleClaim(ana, 'Postre');
  await toggleClaim(beto, 'Gaseosa');

  await host.getByRole('button', { name: '10%' }).click();

  await expectMyTotal(host, '66000');
  await expectMyTotal(ana, '165000');
  await expectMyTotal(beto, '66000');

  await closeMesa(host);

  await expect(beto.locator('.pay-info')).toBeVisible();
  await expect(beto.locator('.pay-alias-value')).toHaveText('juan.mp');

  await host.getByRole('button', { name: /Efectivo/i }).click();
  await expect(ana.locator('.chip', { hasText: 'Juan' })).toHaveClass(/pay-intent_cash/);

  await ana.getByRole('button', { name: /^Pagué$/ }).click();
  await beto.getByRole('button', { name: /^Pagué$/ }).click();
  await host.getByRole('button', { name: /^Pagué$/ }).click();

  await expect.poll(async () => legendDigits(host, '.paid-legend-paid strong')).toBe('297000');
  await expect.poll(async () => legendDigits(host, '.paid-legend-pending strong')).toBe('000');

  await expect(ana.locator('.chip', { hasText: 'Juan' })).toHaveClass(/pay-paid/);
  await expect(host.locator('.chip', { hasText: 'Ana' })).toHaveClass(/pay-paid/);
  await expect(host.locator('.chip', { hasText: 'Beto' })).toHaveClass(/pay-paid/);

  await closeContexts(hostCtx, anaCtx, betoCtx);
});

test('full flow: closing with unassigned items keeps payments locked until reopen and re-close', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const anaCtx = await browser.newContext();
  const betoCtx = await browser.newContext();

  const host = await hostCtx.newPage();
  const ana = await anaCtx.newPage();
  const beto = await betoCtx.newPage();

  await createMesa(host, {
    name: 'Host',
    title: 'Cena',
    identifier: 'host.mp'
  });
  const code = codeFrom(host);

  await addItem(host, 'Pizza', '1000');
  await addItem(host, 'Flan', '500');

  await joinViaUrl(ana, code, 'Ana');
  await joinViaHome(beto, code, 'Beto');

  await toggleClaim(ana, 'Pizza');

  await closeMesa(host);

  await expect(host.locator('.pill.closed')).toBeVisible();
  await expect(ana.locator('.paybar.paybar-locked')).toBeVisible();
  await expect(ana.locator('.paybar-lock')).toContainText(/sin reclamar/i);
  await expect(beto.locator('.pay-info')).toHaveCount(0);

  await host.getByRole('button', { name: /Reabrir mesa/i }).click();

  await expect(host.locator('.pill.closed')).toHaveCount(0);
  await expect(ana.locator('.paybar.paybar-locked')).toBeVisible();

  await toggleClaim(beto, 'Flan');
  await closeMesa(host);

  await expect(ana.locator('.paybar.paybar-locked')).toHaveCount(0);
  await expect(beto.locator('.paybar.paybar-locked')).toHaveCount(0);
  await expect(beto.locator('.pay-info')).toBeVisible();
  await expectMyTotal(ana, '100000');
  await expectMyTotal(beto, '50000');

  await closeContexts(hostCtx, anaCtx, betoCtx);
});

test('full flow: reopen locks payments again and lets the host keep editing for everyone', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const anaCtx = await browser.newContext();

  const host = await hostCtx.newPage();
  const ana = await anaCtx.newPage();

  await createMesa(host, {
    name: 'Juan',
    title: 'Picada',
    identifier: 'juan.mp'
  });
  const code = codeFrom(host);

  await addItem(host, 'Pizza', '1000');
  await joinViaUrl(ana, code, 'Ana');
  await toggleClaim(ana, 'Pizza');

  await closeMesa(host);
  await expect(ana.locator('.paybar.paybar-locked')).toHaveCount(0);

  await host.getByRole('button', { name: /Reabrir mesa/i }).click();

  await expect(ana.locator('.paybar.paybar-locked')).toBeVisible();
  await expect(ana.locator('.paybar-lock')).toContainText(/todavía no cerró la mesa/i);
  await expect(host.locator('form.add-item')).toBeVisible();
  await expect(ana.locator('form.add-item')).not.toBeVisible();

  await addItem(host, 'Flan', '500');
  await expect(ana.getByText('Flan')).toBeVisible();
  await toggleClaim(host, 'Flan');

  await closeMesa(host);

  await expectMyTotal(host, '50000');
  await expectMyTotal(ana, '100000');
  await expect(host.locator('.pay-info')).toBeVisible();
  await expect(ana.locator('.pay-info')).toBeVisible();

  await closeContexts(hostCtx, anaCtx);
});

async function createMesa(
  page: Page,
  data: { name: string; title?: string; identifier?: string }
) {
  await page.goto('/');
  await page.getByPlaceholder('ej. Juan').first().fill(data.name);
  if (data.title) await page.getByPlaceholder('ej. Cumple de Ana').fill(data.title);
  if (data.identifier) await page.getByPlaceholder(/juan\.mp/).fill(data.identifier);
  await page.getByRole('button', { name: /crear mesa/i }).click();
  await page.waitForURL(/\/s\/[A-Z0-9]{6}/);
  await page.waitForSelector('.session-title');
}

async function joinViaHome(page: Page, code: string, name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: /^Unirme$/ }).click();
  await page.getByPlaceholder('ej. Ana').fill(name);
  await page.getByPlaceholder('ABC123').fill(code);
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  await page.waitForSelector('.session-title');
}

async function joinViaUrl(page: Page, code: string, name: string) {
  await page.goto(`/s/${code}`);
  await page.getByPlaceholder('ej. Juan').fill(name);
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  await page.waitForSelector('.session-title');
}

async function addItem(page: Page, name: string, price: string, quantity = '1') {
  await page.getByPlaceholder('Item (ej. Pizza muzzarella)').fill(name);
  await page.locator('.qty-input').fill(quantity);
  await page.getByPlaceholder('Precio').fill(price);
  await page.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();
  await expect(page.getByText(name)).toBeVisible();
}

async function toggleClaim(page: Page, itemName: string) {
  await page.locator('.item').filter({ hasText: itemName }).locator('.item-main').click();
}

async function closeMesa(page: Page) {
  await page.getByRole('button', { name: /Cerrar mesa/i }).click();
  await page.locator('.confirm-modal').getByRole('button', { name: /Cerrar mesa/i }).click();
  await expect(page.locator('.pill.closed')).toBeVisible();
}

async function expectMyTotal(page: Page, expectedDigits: string) {
  await expect.poll(async () => digits(await page.locator('[data-testid="my-total"]').textContent())).toBe(expectedDigits);
}

async function legendDigits(page: Page, selector: string) {
  return digits(await page.locator(selector).textContent());
}

function codeFrom(page: Page) {
  return page.url().match(/\/s\/([A-Z0-9]{6})/)![1];
}

function digits(text: string | null) {
  return (text ?? '').replace(/\D/g, '');
}

async function closeContexts(...contexts: BrowserContext[]) {
  await Promise.all(contexts.map((ctx) => ctx.close()));
}
