import { parsePrice } from './totals';

export type ParsedLine = {
  include: boolean;
  name: string;
  quantity: number;
  unitPriceCents: number;
  rawLine: string;
  confidence: 'high' | 'medium' | 'low';
};

const SKIP_KEYWORDS = [
  'total', 'subtotal', 'sub-total',
  'iva', 'vat', 'impuesto', 'tax',
  'descuento', 'desc.', 'dto', 'propina', 'tip',
  'servicio', 'cubierto', 'consumicion', 'consumición',
  'cambio', 'efectivo', 'tarjeta', 'debito', 'débito', 'crédito', 'credito',
  'gracias', 'thank', 'thanks', 'factura', 'invoice', 'recibo',
  'cuit', 'cif', 'nif', 'rfc', 'ruc', 'cnpj',
  'ticket',
  'fecha', 'date', 'hora', 'time',
  'mesa', 'taula', 'table', 'mozo', 'waiter', 'cajero', 'cashier', 'caja', 'vendedor',
  'cliente', 'comensals', 'comensales', 'covers',
  'base imp', 'base imponible',
  'tel.', 'tel:', 'teléfono', 'telefono', 'phone',
  'calle', 'av.', 'avda', 'avenida', 'c/', 'carrer',
  'email', 'e-mail', 'www.', 'http'
];

const HEADER_TOKENS = [
  ['descripci', 'quant', 'preu', 'import'],
  ['descripci', 'cant', 'precio'],
  ['item', 'cant', 'precio'],
  ['item', 'qty', 'price'],
  ['detalle', 'cant', 'importe'],
  ['producto', 'cant', 'precio'],
  ['concepto', 'cant', 'importe']
];

const FOOTER_PATTERN =
  /^\s*(subtotal|sub-total|total|base\s*imp|impuesto|iva|vat|propina|tip|descuento|dto|gracias|thank)\b/i;

function looksLikeSkipKeyword(line: string): boolean {
  const lower = line.toLowerCase().trim();
  if (!lower) return true;
  if (lower.length < 3) return true;
  return SKIP_KEYWORDS.some((k) => {
    if (k.endsWith('.') || k.endsWith(':') || k.startsWith('#') || k.startsWith('c/') || k.endsWith('°')) {
      return lower.includes(k);
    }
    const re = new RegExp(`(^|\\b)${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\b|$)`, 'i');
    return re.test(lower);
  });
}

function looksLikeAddress(line: string): boolean {
  const t = line.trim();
  const addrMatch = t.match(/^(.*),\s*(\d{1,4})\s*$/);
  if (addrMatch) {
    const before = addrMatch[1].trim();
    if (before && !/\d$/.test(before)) return true;
  }
  if (/^\s*\d{4,5}\s*-?\s*[A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ\s]*$/.test(t)) return true;
  if (/^[\d\s\-().+]+$/.test(t) && (t.match(/\d/g) ?? []).length >= 7) return true;
  return false;
}

function isNumericToken(t: string): boolean {
  const clean = t.replace(/[€$£¥\s]/g, '');
  return /^[0-9]+([.,][0-9]+)*$/.test(clean) && /[0-9]/.test(clean);
}

function cleanNum(raw: string): number | null {
  return parsePrice(raw.replace(/[€$£¥\s]/g, ''));
}

function hasEnoughLetters(s: string, min = 2): boolean {
  return (s.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑçÇ]/g) ?? []).length >= min;
}

/**
 * Given a name column and the ordered numeric columns of a ticket line,
 * pick the (qty, unit) pair that is most consistent with the trailing `total`
 * column when present. If only 1 or 2 numbers are present, fall back to
 * reasonable defaults.
 */
function assign(
  name: string,
  nums: number[]
): { qty: number; unit: number; confidence: 'high' | 'medium' | 'low' } | null {
  const positive = nums.filter((n) => n > 0);
  if (positive.length === 0) return null;

  if (nums.length >= 3) {
    const [q, u, t] = nums;
    const tol = Math.max(0.02, t * 0.03);
    if (q > 0 && q <= 200 && u > 0 && t > 0 && Math.abs(q * u - t) <= tol) {
      return { qty: Math.max(1, Math.round(q)), unit: u, confidence: 'high' };
    }
    // Try alternate orders in case columns are shifted
    //  [unit, qty, total] or [qty, total, unit]
    const perms: Array<[number, number, number]> = [
      [nums[0], nums[1], nums[2]],
      [nums[1], nums[0], nums[2]],
      [nums[0], nums[2], nums[1]]
    ];
    for (const [qq, uu, tt] of perms) {
      const t2 = Math.max(0.02, tt * 0.03);
      if (qq > 0 && qq <= 200 && uu > 0 && tt > 0 && Math.abs(qq * uu - tt) <= t2) {
        return { qty: Math.max(1, Math.round(qq)), unit: uu, confidence: 'high' };
      }
    }
    // No valid match — the last column is most likely the line total; take it as unit with qty=1
    return { qty: 1, unit: t > 0 ? t : u, confidence: 'low' };
  }

  if (nums.length === 2) {
    const [a, b] = nums;
    const aIsQty = a > 0 && a <= 50 && Math.abs(a - Math.round(a)) < 0.02;
    if (aIsQty && b > 0 && b > a) {
      return { qty: Math.max(1, Math.round(a)), unit: b, confidence: 'medium' };
    }
    return { qty: 1, unit: b > 0 ? b : a, confidence: 'medium' };
  }

  return { qty: 1, unit: nums[0], confidence: 'medium' };
}

function build(
  rawLine: string,
  name: string,
  assignment: { qty: number; unit: number; confidence: 'high' | 'medium' | 'low' }
): ParsedLine | null {
  if (!(assignment.unit > 0)) return null;
  return {
    // All detected items default to checked — user unchecks false positives.
    include: true,
    name: name.slice(0, 60),
    quantity: Math.max(1, Math.min(99, assignment.qty)),
    unitPriceCents: Math.round(assignment.unit * 100),
    rawLine,
    confidence: assignment.confidence
  };
}

function parseLine(raw: string): ParsedLine | null {
  if (!raw.trim()) return null;
  // Preserve internal spacing so we can detect columns (don't collapse multiple spaces yet).
  const preserved = raw.replace(/\t/g, '    ').replace(/\r/g, '').trimEnd().replace(/^\s+/, '');
  const collapsed = preserved.replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;

  if (looksLikeAddress(collapsed)) return null;
  if (looksLikeSkipKeyword(collapsed)) return null;

  // Legacy "N x Name price" prefix
  const prefix = collapsed.match(/^(\d{1,2})\s*[xX×]\s+(.+)$/);
  if (prefix) {
    const explicitQty = parseInt(prefix[1], 10);
    const rest = prefix[2];
    // Parse remaining line for name + trailing numbers
    const parsed = parseFreeform(collapsed, rest);
    if (parsed) {
      parsed.quantity = Math.max(1, Math.min(99, explicitQty));
      parsed.confidence = 'high';
      return parsed;
    }
    return null;
  }

  // Strategy 1 — column split (2+ spaces separates columns)
  //   "PAN           10,00  1,95   19,50"
  //   → ["PAN", "10,00", "1,95", "19,50"]
  const cols = preserved.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
  if (cols.length >= 2) {
    const nameCol = cols[0];
    const numCols = cols.slice(1);
    // All remaining columns must look numeric for this to be a true columnar row
    if (numCols.every(isNumericToken) && hasEnoughLetters(nameCol)) {
      const nums = numCols
        .map(cleanNum)
        .filter((n): n is number => n !== null && n >= 0);
      // Keep the LAST 3 columns (ignore any stray extra columns at the end, like "IVA %")
      const effective = nums.slice(-3);
      const a = assign(nameCol, effective);
      if (a) return build(collapsed, nameCol, a);
    }
  }

  // Strategy 2 — fallback: walk tokens from the right collecting up to 3 numerics
  return parseFreeform(collapsed, collapsed);
}

function parseFreeform(rawLine: string, body: string): ParsedLine | null {
  const tokens = body.split(' ');
  if (tokens.length < 2) return null;
  const trailing: string[] = [];
  let i = tokens.length - 1;
  while (i >= 0 && isNumericToken(tokens[i]) && trailing.length < 3) {
    trailing.unshift(tokens[i]);
    i--;
  }
  if (trailing.length === 0) return null;
  const nameTokens = tokens.slice(0, i + 1);
  const name = nameTokens.join(' ').trim();
  if (!name) return null;
  if (!hasEnoughLetters(name)) return null;
  const nums = trailing
    .map(cleanNum)
    .filter((n): n is number => n !== null && n >= 0);
  if (nums.length === 0) return null;
  const a = assign(name, nums);
  if (!a) return null;
  return build(rawLine, name, a);
}

function findItemsRange(rawLines: string[]): [number, number] {
  let start = 0;
  let end = rawLines.length;
  const lower = rawLines.map((l) => l.toLowerCase());
  for (let i = 0; i < lower.length; i++) {
    const l = lower[i];
    for (const tokens of HEADER_TOKENS) {
      if (tokens.every((t) => l.includes(t))) {
        start = i + 1;
        break;
      }
    }
    if (start > 0) break;
  }
  for (let i = start; i < rawLines.length; i++) {
    if (FOOTER_PATTERN.test(rawLines[i])) {
      end = i;
      break;
    }
  }
  return [start, end];
}

export function parseReceipt(rawText: string): ParsedLine[] {
  const rawLines = rawText.split(/\r?\n/);
  const [start, end] = findItemsRange(rawLines);
  const range = rawLines.slice(start, end);
  const parsed = range
    .map(parseLine)
    .filter((x): x is ParsedLine => x !== null);
  if (parsed.length === 0 && (start > 0 || end < rawLines.length)) {
    return rawLines.map(parseLine).filter((x): x is ParsedLine => x !== null);
  }
  return parsed;
}
