import { useState } from 'react';
import { IconCheck } from './Icon';

type Props = {
  url: string | null;
  code: string;
  title: string;
};

function IconShare({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v14" />
    </svg>
  );
}

export default function ShareRow({ url, code, title }: Props) {
  const [fallbackCopied, setFallbackCopied] = useState(false);

  if (!url) return null;

  async function share() {
    const payload = {
      title: `Repartija · ${title}`,
      text: `Sumate a la mesa "${title}" en Repartija. Código: ${code}`,
      url: url!
    };

    // Prefer the native OS share sheet (includes Copy, WhatsApp, Messages,
    // Mail, AirDrop, Telegram and anything else the device has registered).
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(payload);
        return;
      } catch (err) {
        // user cancelled (AbortError) — do nothing; any other error falls through to copy
        if ((err as DOMException)?.name === 'AbortError') return;
      }
    }

    // Fallback for desktop browsers without navigator.share (e.g. Firefox): copy silently.
    try {
      await navigator.clipboard.writeText(url!);
      setFallbackCopied(true);
      setTimeout(() => setFallbackCopied(false), 2200);
    } catch {}
  }

  return (
    <div className="share-row">
      <button className="primary" onClick={share}>
        {fallbackCopied ? <IconCheck size={18} /> : <IconShare size={18} />}
        <span>{fallbackCopied ? '¡Link copiado!' : 'Compartir link'}</span>
      </button>
    </div>
  );
}
