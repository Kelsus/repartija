import { test, expect } from '@playwright/test';
import { parsePrice } from '../client/lib/totals';

test.describe('parsePrice — locale & OCR variations', () => {
  const cases: Array<[string, number]> = [
    // integer-looking decimals
    ['1,00', 1],
    ['1.00', 1],
    ['2,00', 2],
    ['2.00', 2],
    ['10,00', 10],
    ['10.00', 10],

    // plain decimals
    ['19,50', 19.5],
    ['19.50', 19.5],
    ['1,95', 1.95],
    ['1.95', 1.95],
    ['12,5', 12.5],
    ['12.5', 12.5],

    // thousand separators (3 digits after the separator)
    ['1.000', 1000],
    ['1,000', 1000],
    ['12.345', 12345],
    ['12,345', 12345],

    // mixed: European "1.000,50" and US "1,000.50"
    ['1.000,50', 1000.5],
    ['1,000.50', 1000.5],
    ['12.345,67', 12345.67],
    ['12,345.67', 12345.67],

    // integers and zero
    ['0', 0],
    ['500', 500],
    ['1950', 1950],

    // currency and spaces
    ['$ 19,50', 19.5],
    ['€1.000,00', 1000],
    ['1 000', 1000]
  ];

  for (const [input, expected] of cases) {
    test(`"${input}" → ${expected}`, () => {
      const got = parsePrice(input);
      expect(got).toBeCloseTo(expected, 4);
    });
  }

  test('invalid returns null', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('--')).toBeNull();
  });
});
