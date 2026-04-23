import { test, expect, type Page } from '@playwright/test';
import os from 'node:os';

function lanIP(): string {
  const nets = os.networkInterfaces();
  for (const infos of Object.values(nets)) {
    if (!infos) continue;
    for (const info of infos) {
      if (info.family === 'IPv4' && !info.internal) return info.address;
    }
  }
  return 'localhost';
}

const IP = lanIP();
const LAN_BASE = `http://${IP}:5173`;

test('LAN end-to-end: host (LAN) + guest (LAN) real-time sync', async ({ browser }) => {
  console.log(`Using LAN base URL: ${LAN_BASE}`);

  const hostCtx = await browser.newContext({ baseURL: LAN_BASE });
  const guestCtx = await browser.newContext({ baseURL: LAN_BASE });

  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  // Host creates session via LAN IP
  await host.goto(LAN_BASE + '/');
  await host.getByPlaceholder('ej. Juan').first().fill('Juan');
  await host.getByRole('button', { name: /crear mesa/i }).click();
  await host.waitForURL(/\/s\/[A-Z0-9]{6}/);
  const url = host.url();
  const code = url.match(/\/s\/([A-Z0-9]{6})/)![1];
  console.log(`Session created: ${code} at ${url}`);

  // Verify QR points to LAN IP
  const qrResp = await host.request.get(`${LAN_BASE}/api/sessions/${code}/qr`);
  const qrData = await qrResp.json();
  console.log(`QR joinUrl: ${qrData.joinUrl}`);
  expect(qrData.joinUrl).toContain(IP);
  expect(qrData.joinUrl).toContain(`:5173/s/${code}`);

  // Host adds item
  await host.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Empanadas');
  await host.getByPlaceholder('Precio').fill('2.500');
  await host.locator('form.add-item').getByRole('button', { name: 'Agregar' }).click();
  await host.waitForSelector('.item');

  // Guest joins session through LAN IP
  await guest.goto(`${LAN_BASE}/s/${code}`);
  await guest.getByPlaceholder('ej. Juan').fill('Ana');
  await guest.getByRole('button', { name: 'Entrar' }).click();
  await guest.waitForSelector('.session-title');

  // Guest sees item added by host (real-time via socket.io over LAN)
  await expect(guest.getByText('Empanadas')).toBeVisible({ timeout: 5000 });
  console.log('Guest sees the host-added item ✓');

  // Guest claims it
  await guest.getByText('Empanadas').click();

  // Host sees guest's claim in real-time (Ana appears as claimer on the item)
  await expect(host.locator('.item-claimers', { hasText: 'Ana' })).toBeVisible({ timeout: 5000 });
  console.log('Host sees guest claim in real-time ✓');

  // Guest's total should reflect claim
  const digits = (s: string | null) => (s ?? '').replace(/\D/g, '');
  await expect
    .poll(async () => digits(await guest.locator('[data-testid="my-total"]').textContent()))
    .toBe('250000');

  await hostCtx.close();
  await guestCtx.close();
});
