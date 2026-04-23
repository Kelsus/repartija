import { test, expect } from '@playwright/test';
import { parseReceipt } from '../client/lib/receiptParser';

test('parser: legacy format with "N x name price"', () => {
  const sample = `
2 x Empanadas 800
3 x Agua con gas 400
Cerveza 1.200
`;
  const parsed = parseReceipt(sample);
  const items = parsed.filter((l) => l.include);
  expect(items.length).toBe(3);
  const emp = items.find((i) => /Empanadas/i.test(i.name))!;
  expect(emp.quantity).toBe(2);
  expect(emp.unitPriceCents).toBe(80000);
  const agua = items.find((i) => /Agua/i.test(i.name))!;
  expect(agua.quantity).toBe(3);
  expect(agua.unitPriceCents).toBe(40000);
  const cerv = items.find((i) => /Cerveza/i.test(i.name))!;
  expect(cerv.quantity).toBe(1);
  expect(cerv.unitPriceCents).toBe(120000);
});

test('parser: Spanish column ticket (Salamanca Silvestre sample)', () => {
  const sample = `
SALAMANCA Silvestre
SANCHEZ SIERRA, MODESTO
NIF: 7777286-C
Data: 11/03/2018  Hora: 18:30:00
Taula: 232  Comensals: 10

Descripció    Quant  Preu   Import
PAN           10,00  1,95   19,50
PAELLA DE MARISCO  8,00  17,95  143,60
PULPO FEIRA   1,00   19,90  19,90
AGUA LITRO    2,00   2,65   5,30
CERVEZA 300   2,00   2,55   5,10
CERVEZA 500   4,00   5,65   22,60
COCA COLA     1,00   2,55   2,55

Base Imp    %IVA   IVA
198,68      10,00  19,87
Total: 218.55
`;
  const parsed = parseReceipt(sample);
  const items = parsed.filter((l) => l.include);

  const pan = items.find((i) => i.name.toUpperCase().includes('PAN'))!;
  expect(pan).toBeTruthy();
  expect(pan.quantity).toBe(10);
  expect(pan.unitPriceCents).toBe(195);

  const paella = items.find((i) => i.name.toUpperCase().includes('PAELLA'))!;
  expect(paella.quantity).toBe(8);
  expect(paella.unitPriceCents).toBe(1795);

  const pulpo = items.find((i) => i.name.toUpperCase().includes('PULPO'))!;
  expect(pulpo.quantity).toBe(1);
  expect(pulpo.unitPriceCents).toBe(1990);

  const agua = items.find((i) => i.name.toUpperCase().includes('AGUA'))!;
  expect(agua.quantity).toBe(2);
  expect(agua.unitPriceCents).toBe(265);

  const c300 = items.find((i) => i.name.toUpperCase().includes('CERVEZA 300'))!;
  expect(c300).toBeTruthy();
  expect(c300.quantity).toBe(2);
  expect(c300.unitPriceCents).toBe(255);

  const c500 = items.find((i) => i.name.toUpperCase().includes('CERVEZA 500'))!;
  expect(c500).toBeTruthy();
  expect(c500.quantity).toBe(4);
  expect(c500.unitPriceCents).toBe(565);

  const coca = items.find((i) => i.name.toUpperCase().includes('COCA'))!;
  expect(coca.quantity).toBe(1);
  expect(coca.unitPriceCents).toBe(255);

  // "Base Imp", "Total" and headers should be skipped
  expect(items.some((i) => /total/i.test(i.name))).toBe(false);
  expect(items.some((i) => /base/i.test(i.name))).toBe(false);
  expect(items.some((i) => /descrip/i.test(i.name))).toBe(false);
});

test('parser: single price column fallback', () => {
  const parsed = parseReceipt('Pizza muzzarella 1.500,00\nGaseosa 600');
  const items = parsed.filter((l) => l.include);
  expect(items.length).toBe(2);
  const pizza = items.find((i) => /Pizza/.test(i.name))!;
  expect(pizza.quantity).toBe(1);
  expect(pizza.unitPriceCents).toBe(150000);
  const gas = items.find((i) => /Gaseosa/.test(i.name))!;
  expect(gas.quantity).toBe(1);
  expect(gas.unitPriceCents).toBe(60000);
});

test('parser: skips pure totals/header lines', () => {
  const parsed = parseReceipt(`
Subtotal 1000
IVA 21% 210
TOTAL 1210
Pizza 500
  `);
  const items = parsed.filter((l) => l.include);
  expect(items.length).toBe(1);
  expect(items[0].name).toMatch(/Pizza/i);
});

test('parser: skips restaurant header / address / phone blocks', () => {
  const sample = `
SALAMANCA Silvestre
SANCHEZ SIERRA, MODESTO
NIF: 7777286-C
Almirante Cervera, 34
08003 - Barcelona
93 221 50 33
Fra.Simple: TA111380180  Cambers: MARIA
OSE
Data: 11/03/2018  Hora: 18:30:00
Taula: 232  Comensals: 10

Descripció    Quant  Preu   Import
PAN           10,00  1,95   19,50
PAELLA DE MARISCO  8,00  17,95  143,60
COCA COLA     1,00   2,55   2,55

Base Imp    %IVA   IVA
198,68      10,00  19,87
Total: 218.55
`;
  const parsed = parseReceipt(sample);
  const items = parsed.filter((l) => l.include);

  // The only real items
  expect(items.length).toBe(3);
  const names = items.map((i) => i.name.toUpperCase());
  expect(names.some((n) => n.includes('PAN'))).toBe(true);
  expect(names.some((n) => n.includes('PAELLA'))).toBe(true);
  expect(names.some((n) => n.includes('COCA'))).toBe(true);

  // These should NOT be present
  expect(names.some((n) => n.includes('ALMIRANTE'))).toBe(false);
  expect(names.some((n) => n.includes('BARCELONA'))).toBe(false);
  expect(names.some((n) => n.includes('TAULA'))).toBe(false);
  expect(names.some((n) => n.includes('COMENSALS'))).toBe(false);
  expect(names.some((n) => n.includes('NIF'))).toBe(false);
  expect(names.some((n) => /^\d/.test(n))).toBe(false); // no phone/zip leaked

  // Quantities are right
  const pan = items.find((i) => /PAN/i.test(i.name))!;
  expect(pan.quantity).toBe(10);
  expect(pan.unitPriceCents).toBe(195);
  const paella = items.find((i) => /PAELLA/i.test(i.name))!;
  expect(paella.quantity).toBe(8);
  expect(paella.unitPriceCents).toBe(1795);
});

test('parser: multi-space columns reliably separate name from numeric cols', () => {
  const sample = `
Descripció    Quant  Preu   Import
PAN           10,00  1,95   19,50
CERVEZA 300   2,00   2,55   5,10
AGUA LITRO    2,00   2,65   5,30
COCA COLA 2L  1,00   2,55   2,55
`;
  const items = parseReceipt(sample).filter((l) => l.include);
  const byName = (re: RegExp) => items.find((i) => re.test(i.name))!;

  expect(byName(/PAN/).quantity).toBe(10);
  expect(byName(/PAN/).unitPriceCents).toBe(195);

  expect(byName(/CERVEZA 300/).quantity).toBe(2);
  expect(byName(/CERVEZA 300/).unitPriceCents).toBe(255);

  expect(byName(/AGUA LITRO/).quantity).toBe(2);
  expect(byName(/AGUA LITRO/).unitPriceCents).toBe(265);

  // "COCA COLA 2L" — the "2L" in the name must NOT be swallowed as quantity
  expect(byName(/COCA COLA 2L/).quantity).toBe(1);
  expect(byName(/COCA COLA 2L/).unitPriceCents).toBe(255);
});

test('parser: integer-looking decimals (2,00 / 2.00) read as qty 2', () => {
  const cases = [
    'Coca Cola    2,00   2,55  5,10',
    'Coca Cola    2.00   2.55  5.10',
    'Coca Cola    2      2.55  5.10'
  ];
  for (const line of cases) {
    const [item] = parseReceipt(line).filter((l) => l.include);
    expect(item, `case: ${line}`).toBeTruthy();
    expect(item.quantity).toBe(2);
    expect(item.unitPriceCents).toBe(255);
  }
});

test('parser: without header, still filters obvious address/phone lines', () => {
  const sample = `
Pizzeria La Mejor
Av. Corrientes 1234
4567-8900
Muzzarella 2.500,00
Empanadas 400
`;
  const parsed = parseReceipt(sample);
  const items = parsed.filter((l) => l.include);
  expect(items.length).toBe(2);
  expect(items.some((i) => /Muzzarella/i.test(i.name))).toBe(true);
  expect(items.some((i) => /Empanadas/i.test(i.name))).toBe(true);
  expect(items.some((i) => /Corrientes/i.test(i.name))).toBe(false);
});
