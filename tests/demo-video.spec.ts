import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

const OUT_DIR = path.join(process.cwd(), 'docs/assets/demo-videos');
const RAW_DIR = path.join(process.cwd(), 'test-results/demo-raw');
const VP = { width: 390, height: 844 };

test.setTimeout(180_000);

test('demo video: 3 personas, flujo completo', async ({ browser }) => {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(RAW_DIR, { recursive: true });

  const hostCtx = await browser.newContext({
    viewport: VP,
    deviceScaleFactor: 2,
    recordVideo: { dir: RAW_DIR, size: VP }
  });
  const anaCtx = await browser.newContext({
    viewport: VP,
    deviceScaleFactor: 2,
    recordVideo: { dir: RAW_DIR, size: VP }
  });
  const betoCtx = await browser.newContext({
    viewport: VP,
    deviceScaleFactor: 2,
    recordVideo: { dir: RAW_DIR, size: VP }
  });

  const host = await hostCtx.newPage();
  const ana = await anaCtx.newPage();
  const beto = await betoCtx.newPage();

  await Promise.all([ana.goto('/'), beto.goto('/')]);
  await beat(800);

  await host.goto('/');
  await beat(900);
  await host.getByPlaceholder('ej. Juan').first().fill('Juan');
  await beat(300);
  await host.getByPlaceholder('ej. Cumple de Ana').fill('Asado');
  await beat(300);
  await host.getByPlaceholder(/juan\.mp/).fill('juan.mp');
  await beat(500);
  await host.getByRole('button', { name: /crear mesa/i }).click();
  await host.waitForURL(/\/s\/[A-Z0-9]{6}/);
  await host.waitForSelector('.session-title');
  const code = host.url().match(/\/s\/([A-Z0-9]{6})/)![1];
  await beat(900);

  await host.getByRole('button', { name: /Invitar/i }).click();
  await expect(host.getByRole('heading', { name: /Invitá a la mesa/i })).toBeVisible();
  await beat(2200);
  await host.getByRole('button', { name: /^Cerrar$/ }).click();
  await beat(500);

  await addItem(host, 'Pizza', '1200');
  await beat(350);
  await addItem(host, 'Gaseosa', '600');
  await beat(350);
  await addItem(host, 'Postre', '900');
  await beat(900);

  await Promise.all([
    joinViaUrl(ana, code, 'Ana'),
    joinViaHome(beto, code, 'Beto')
  ]);
  await beat(1400);

  await toggleClaim(host, 'Pizza');
  await beat(600);
  await toggleClaim(ana, 'Pizza');
  await beat(600);
  await toggleClaim(ana, 'Postre');
  await beat(700);
  await toggleClaim(beto, 'Gaseosa');
  await beat(1200);

  await host.getByRole('button', { name: '10%' }).click();
  await beat(1500);

  await host.getByRole('button', { name: /Cerrar mesa/i }).click();
  await beat(500);
  await host.locator('.confirm-modal').getByRole('button', { name: /Cerrar mesa/i }).click();
  await expect(host.locator('.pill.closed')).toBeVisible();
  await beat(1600);

  await host.getByRole('button', { name: /Efectivo/i }).click();
  await beat(700);
  await host.getByRole('button', { name: /^Pagué$/ }).click();
  await beat(500);
  await ana.getByRole('button', { name: /^Pagué$/ }).click();
  await beat(500);
  await beto.getByRole('button', { name: /^Pagué$/ }).click();
  await beat(2200);

  await Promise.all([hostCtx.close(), anaCtx.close(), betoCtx.close()]);

  await host.video()!.saveAs(path.join(OUT_DIR, 'host.webm'));
  await ana.video()!.saveAs(path.join(OUT_DIR, 'ana.webm'));
  await beto.video()!.saveAs(path.join(OUT_DIR, 'beto.webm'));
});

async function beat(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

async function joinViaHome(page: Page, code: string, name: string) {
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
