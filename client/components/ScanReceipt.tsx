import { useRef, useState } from 'react';
import { createWorker, type Worker as TesseractWorker } from 'tesseract.js';
import { parseReceipt, type ParsedLine } from '../lib/receiptParser';
import { formatMoney, parsePrice } from '../lib/totals';
import Modal from './Modal';

type Props = {
  currency: string;
  onConfirm: (items: { name: string; quantity: number; unitPriceCents: number }[]) => void;
  onClose: () => void;
};

type Phase = 'pick' | 'processing' | 'review' | 'error';

export default function ScanReceipt({ currency, onConfirm, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('pick');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [lines, setLines] = useState<ParsedLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setImgSrc(URL.createObjectURL(file));
    setPhase('processing');
    setProgress(0);
    setStatus('Cargando motor OCR…');

    let worker: TesseractWorker | null = null;
    try {
      worker = await createWorker('spa', 1, {
        logger: (m) => {
          if (m.status) setStatus(translateStatus(m.status));
          if (typeof m.progress === 'number') setProgress(Math.round(m.progress * 100));
        }
      });
      setStatus('Leyendo ticket…');
      const { data } = await worker.recognize(file);
      const parsed = parseReceipt(data.text);
      if (parsed.length === 0) {
        setError('No encontré items en la imagen. Probá con mejor luz o cargá manualmente.');
        setPhase('error');
      } else {
        setLines(parsed);
        setPhase('review');
      }
    } catch (err) {
      console.error(err);
      setError((err as Error).message || 'Error procesando la imagen');
      setPhase('error');
    } finally {
      try { await worker?.terminate(); } catch {}
    }
  }

  function updateLine(i: number, patch: Partial<ParsedLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addPriceFromString(i: number, s: string) {
    const p = parsePrice(s);
    if (p !== null) updateLine(i, { unitPriceCents: Math.round(p * 100) });
  }

  function confirm() {
    const items = lines
      .filter((l) => l.include && l.name.trim() && l.unitPriceCents >= 0)
      .map((l) => ({
        name: l.name.trim(),
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents
      }));
    if (items.length === 0) return;
    onConfirm(items);
  }

  const toConfirm = lines.filter((l) => l.include).length;

  return (
    <Modal open onClose={onClose} className="scan-modal">
      {phase === 'pick' && (
        <>
          <div className="scan-head">
            <h2>📷 Escanear ticket</h2>
          </div>
          <div className="scan-body">
            <p className="muted">
              En compu: abre el explorador de archivos. En celu: elegís cámara o galería desde el menú del sistema.
              Repartija detecta los items automáticamente; el OCR corre en tu dispositivo.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              data-test="file-input"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
          <div className="scan-foot">
            <button className="secondary" onClick={onClose}>Cancelar</button>
            <button className="primary" onClick={() => fileRef.current?.click()}>
              📷 Elegir imagen del ticket
            </button>
          </div>
        </>
      )}

      {phase === 'processing' && (
        <>
          <div className="scan-head">
            <h2>Procesando…</h2>
          </div>
          <div className="scan-body">
            {imgSrc && <img src={imgSrc} alt="ticket" className="scan-preview" />}
            <p className="muted">{status}</p>
            <div className="progress">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <p className="muted" style={{ fontSize: 12 }}>
              Primera vez puede tardar ~10s descargando el motor OCR.
            </p>
          </div>
        </>
      )}

      {phase === 'review' && (
        <>
          <div className="scan-head">
            <h2>Items detectados <span className="scan-count">{toConfirm}/{lines.length}</span></h2>
            <p className="muted">
              Destildá los que no sean items. Podés editar nombre, cantidad y precio.
            </p>
          </div>
          <div className="scan-body">
            <ul className="scan-lines">
              {lines.map((l, i) => (
                <li key={i} className={l.include ? 'on' : 'off'}>
                  <label className="scan-check">
                    <input
                      type="checkbox"
                      checked={l.include}
                      onChange={(e) => updateLine(i, { include: e.target.checked })}
                      aria-label={`Incluir ${l.name}`}
                    />
                  </label>
                  <div className="scan-content">
                    <div className="scan-row-top">
                      <input
                        className="scan-name"
                        value={l.name}
                        onChange={(e) => updateLine(i, { name: e.target.value })}
                        placeholder="Item"
                        aria-label="Nombre del item"
                      />
                      <span className="scan-line-total">
                        {formatMoney(l.unitPriceCents * l.quantity, currency)}
                      </span>
                    </div>
                    <div className="scan-row-bottom">
                      <input
                        type="number"
                        min={1}
                        max={99}
                        inputMode="numeric"
                        value={l.quantity}
                        onChange={(e) =>
                          updateLine(i, {
                            quantity: Math.max(1, parseInt(e.target.value) || 1)
                          })
                        }
                        className="scan-qty"
                        aria-label="Cantidad"
                      />
                      <span className="times">×</span>
                      <input
                        defaultValue={(l.unitPriceCents / 100).toFixed(2)}
                        onBlur={(e) => addPriceFromString(i, e.target.value)}
                        className="scan-price"
                        inputMode="decimal"
                        aria-label="Precio unitario"
                      />
                      <span className="scan-currency">{currency}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="scan-foot">
            <button className="secondary" onClick={onClose}>Cancelar</button>
            <button className="primary" onClick={confirm} disabled={toConfirm === 0}>
              Agregar {toConfirm} {toConfirm === 1 ? 'item' : 'items'}
            </button>
          </div>
        </>
      )}

      {phase === 'error' && (
        <>
          <div className="scan-head"><h2>Ups</h2></div>
          <div className="scan-body">
            <p className="error">{error}</p>
          </div>
          <div className="scan-foot">
            <button className="secondary" onClick={onClose}>Cerrar</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function translateStatus(s: string): string {
  if (s.includes('loading')) return 'Cargando motor OCR…';
  if (s.includes('initializing')) return 'Inicializando…';
  if (s.includes('recognizing text')) return 'Leyendo ticket…';
  return s;
}
