import type { Item, SessionState } from '../../shared/types';

export type PerPerson = {
  id: string;
  name: string;
  subtotalCents: number;
  tipCents: number;
  totalCents: number;
};

export function lineTotalCents(item: Item): number {
  return item.unitPriceCents * item.quantity;
}

export function computeTotals(state: SessionState): {
  perPerson: PerPerson[];
  unassignedCents: number;
  grossCents: number;
  tipCents: number;
  grandCents: number;
  paidCents: number;
  pendingCents: number;
} {
  // Offline participants are treated as if they left — their claims don't
  // count and their shares aren't tracked.
  const onlineSet = new Set(state.participants.filter((p) => p.online).map((p) => p.id));

  const subtotals = new Map<string, number>();
  for (const p of state.participants) {
    if (p.online) subtotals.set(p.id, 0);
  }

  let unassigned = 0;
  let gross = 0;

  for (const item of state.items) {
    const line = lineTotalCents(item);
    gross += line;
    const activeClaimers = item.claimerIds.filter((id) => onlineSet.has(id));
    if (activeClaimers.length === 0) {
      unassigned += line;
      continue;
    }
    const share = line / activeClaimers.length;
    for (const pid of activeClaimers) {
      subtotals.set(pid, (subtotals.get(pid) ?? 0) + share);
    }
  }

  const tipRate = state.tipPercent / 100;
  const perPerson: PerPerson[] = state.participants
    .filter((p) => p.online)
    .map((p) => {
      const subtotal = Math.round(subtotals.get(p.id) ?? 0);
      const tip = Math.round(subtotal * tipRate);
      return {
        id: p.id,
        name: p.name,
        subtotalCents: subtotal,
        tipCents: tip,
        totalCents: subtotal + tip
      };
    });

  const tipCents = Math.round(gross * tipRate);

  let paidCents = 0;
  let pendingCents = 0;
  const statusById = new Map(state.participants.map((p) => [p.id, p.paymentStatus]));
  for (const p of perPerson) {
    if (statusById.get(p.id) === 'paid') paidCents += p.totalCents;
    else pendingCents += p.totalCents;
  }

  return {
    perPerson,
    unassignedCents: Math.round(unassigned),
    grossCents: gross,
    tipCents,
    grandCents: gross + tipCents,
    paidCents,
    pendingCents
  };
}

export function formatMoney(cents: number, currency: string): string {
  const value = cents / 100;
  try {
    const locale = currency === 'USD' ? 'en-US' : 'es-AR';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/**
 * Locale-robust price parser — handles both European ("1.000,50") and US
 * ("1,000.50") conventions, plus any mix an OCR might produce.
 *
 *   "19,50"    → 19.5   (2 digits after comma → decimal)
 *   "1.000"    → 1000   (3 digits after dot   → thousand sep)
 *   "1,000"    → 1000   (3 digits after comma → thousand sep)
 *   "1,00"     → 1      (2 digits after comma → decimal)
 *   "1.00"     → 1      (2 digits after dot   → decimal)
 *   "12.345,67"→ 12345.67 (mixed, comma is last → comma is decimal)
 *   "12,345.67"→ 12345.67 (mixed, dot is last   → dot is decimal)
 */
export function parsePrice(raw: string): number | null {
  const s = raw.trim().replace(/[€$£¥\s]/g, '');
  if (!s) return null;
  if (!/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let norm: string;

  if (lastDot >= 0 && lastComma >= 0) {
    // Both separators present — the LAST one is the decimal separator.
    if (lastComma > lastDot) {
      // Comma decimal, dots are thousand seps
      norm = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Dot decimal, commas are thousand seps
      norm = s.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    const afterComma = s.length - lastComma - 1;
    // Thousand separator pattern: groups of exactly 3 digits (1,000 / 12,345,678)
    if (afterComma === 3 && /^\d{1,3}(,\d{3})+$/.test(s)) {
      norm = s.replace(/,/g, '');
    } else {
      norm = s.replace(',', '.');
    }
  } else if (lastDot >= 0) {
    const afterDot = s.length - lastDot - 1;
    if (afterDot === 3 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
      norm = s.replace(/\./g, '');
    } else {
      norm = s;
    }
  } else {
    norm = s;
  }

  const n = parseFloat(norm);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
