export type AppId = 'mercadopago' | 'paypal' | 'venmo' | 'uala' | 'pix' | 'other';

export type PayApp = {
  id: AppId;
  name: string;
  color: string;
  /** Official monochrome logo from simple-icons (MIT) or custom SVG for regional brands. */
  logo: string;
};

export const APPS: PayApp[] = [
  { id: 'mercadopago', name: 'Mercado Pago', color: '#00b1ea', logo: '/logo-mercadopago.svg' },
  { id: 'paypal',      name: 'PayPal',       color: '#003087', logo: '/logo-paypal.svg' },
  { id: 'venmo',       name: 'Venmo',        color: '#008cff', logo: '/logo-venmo.svg' },
  { id: 'uala',        name: 'Ualá',         color: '#8257ff', logo: '/logo-uala.svg' },
  { id: 'pix',         name: 'PIX',          color: '#00a884', logo: '/logo-pix.svg' }
];

export function isUrl(v: string): boolean {
  return /^https?:\/\//i.test(v.trim());
}

/**
 * Build the best URL to open each app for sending `amount` to `identifier`.
 *
 * Platforms supporting amount pre-fill:
 *  - PayPal.me: https://paypal.me/{user}/{amount}
 *  - Venmo:     https://venmo.com/{user}?txn=pay&amount={amount}&note={note}
 *
 * Platforms without a public P2P URL from an alias — we open the app home so
 * the guest can paste the alias (already copied to clipboard on click):
 *  - Mercado Pago, Ualá
 *
 * Platforms that use their own clipboard protocol (no URL):
 *  - PIX (returns null — guest pastes chave inside their bank app)
 *
 * Apple Pay and Google Pay are intentionally omitted: neither exposes a public
 * P2P URL scheme from the web to an arbitrary alias. (Google Pay supports UPI
 * only in India via `upi://pay?pa=...` and Apple Pay Cash is iMessage-only.)
 */
export function appOpenUrl(
  app: AppId,
  identifier: string,
  opts?: { amountCents?: number; note?: string }
): string | null {
  const id = identifier.trim();
  if (!id) return null;
  if (isUrl(id)) return id;

  const amount = opts?.amountCents ? (opts.amountCents / 100).toFixed(2) : null;
  const note = encodeURIComponent(opts?.note ?? 'Repartija');

  switch (app) {
    case 'paypal': {
      const user = id.replace(/^@/, '').replace(/^paypal\.me\//i, '');
      return `https://paypal.me/${encodeURIComponent(user)}${amount ? `/${amount}` : ''}`;
    }
    case 'venmo': {
      const user = id.replace(/^@/, '').replace(/^venmo\.com\//i, '');
      const qs = amount ? `?txn=pay&amount=${amount}&note=${note}` : '';
      return `https://venmo.com/${encodeURIComponent(user)}${qs}`;
    }
    case 'mercadopago':
      return 'https://www.mercadopago.com.ar/';
    case 'uala':
      return 'https://uala.com.ar/';
    case 'pix':
      return null;
    default:
      return null;
  }
}
