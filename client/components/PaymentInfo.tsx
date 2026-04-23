import { useState } from 'react';
import { IconWallet, IconCopy, IconCheck } from './Icon';
import type { PaymentMode, PaymentTarget } from '../../shared/types';
import { APPS, appOpenUrl, isUrl } from '../lib/payLinks';

type Props = {
  mode: PaymentMode;
  target: PaymentTarget | null;
  amountCents?: number;
  note?: string;
};

export default function PaymentInfo({ mode, target, amountCents, note }: Props) {
  const [copied, setCopied] = useState(false);
  if (mode === 'cash' || !target) return null;

  const hasUrl = isUrl(target.identifier);

  async function doCopy() {
    try {
      await navigator.clipboard.writeText(target!.identifier);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  async function openWith(appId: string) {
    try {
      await navigator.clipboard.writeText(target!.identifier);
    } catch {}
    const url = appOpenUrl(appId as any, target!.identifier, { amountCents, note });
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="card pay-info">
      <div className="pay-info-head">
        <IconWallet size={20} />
        <h2>Pagar a {target.label || 'host'}</h2>
      </div>

      <div className="pay-alias">
        <span className="pay-alias-label">Alias / CBU / Link</span>
        <code className="pay-alias-value">{target.identifier}</code>
        <button className="pay-alias-copy" onClick={doCopy} aria-label="Copiar alias">
          {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
          <span>{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>

      <div className="pay-apps">
        <p className="pay-apps-hint">
          {hasUrl
            ? 'Tocá para abrir el link directo — ya se copió el dato.'
            : 'Abrí tu app, pegá el alias y transferí.'}
        </p>
        <div className="pay-apps-grid">
          {APPS.map((a) => (
            <button
              key={a.id}
              type="button"
              className="pay-app"
              style={{ ['--tint' as string]: a.color }}
              onClick={() => openWith(a.id)}
              aria-label={`Abrir ${a.name}`}
            >
              <span className="pay-app-badge" style={{ background: a.color }}>
                <img src={a.logo} alt="" className="pay-app-logo" />
              </span>
              <span className="pay-app-name">{a.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
