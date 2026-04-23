import { useEffect, useMemo, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { getSocket } from '../lib/socket';
import {
  getHostToken,
  getOrCreateParticipantId,
  getSavedName,
  saveName,
  saveParticipantId
} from '../lib/storage';
import type { JoinAck, PaymentStatus, SessionState } from '../../shared/types';
import { computeTotals, formatMoney, lineTotalCents, parsePrice } from '../lib/totals';
import ScanReceipt from '../components/ScanReceipt';
import BrandMark from '../components/BrandMark';
import Modal, { ConfirmDialog } from '../components/Modal';
import PayBar from '../components/PayBar';
import PaymentInfo from '../components/PaymentInfo';
import {
  IconPlus, IconTrash, IconCamera, IconQr, IconUsers, IconLock, IconUnlock, IconCheck, IconCash, IconLink, IconReceipt, IconCopy
} from '../components/Icon';
import ShareRow from '../components/ShareRow';

type Status = 'needName' | 'joining' | 'connected' | 'error';

export default function Session() {
  const [, params] = useRoute('/s/:code');
  const code = (params?.code ?? '').toUpperCase();

  const [status, setStatus] = useState<Status>('needName');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [name, setName] = useState(getSavedName());
  const [nameDraft, setNameDraft] = useState(getSavedName());
  const [state, setState] = useState<SessionState | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (!name) {
      setStatus('needName');
      return;
    }
    const socket = getSocket();
    setStatus('joining');
    const stablePid = getOrCreateParticipantId(code);
    const hostToken = getHostToken(code) ?? undefined;

    const onState = (s: SessionState) => setState(s);
    socket.on('session:state', onState);

    socket.emit(
      'session:join',
      { code, name, participantId: stablePid, hostToken },
      (ack: JoinAck) => {
        if (!ack.ok) {
          setErrorMsg(ack.error);
          setStatus('error');
          // Force the user back to the name picker so they can try a different name
          if (/nombre/i.test(ack.error ?? '')) {
            setName('');
            setStatus('needName');
            setErrorMsg(ack.error);
          }
          return;
        }
        setState(ack.state);
        setParticipantId(ack.participantId);
        saveParticipantId(code, ack.participantId);
        setIsHost(ack.isHost);
        setStatus('connected');
      }
    );

    return () => {
      socket.off('session:state', onState);
    };
  }, [code, name]);

  useEffect(() => {
    if (!isHost || !code) return;
    fetch(`/api/sessions/${code}/qr`)
      .then((r) => r.json())
      .then((d) => {
        setQrDataUrl(d.qrDataUrl);
        setJoinUrl(d.joinUrl);
      })
      .catch(() => {});
  }, [isHost, code]);

  if (status === 'needName') {
    return (
      <main className="home">
        <header className="home-hero">
          <h1><BrandMark size={36} /> Repartija</h1>
          <p>Mesa <strong>{code}</strong></p>
        </header>
        <section className="card">
          <h2>¿Cómo te llamás?</h2>
          {errorMsg && <p className="error">{errorMsg}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = nameDraft.trim();
              if (!n) return;
              setErrorMsg(null);
              saveName(n);
              setName(n);
            }}
          >
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="ej. Juan"
              maxLength={40}
            />
            <button className="primary">Entrar</button>
          </form>
        </section>
      </main>
    );
  }

  if (status === 'error' || !state) {
    return (
      <main className="home">
        <header className="home-hero">
          <h1><BrandMark size={36} /> Repartija</h1>
        </header>
        <section className="card">
          <h2>Ups</h2>
          <p className="error">{errorMsg ?? 'Conectando…'}</p>
          <a href="/" className="linky">← Volver</a>
        </section>
      </main>
    );
  }

  return (
    <SessionView
      state={state}
      code={code}
      participantId={participantId!}
      isHost={isHost}
      qrDataUrl={qrDataUrl}
      joinUrl={joinUrl}
      showQR={showQR}
      setShowQR={setShowQR}
    />
  );
}

function SessionView({
  state,
  code,
  participantId,
  isHost,
  qrDataUrl,
  joinUrl,
  showQR,
  setShowQR
}: {
  state: SessionState;
  code: string;
  participantId: string;
  isHost: boolean;
  qrDataUrl: string | null;
  joinUrl: string | null;
  showQR: boolean;
  setShowQR: (b: boolean) => void;
}) {
  const socket = getSocket();
  const [, navigate] = useLocation();
  const totals = useMemo(() => computeTotals(state), [state]);
  const myTotal = totals.perPerson.find((p) => p.id === participantId);

  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showScan, setShowScan] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    const n = itemName.trim();
    if (!n) {
      setFormError('Falta el nombre del item');
      return;
    }
    const price = parsePrice(itemPrice);
    if (price === null) {
      setFormError('Falta el precio (ej. 1000 o 1.000 o 1,50)');
      return;
    }
    const qty = Math.max(1, parseInt(itemQty, 10) || 1);
    setFormError(null);
    socket.emit('item:add', {
      code,
      name: n,
      quantity: qty,
      unitPriceCents: Math.round(price * 100)
    });
    setItemName('');
    setItemPrice('');
    setItemQty('1');
  }

  function addManyFromScan(
    items: { name: string; quantity: number; unitPriceCents: number }[],
    detectedCurrency: string | null
  ) {
    if (
      detectedCurrency &&
      detectedCurrency !== state?.currency &&
      isHost
    ) {
      const hostToken = getHostToken(code);
      socket.emit('session:currency', { code, hostToken, currency: detectedCurrency });
    }
    socket.emit('items:addMany', { code, items });
    setShowScan(false);
  }

  function toggleClaim(itemId: string, currentlyClaimed: boolean) {
    socket.emit('item:claim', {
      code,
      itemId,
      participantId,
      claim: !currentlyClaimed
    });
  }

  function removeItem(itemId: string) {
    socket.emit('item:remove', { code, itemId });
    setDeleteItemId(null);
  }

  const itemToDelete = state.items.find((i) => i.id === deleteItemId);

  function setTip(percent: number) {
    socket.emit('session:tip', { code, percent });
  }

  function closeSession() {
    const hostToken = getHostToken(code);
    socket.emit('session:close', { code, hostToken });
    setShowCloseConfirm(false);
  }

  function reopen() {
    const hostToken = getHostToken(code);
    socket.emit('session:reopen', { code, hostToken });
  }

  function markPayment(s: PaymentStatus) {
    if (!participantId) return;
    socket.emit('participant:payment', { code, participantId, status: s });
  }

  const myParticipant = state.participants.find((p) => p.id === participantId);

  return (
    <main className="session">
      <header className="session-header">
        <div className="session-title">
          <h1>{state.title}</h1>
          <div className="session-meta">
            <span className="pill">Mesa {state.code}</span>
            {state.closed && <span className="pill closed">Cerrada</span>}
            {isHost && <span className="pill host">Host</span>}
          </div>
        </div>
        {isHost && qrDataUrl && (
          <button className="qr-btn" onClick={() => setShowQR(true)} title="Mostrar QR para invitar">
            <img src={qrDataUrl} alt="QR" />
            <span><IconQr size={14} /> Invitar</span>
          </button>
        )}
      </header>

      <Modal open={showQR && !!qrDataUrl} onClose={() => setShowQR(false)}>
        <h2>Invitá a la mesa</h2>
        {qrDataUrl && <img src={qrDataUrl} alt="QR code" className="qr-big" />}
        <p className="code-display">{state.code}</p>
        {joinUrl && <p className="join-url">{joinUrl}</p>}
        <ShareRow url={joinUrl} code={state.code} title={state.title} />
        <button className="secondary" onClick={() => setShowQR(false)}>Cerrar</button>
      </Modal>

      <section className="card participants">
        <h2>
          <IconUsers size={18} />
          <span>En la mesa</span>
          <span className="count-badge">{state.participants.filter((p) => p.online).length}</span>
        </h2>
        <div className="chips">
          {state.participants
            .filter((p) => p.online)
            .sort((a, b) => {
              if (a.id === participantId) return -1;
              if (b.id === participantId) return 1;
              return 0;
            })
            .map((p) => (
              <span
                key={p.id}
                className={`chip on ${p.id === participantId ? 'me' : ''} pay-${p.paymentStatus}`}
                title={payStatusLabel(p.paymentStatus, true)}
              >
                <span className="chip-name">{p.name}</span>
                {p.id === participantId && <span className="chip-me">vos</span>}
                {p.isHost && <span className="chip-host">host</span>}
                {p.paymentStatus !== 'pending' && (
                  <span className={`chip-pay chip-pay-${p.paymentStatus}`}>
                    {payStatusIcon(p.paymentStatus)}
                  </span>
                )}
              </span>
            ))}
        </div>
      </section>


      <section className="card items">
        <h2>
          <IconReceipt size={18} />
          <span>Items</span>
          <span className="count-badge">{state.items.length}</span>
        </h2>
        {state.items.length === 0 && (
          <p className="muted">Aún no hay items. Agregá el primero 👇</p>
        )}
        <ul className="item-list">
          {state.items.map((item) => {
            const claimed = item.claimerIds.includes(participantId);
            const n = item.claimerIds.length;
            const line = lineTotalCents(item);
            const share = n > 0 ? line / n : line;
            const claimers = item.claimerIds
              .map((id) => state.participants.find((p) => p.id === id)?.name)
              .filter(Boolean) as string[];
            return (
              <li key={item.id} className={`item ${claimed ? 'claimed' : ''}`}>
                <button
                  className="item-main"
                  onClick={() => !state.closed && toggleClaim(item.id, claimed)}
                  disabled={state.closed}
                >
                  <span className="item-check">{claimed ? '✓' : ''}</span>
                  <span className="item-info">
                    <span className="item-name">
                      {item.quantity > 1 && <span className="item-qty">{item.quantity}×</span>}
                      {item.name}
                    </span>
                    <span className="item-claimers">
                      {item.quantity > 1 && (
                        <span className="item-unit">
                          {formatMoney(item.unitPriceCents, state.currency)} c/u ·{' '}
                        </span>
                      )}
                      {claimers.length === 0
                        ? 'sin reclamar'
                        : claimers.length === 1
                        ? claimers[0]
                        : `${claimers.join(', ')} (÷${n})`}
                    </span>
                  </span>
                  <span className="item-price">
                    <span className="item-price-main">{formatMoney(line, state.currency)}</span>
                    {n > 1 && (
                      <span className="item-price-sub">
                        ÷ {n} = {formatMoney(Math.round(share), state.currency)}
                      </span>
                    )}
                  </span>
                </button>
                {isHost && !state.closed && (
                  <button
                    className="item-remove"
                    onClick={() => setDeleteItemId(item.id)}
                    aria-label={`Eliminar ${item.name}`}
                    title="Eliminar"
                  >
                    <IconTrash size={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {!state.closed && isHost && (
          <>
            <form onSubmit={addItem} className="add-item">
              <input
                placeholder="Item (ej. Pizza muzzarella)"
                value={itemName}
                onChange={(e) => {
                  setItemName(e.target.value);
                  if (formError) setFormError(null);
                }}
                maxLength={60}
                className="add-name"
              />
              <input
                type="number"
                min={1}
                max={99}
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
                className="qty-input"
                title="Cantidad"
                aria-label="Cantidad"
              />
              <input
                type="text"
                inputMode="decimal"
                placeholder="Precio"
                value={itemPrice}
                onChange={(e) => {
                  setItemPrice(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="price-input"
              />
              <button className="primary" type="submit" aria-label="Agregar item">
                <IconPlus size={18} />
                <span>Agregar</span>
              </button>
            </form>
            {formError && <p className="error form-error">{formError}</p>}
            <div className="scan-divider">
              <span>o</span>
            </div>
            <button className="secondary scan-btn" onClick={() => setShowScan(true)}>
              <IconCamera size={18} />
              <span>Escanear ticket</span>
            </button>
          </>
        )}
        {!state.closed && !isHost && state.items.length === 0 && (
          <p className="muted" style={{ textAlign: 'center', marginTop: 12 }}>
            El host está cargando los items…
          </p>
        )}

      </section>

      <section className="card totals">
        <div className="totals-header">
          <h2>Totales</h2>
          <div className="tip-selector">
            <span>Propina</span>
            {[0, 10, 15, 20].map((pct) => (
              <button
                key={pct}
                className={`tip-btn ${state.tipPercent === pct ? 'on' : ''}`}
                onClick={() => setTip(pct)}
                disabled={state.closed}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
        <ul className="totals-list">
          {totals.perPerson
            .filter((p) => p.id === participantId || p.totalCents > 0)
            .sort((a, b) => {
              if (a.id === participantId) return -1;
              if (b.id === participantId) return 1;
              return b.totalCents - a.totalCents;
            })
            .map((p) => {
              const isMe = p.id === participantId;
              const participant = state.participants.find((pp) => pp.id === p.id);
              const status = participant?.paymentStatus ?? 'pending';
              const showStatus = state.closed && p.totalCents > 0;
              return (
                <li
                  key={p.id}
                  className={[isMe ? 'me' : '', showStatus ? `pay-${status}` : '']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="totals-name">
                    {p.name}
                    {isMe && <span className="chip-me">vos</span>}
                    {showStatus && (
                      <span className={`totals-pay-badge pay-${status}`}>
                        {payStatusIcon(status)}
                        <span>{payStatusShort(status)}</span>
                      </span>
                    )}
                  </span>
                  <span className="totals-amount">{formatMoney(p.totalCents, state.currency)}</span>
                </li>
              );
            })}
          {totals.unassignedCents > 0 && (
            <li className="unassigned">
              <span className="totals-name">Sin reclamar</span>
              <span className="totals-amount">{formatMoney(totals.unassignedCents, state.currency)}</span>
            </li>
          )}
        </ul>
        <div className="totals-footer">
          <div>
            <span>Subtotal</span>
            <strong>{formatMoney(totals.grossCents, state.currency)}</strong>
          </div>
          {state.tipPercent > 0 && (
            <div>
              <span>Propina ({state.tipPercent}%)</span>
              <strong>{formatMoney(totals.tipCents, state.currency)}</strong>
            </div>
          )}
          <div className="grand">
            <span>Total</span>
            <strong>{formatMoney(totals.grandCents, state.currency)}</strong>
          </div>
        </div>

        {state.closed && totals.grandCents > 0 && (
          <div className="paid-progress">
            <div
              className="paid-bar"
              style={{
                width: `${
                  totals.grandCents > 0
                    ? Math.round((totals.paidCents / totals.grandCents) * 100)
                    : 0
                }%`
              }}
            />
            <div className="paid-legend">
              <span className="paid-legend-paid">
                <span className="dot" /> Pagado
                <strong>{formatMoney(totals.paidCents, state.currency)}</strong>
              </span>
              <span className="paid-legend-pending">
                <span className="dot" /> Pendiente
                <strong>{formatMoney(totals.pendingCents, state.currency)}</strong>
              </span>
            </div>
          </div>
        )}

        {state.closed &&
          totals.grandCents > 0 &&
          totals.pendingCents === 0 &&
          totals.unassignedCents === 0 && (
            <div className="all-paid-summary" role="status">
              <div className="all-paid-head">
                <IconCheck size={16} />
                <strong>¡Todos pagaron!</strong>
                <span>{formatMoney(totals.grandCents, state.currency)}</span>
              </div>
              <ul className="all-paid-list">
                {totals.perPerson
                  .filter((p) => p.totalCents > 0)
                  .sort((a, b) => b.totalCents - a.totalCents)
                  .map((p) => (
                    <li key={p.id}>
                      <span>{p.name}</span>
                      <strong>{formatMoney(p.totalCents, state.currency)}</strong>
                    </li>
                  ))}
              </ul>
            </div>
          )}
      </section>

      {(() => {
        // Payments are unlocked only when the mesa is closed AND every item
        // has been claimed (no "Sin reclamar" leftover).
        const paymentsOpen = state.closed && totals.unassignedCents === 0;
        const lockReason = !state.closed
          ? 'El host todavía no cerró la mesa'
          : totals.unassignedCents > 0
          ? 'Hay items sin reclamar — falta que alguien los tome'
          : undefined;

        return (
          <>
            {paymentsOpen && state.paymentMode !== 'cash' && state.paymentTarget && (
              <PaymentInfo
                mode={state.paymentMode}
                target={state.paymentTarget}
                amountCents={myTotal?.totalCents}
                note={`Repartija · ${state.title} · ${myParticipant?.name ?? ''}`}
              />
            )}

            {myTotal && participantId && myParticipant && (
              <PayBar
                totalCents={myTotal.totalCents}
                currency={state.currency}
                mode={state.paymentMode}
                target={state.paymentTarget}
                status={myParticipant.paymentStatus}
                onMark={(s) => markPayment(s)}
                note={`Repartija · ${state.title} · ${myParticipant.name}`}
                locked={!paymentsOpen}
                lockReason={lockReason}
              />
            )}
          </>
        );
      })()}

      {isHost && (
        <section className="card host-actions">
          {!state.closed ? (
            <button className="danger" onClick={() => setShowCloseConfirm(true)}>
              <IconLock size={18} />
              <span>Cerrar mesa</span>
            </button>
          ) : (
            <>
              <button className="secondary" onClick={reopen}>
                <IconUnlock size={18} />
                <span>Reabrir mesa</span>
              </button>
              <button className="secondary" onClick={() => navigate('/')}>
                <span>+ Nueva mesa</span>
              </button>
            </>
          )}
        </section>
      )}

      {showScan && (
        <ScanReceipt
          currency={state.currency}
          onConfirm={addManyFromScan}
          onClose={() => setShowScan(false)}
        />
      )}

      <ConfirmDialog
        open={!!itemToDelete}
        title="¿Eliminar item?"
        message={itemToDelete ? `"${itemToDelete.name}" se va a borrar de la mesa.` : undefined}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        danger
        onConfirm={() => itemToDelete && removeItem(itemToDelete.id)}
        onCancel={() => setDeleteItemId(null)}
      />

      <ConfirmDialog
        open={showCloseConfirm}
        title={
          totals.unassignedCents > 0
            ? '⚠️ Hay items sin reclamar'
            : '¿Cerrar la mesa?'
        }
        message={
          totals.unassignedCents > 0
            ? `Quedan ${formatMoney(totals.unassignedCents, state.currency)} en items que nadie reclamó. Si cerrás ahora, ese monto queda sin asignar. ¿Cerrar igual?`
            : 'Una vez cerrada no se pueden agregar ni modificar items. Podés reabrirla después.'
        }
        confirmLabel="Cerrar mesa"
        cancelLabel={totals.unassignedCents > 0 ? 'Volver y repartir' : 'Cancelar'}
        danger
        onConfirm={closeSession}
        onCancel={() => setShowCloseConfirm(false)}
      />
    </main>
  );
}

function payStatusLabel(s: PaymentStatus, online: boolean): string {
  const base = online ? '● En línea' : '○ Desconectado';
  switch (s) {
    case 'paid': return `${base} · Pagó`;
    case 'intent_cash': return `${base} · Va a pagar en efectivo`;
    case 'intent_link': return `${base} · Abrió el link de pago`;
    default: return base;
  }
}

function payStatusShort(s: PaymentStatus): string {
  switch (s) {
    case 'paid': return 'Pagó';
    case 'intent_cash': return 'Efectivo';
    case 'intent_link': return 'Link';
    default: return 'Pendiente';
  }
}

function payStatusIcon(s: PaymentStatus): React.ReactNode {
  if (s === 'paid') return <IconCheck size={11} />;
  if (s === 'intent_cash') return <IconCash size={11} />;
  if (s === 'intent_link') return <IconLink size={11} />;
  return null;
}
