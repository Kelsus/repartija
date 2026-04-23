import { IconCash, IconCheck, IconLock } from './Icon';
import { formatMoney } from '../lib/totals';
import type { PaymentMode, PaymentStatus, PaymentTarget } from '../../shared/types';

type Props = {
  totalCents: number;
  currency: string;
  mode: PaymentMode;
  target: PaymentTarget | null;
  status: PaymentStatus;
  onMark: (s: PaymentStatus) => void;
  note?: string;
  locked?: boolean;
  lockReason?: string;
};

export default function PayBar({
  totalCents, currency, status, onMark, locked, lockReason
}: Props) {
  if (totalCents <= 0 && status === 'pending') return null;

  const isPaid = status === 'paid';
  const intentCash = status === 'intent_cash';

  return (
    <div
      className={`paybar ${locked ? 'paybar-locked' : ''}`}
      role="region"
      aria-label="Acciones de pago"
    >
      <div className="paybar-amount">
        <span className="paybar-label">
          {isPaid ? 'Pagaste' : locked ? 'Te va a tocar' : 'Te toca'}
        </span>
        <strong data-testid="my-total">{formatMoney(totalCents, currency)}</strong>
      </div>

      {locked ? (
        <div className="paybar-lock">
          <IconLock size={16} />
          <span>{lockReason ?? 'Esperando a que se cierre la mesa'}</span>
        </div>
      ) : !isPaid ? (
        <div className="paybar-actions">
          <button
            className={`pay-btn cash ${intentCash ? 'on' : ''}`}
            onClick={() => onMark(intentCash ? 'pending' : 'intent_cash')}
          >
            <IconCash size={18} />
            <span>Efectivo</span>
          </button>
          <button className="pay-btn done" onClick={() => onMark('paid')}>
            <IconCheck size={18} />
            <span>Pagué</span>
          </button>
        </div>
      ) : (
        <div className="paybar-actions">
          <button className="pay-btn undo" onClick={() => onMark('pending')}>
            <span>Deshacer</span>
          </button>
        </div>
      )}
    </div>
  );
}
