import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: false
});

test('mobile: add-item form is fully reachable and tappable', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('ej. Juan').first().fill('Juan');
  await page.getByRole('button', { name: /crear mesa/i }).click();
  await page.waitForURL(/\/s\/[A-Z0-9]{6}/);
  await page.waitForSelector('.session-title');

  const addBtn = page.locator('form.add-item').getByRole('button', { name: 'Agregar' });
  await expect(addBtn).toBeVisible();
  // Must be in viewport and large enough to tap
  const box = await addBtn.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(40);

  await page.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Cerveza');
  await page.locator('.qty-input').fill('2');
  await page.getByPlaceholder('Precio').fill('500');
  await addBtn.click();
  await expect(page.getByText('Cerveza')).toBeVisible();
});

test('mobile: scan modal has single file picker that handles camera + gallery', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('ej. Juan').first().fill('Juan');
  await page.getByRole('button', { name: /crear mesa/i }).click();
  await page.waitForURL(/\/s\/[A-Z0-9]{6}/);
  await page.waitForSelector('.session-title');

  await page.getByRole('button', { name: /Escanear ticket/i }).click();
  await page.waitForSelector('.scan-foot');

  const pickBtn = page.getByRole('button', { name: /Elegir imagen/i });
  const cancelBtn = page.getByRole('button', { name: 'Cancelar' });

  for (const b of [pickBtn, cancelBtn]) {
    await expect(b).toBeVisible();
    const box = await b.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  // The input must exist, accept images, and NOT force capture
  // (absence of capture = OS shows native sheet with Camera + Photos on mobile)
  const fileInput = page.locator('input[data-test="file-input"]');
  await expect(fileInput).toHaveCount(1);
  expect(await fileInput.getAttribute('accept')).toContain('image');
  expect(await fileInput.getAttribute('capture')).toBeNull();

  await cancelBtn.click();
  await expect(page.locator('.scan-foot')).not.toBeVisible();
});

test('walking: multiple lizards animate and distribute around viewport', async ({ page }) => {
  await page.goto('/');
  // Should render several walking lizards
  const count = await page.locator('.walker').count();
  expect(count).toBeGreaterThanOrEqual(8);

  // At least one horizontal walker and one vertical walker should exist
  expect(await page.locator('.walker-right, .walker-left').count()).toBeGreaterThanOrEqual(1);
  expect(await page.locator('.walker-up, .walker-down').count()).toBeGreaterThanOrEqual(1);

  // Sanity: walkers are positioned absolutely (not stuck to 0,0)
  const boxes = await page.locator('.walker').evaluateAll((els) =>
    els.map((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return { x: r.x, y: r.y };
    })
  );
  const uniquePositions = new Set(boxes.map((b) => `${Math.round(b.x / 10)}-${Math.round(b.y / 10)}`));
  expect(uniquePositions.size).toBeGreaterThanOrEqual(4);
});

test('mobile: sticky PayBar does not cover the Agregar button after scroll', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('ej. Juan').first().fill('Juan');
  await page.getByRole('button', { name: /crear mesa/i }).click();
  await page.waitForURL(/\/s\/[A-Z0-9]{6}/);
  await page.waitForSelector('.session-title');

  await page.getByPlaceholder('Item (ej. Pizza muzzarella)').fill('Pizza');
  await page.getByPlaceholder('Precio').fill('1000');
  const addBtn = page.locator('form.add-item').getByRole('button', { name: 'Agregar' });
  await addBtn.click();
  // Claim to show PayBar
  await page.getByText('Pizza').click();

  await addBtn.scrollIntoViewIfNeeded();
  await expect(addBtn).toBeVisible();

  const paybar = page.locator('.paybar');
  await expect(paybar).toBeVisible();
  const aBox = await addBtn.boundingBox();
  const pBox = await paybar.boundingBox();
  expect(aBox!.y + aBox!.height).toBeLessThan(pBox!.y + 1);
});
