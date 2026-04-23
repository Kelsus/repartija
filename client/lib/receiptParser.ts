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

function isIntegerish(n: number): boolean {
  return Math.abs(n - Math.round(n)) < 0.02;
}

function looksLikeQuantity(n: number): boolean {
  return n > 0 && n <= 99 && isIntegerish(n);
}

function approxLineTotal(qty: number, unit: number, total: number): boolean {
  const tol = Math.max(0.02, total * 0.03);
  return Math.abs(qty * unit - total) <= tol;
}

function extractLeadingQty(text: string): { qty: number; stripped: string } | null {
  const patterns = [
    /^\s*(\d{1,2})(?:[.,]0{1,2})?\s*[xX×]\s+(.+)$/i,
    /^\s*(\d{1,2})(?:[.,]0{1,2})?\s*(?:u|ud|uds|un|uni|unid|unidad(?:es)?)\s+(.+)$/i,
    /^\s*(\d{1,2})(?:[.,]0{1,2})\s+(.+)$/i,
    /^\s*(\d{1,2})\s+(.+)$/
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const qty = parseInt(m[1], 10);
    const stripped = m[2].trim();
    if (looksLikeQuantity(qty) && hasEnoughLetters(stripped)) {
      return { qty, stripped };
    }
  }
  return null;
}

function extractQtyFromName(name: string): { qty: number; stripped: string } | null {
  const patterns = [
    /^(.+?)\s*[xX×]\s*(\d{1,2})(?:[.,]0{1,2})?$/i,
    /^(.+?)\s+(\d{1,2})(?:[.,]0{1,2})?\s*(?:u|ud|uds|un|uni|unid|unidad(?:es)?)$/i,
    /^(.+?)\s+(\d{1,2})(?:[.,]0{1,2})$/i,
    /^(.+?)\s+(\d{1,2})$/i
  ];
  for (const re of patterns) {
    const m = name.match(re);
    if (!m) continue;
    const stripped = m[1].trim();
    const qty = parseInt(m[2], 10);
    if (looksLikeQuantity(qty) && hasEnoughLetters(stripped)) {
      return { qty, stripped };
    }
  }
  return null;
}

/**
 * Given a name column and the ordered numeric columns of a ticket line,
 * pick the (qty, unit) pair that is most consistent with the trailing `total`
 * column when present. If only 1 or 2 numbers are present, fall back to
 * reasonable defaults.
 */
function assign(
  name: string,
  nums: number[],
  explicitQty?: number
): { qty: number; unit: number; confidence: 'high' | 'medium' | 'low' } | null {
  const positive = nums.filter((n) => n > 0);
  if (positive.length === 0) return null;

  const qtyCandidates: Array<{ qty: number; idx: number | null; source: 'explicit' | 'numeric' }> = [];
  if (explicitQty && looksLikeQuantity(explicitQty)) {
    qtyCandidates.push({ qty: explicitQty, idx: null, source: 'explicit' });
  }
  positive.forEach((n, idx) => {
    if (looksLikeQuantity(n)) qtyCandidates.push({ qty: Math.round(n), idx, source: 'numeric' });
  });

  let best:
    | { qty: number; unit: number; confidence: 'high' | 'medium' | 'low'; score: number }
    | null = null;

  for (const q of qtyCandidates) {
    for (let unitIdx = 0; unitIdx < positive.length; unitIdx++) {
      if (q.idx === unitIdx) continue;
      for (let totalIdx = 0; totalIdx < positive.length; totalIdx++) {
        if (totalIdx === unitIdx || totalIdx === q.idx) continue;
        const unit = positive[unitIdx];
        const total = positive[totalIdx];
        if (!approxLineTotal(q.qty, unit, total)) continue;
        let score = 100;
        if (q.source === 'explicit') score += 20;
        if (totalIdx === positive.length - 1) score += 10;
        if (unitIdx < totalIdx) score += 5;
        if (q.idx !== null && q.idx < unitIdx) score += 4;
        const confidence = score >= 120 ? 'high' : 'medium';
        if (!best || score > best.score) {
          best = { qty: q.qty, unit, confidence, score };
        }
      }
    }
  }

  if (best) {
    return { qty: best.qty, unit: best.unit, confidence: best.confidence };
  }

  if (explicitQty && looksLikeQuantity(explicitQty)) {
    if (positive.length === 1) {
      return { qty: explicitQty, unit: positive[0], confidence: 'high' };
    }
    const withoutMatchingQty = positive.filter((n) => !looksLikeQuantity(n) || Math.round(n) !== explicitQty);
    const unit = withoutMatchingQty.length > 0 ? Math.min(...withoutMatchingQty) : Math.max(...positive);
    return { qty: explicitQty, unit, confidence: positive.length >= 2 ? 'medium' : 'high' };
  }

  if (positive.length === 2) {
    const [a, b] = positive;
    if (looksLikeQuantity(a) && b > 0) {
      return { qty: Math.max(1, Math.round(a)), unit: b, confidence: 'medium' };
    }
    if (looksLikeQuantity(b) && a > 0) {
      return { qty: Math.max(1, Math.round(b)), unit: a, confidence: 'medium' };
    }
    return { qty: 1, unit: Math.max(a, b), confidence: 'medium' };
  }

  return { qty: 1, unit: positive[positive.length - 1], confidence: 'medium' };
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

  // Strategy 1 — column split (2+ spaces separates columns)
  //   "PAN           10,00  1,95   19,50"
  //   → ["PAN", "10,00", "1,95", "19,50"]
  const cols = preserved.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
  if (cols.length >= 2) {
    const qtyInName = extractQtyFromName(cols[0]);
    const nameCol = qtyInName?.stripped ?? cols[0];
    const numCols = cols.slice(1);
    // All remaining columns must look numeric for this to be a true columnar row
    if (numCols.every(isNumericToken) && hasEnoughLetters(nameCol)) {
      const nums = numCols
        .map(cleanNum)
        .filter((n): n is number => n !== null && n >= 0);
      // Keep the LAST 4 columns so we still retain qty when OCR leaks an extra numeric code column.
      const effective = nums.slice(-4);
      const a = assign(nameCol, effective, qtyInName?.qty);
      if (a) return build(collapsed, nameCol, a);
    }
  }

  // Strategy 2 — fallback: walk tokens from the right collecting up to 3 numerics
  return parseFreeform(collapsed, collapsed);
}

function parseFreeform(rawLine: string, body: string): ParsedLine | null {
  const leadingQty = extractLeadingQty(body);
  const normalizedBody = leadingQty?.stripped ?? body;
  const tokens = normalizedBody.split(' ');
  if (tokens.length < 2) return null;
  const trailing: string[] = [];
  let i = tokens.length - 1;
  while (i >= 0 && isNumericToken(tokens[i]) && trailing.length < 3) {
    trailing.unshift(tokens[i]);
    i--;
  }
  if (trailing.length === 0) return null;
  const nameTokens = tokens.slice(0, i + 1);
  const rawName = nameTokens.join(' ').trim();
  const qtyInName = extractQtyFromName(rawName);
  const name = qtyInName?.stripped ?? rawName;
  if (!name) return null;
  if (!hasEnoughLetters(name)) return null;
  const nums = trailing
    .map(cleanNum)
    .filter((n): n is number => n !== null && n >= 0);
  if (nums.length === 0) return null;
  const explicitQty = qtyInName?.qty ?? leadingQty?.qty;
  const a = assign(name, nums, explicitQty);
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
