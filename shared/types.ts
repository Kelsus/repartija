export type PaymentStatus = 'pending' | 'intent_cash' | 'intent_link' | 'paid';

export type Participant = {
  id: string;
  name: string;
  isHost: boolean;
  online: boolean;
  paymentStatus: PaymentStatus;
};

export type PaymentMode = 'host' | 'restaurant' | 'cash';

export type PaymentTarget = {
  identifier: string;
  label: string;
};

export type Item = {
  id: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  claimerIds: string[];
  createdAt: number;
};

export type NewItemInput = {
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type SessionState = {
  code: string;
  title: string;
  currency: string;
  tipPercent: number;
  items: Item[];
  participants: Participant[];
  paymentMode: PaymentMode;
  paymentTarget: PaymentTarget | null;
  closed: boolean;
  createdAt: number;
};

export type Totals = Record<string, number>;

export type JoinPayload = {
  code: string;
  name: string;
  participantId?: string;
  hostToken?: string;
};

export type JoinAck =
  | { ok: true; state: SessionState; participantId: string; isHost: boolean }
  | { ok: false; error: string };
