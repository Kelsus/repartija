import express from 'express';
import cors from 'cors';
import http from 'node:http';
import os from 'node:os';
import { Server as SocketIOServer } from 'socket.io';
import QRCode from 'qrcode';
import { customAlphabet, nanoid } from 'nanoid';
import { GoogleGenAI } from '@google/genai';
import type {
  Item,
  JoinAck,
  JoinPayload,
  NewItemInput,
  Participant,
  PaymentMode,
  PaymentStatus,
  PaymentTarget,
  SessionState
} from '../shared/types.js';

// no longer needed — platform is chosen by each guest at pay time
export {};

function detectLanIP(): string {
  const nets = os.networkInterfaces();
  const preferred = ['en0', 'en1', 'wlan0', 'eth0'];
  const candidates: { name: string; addr: string }[] = [];
  for (const [name, infos] of Object.entries(nets)) {
    if (!infos) continue;
    for (const info of infos) {
      if (info.family !== 'IPv4' || info.internal) continue;
      candidates.push({ name, addr: info.address });
    }
  }
  for (const p of preferred) {
    const match = candidates.find((c) => c.name === p);
    if (match) return match.addr;
  }
  return candidates[0]?.addr ?? 'localhost';
}

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_PORT = Number(process.env.CLIENT_PORT ?? 5173);
const LAN_IP = detectLanIP();
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://${LAN_IP}:${CLIENT_PORT}`;

const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

type StoredSession = SessionState & {
  hostToken: string;
  socketsByParticipant: Map<string, Set<string>>;
};

const sessions = new Map<string, StoredSession>();

function toPublicState(s: StoredSession): SessionState {
  return {
    code: s.code,
    title: s.title,
    currency: s.currency,
    tipPercent: s.tipPercent,
    items: s.items,
    participants: s.participants,
    paymentMode: s.paymentMode,
    paymentTarget: s.paymentTarget,
    closed: s.closed,
    createdAt: s.createdAt
  };
}

function sanitizePaymentTarget(t: unknown): PaymentTarget | null {
  if (!t || typeof t !== 'object') return null;
  const o = t as Record<string, unknown>;
  const identifier = (o.identifier ?? '').toString().trim().slice(0, 200);
  if (!identifier) return null;
  return {
    identifier,
    label: (o.label ?? '').toString().trim().slice(0, 60)
  };
}

function sanitizePaymentMode(m: unknown): PaymentMode {
  return m === 'restaurant' || m === 'host' || m === 'cash' ? m : 'cash';
}

function getSession(code: string): StoredSession | undefined {
  return sessions.get(code.toUpperCase());
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '12mb' }));

const genai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, sessions: sessions.size });
});

app.post('/api/receipts/parse', async (req, res) => {
  if (!genai) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });
  const { imageBase64, mimeType } = (req.body ?? {}) as {
    imageBase64?: string;
    mimeType?: string;
  };
  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: 'imageBase64 and mimeType are required' });
  }
  if (!/^image\/(png|jpe?g|webp|heic|heif)$/i.test(mimeType)) {
    return res.status(400).json({ error: 'unsupported mime type' });
  }

  try {
    const result = await genai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [
        { inlineData: { mimeType, data: imageBase64 } },
        {
          text:
            'Extract line items AND the currency from this restaurant/store receipt. ' +
            'It may be in Spanish, Portuguese, or English. Return ONLY a JSON object: ' +
            '{"currency":"<ISO 4217 code>","items":[{"name":string,"quantity":integer>=1,"unitPriceCents":integer>=0,"totalPriceCents":integer>=0}]}. ' +
            'currency MUST be the ISO 4217 3-letter uppercase code that matches the receipt ' +
            '(e.g. ARS, USD, EUR, BRL, CLP, MXN, COP, PEN, UYU, GBP). Infer from currency symbols ' +
            '(US$ / U$S → USD, R$ → BRL, € → EUR, £ → GBP, $ alone on a Spanish receipt usually ARS, ' +
            'country/address hints, or language). If truly unknown, use "XXX". ' +
            'unitPriceCents is the UNIT price in minor units (cents), not the line total. ' +
            'Skip subtotals, taxes (IVA), tips (propina), totals, discounts, addresses, ' +
            'phone numbers, thank-you lines, dates, and cashier info. ' +
            'If you cannot read the receipt, return {"currency": string,"items":[]}.'
        }
      ],
      config: { responseMimeType: 'application/json', temperature: 0 }
    });

    const text = result.text ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'model returned invalid JSON', raw: text });
    }

    const parsedObj =
      parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    const rawItems = Array.isArray(parsedObj.items) ? (parsedObj.items as unknown[]) : [];
    const items = rawItems
      .map((it) => {
        const o = (it ?? {}) as Record<string, unknown>;
        const name = (o.name ?? '').toString().trim().slice(0, 80);
        const quantity = Math.max(1, Math.min(99, Number(o.quantity) || 1));
        const unitPriceCents = Math.max(0, Math.round(Number(o.unitPriceCents) || 0));
        return { name, quantity, unitPriceCents };
      })
      .filter((it) => it.name.length > 0);

    const rawCurrency = (parsedObj.currency ?? '').toString().trim().toUpperCase();
    const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : 'XXX';

    res.json({ items, currency });
  } catch (err) {
    console.error('[receipts/parse]', err);
    res.status(500).json({ error: (err as Error).message ?? 'gemini call failed' });
  }
});

app.post('/api/sessions', async (req, res) => {
  const title = (req.body?.title ?? 'Mesa sin nombre').toString().slice(0, 80);
  const currency = (req.body?.currency ?? 'ARS').toString().slice(0, 6);
  const paymentMode = sanitizePaymentMode(req.body?.paymentMode);
  const paymentTarget =
    paymentMode === 'cash' ? null : sanitizePaymentTarget(req.body?.paymentTarget);

  let code = makeCode();
  while (sessions.has(code)) code = makeCode();

  const hostToken = nanoid(24);
  const session: StoredSession = {
    code,
    title,
    currency,
    tipPercent: 0,
    items: [],
    participants: [],
    paymentMode: paymentTarget ? paymentMode : 'cash',
    paymentTarget,
    closed: false,
    createdAt: Date.now(),
    hostToken,
    socketsByParticipant: new Map()
  };
  sessions.set(code, session);

  const joinUrl = `${PUBLIC_URL}/s/${code}`;
  const qrDataUrl = await QRCode.toDataURL(joinUrl, {
    margin: 1,
    width: 320,
    color: { dark: '#0f172a', light: '#ffffff' }
  });

  res.json({ code, hostToken, joinUrl, qrDataUrl });
});

app.get('/api/sessions/:code', (req, res) => {
  const s = getSession(req.params.code);
  if (!s) return res.status(404).json({ error: 'not found' });
  res.json(toPublicState(s));
});

app.get('/api/sessions/:code/qr', async (req, res) => {
  const s = getSession(req.params.code);
  if (!s) return res.status(404).json({ error: 'not found' });
  const joinUrl = `${PUBLIC_URL}/s/${s.code}`;
  const qrDataUrl = await QRCode.toDataURL(joinUrl, {
    margin: 1,
    width: 320,
    color: { dark: '#0f172a', light: '#ffffff' }
  });
  res.json({ joinUrl, qrDataUrl });
});

const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });

function roomName(code: string) {
  return `session:${code}`;
}

function broadcastState(code: string) {
  const s = getSession(code);
  if (!s) return;
  io.to(roomName(code)).emit('session:state', toPublicState(s));
}

io.on('connection', (socket) => {
  let joinedCode: string | null = null;
  let participantId: string | null = null;

  socket.on('session:join', (payload: JoinPayload, ack?: (r: JoinAck) => void) => {
    const s = getSession(payload.code);
    if (!s) {
      ack?.({ ok: false, error: 'Sesión no encontrada' });
      return;
    }
    if (s.closed) {
      ack?.({ ok: false, error: 'Sesión cerrada' });
      return;
    }

    const name = (payload.name ?? '').toString().trim().slice(0, 40) || 'Invitado';
    const isHost = Boolean(payload.hostToken && payload.hostToken === s.hostToken);

    let pid = payload.participantId;
    let existing = pid ? s.participants.find((p) => p.id === pid) : undefined;

    // Duplicate-name check: case-insensitive match against someone else ONLINE with a different pid.
    const clashedOnline = s.participants.find(
      (p) => p.online && p.id !== pid && p.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (clashedOnline) {
      ack?.({ ok: false, error: `Ya hay alguien con el nombre "${name}" en la mesa. Elegí otro.` });
      return;
    }

    if (!existing) {
      if (!pid) pid = nanoid(12);
      const participant: Participant = {
        id: pid, name, isHost, online: true, paymentStatus: 'pending'
      };
      s.participants.push(participant);
      existing = participant;
    } else {
      existing.name = name;
      existing.online = true;
      if (isHost) existing.isHost = true;
    }

    participantId = existing.id;
    joinedCode = s.code;

    const set = s.socketsByParticipant.get(existing.id) ?? new Set();
    set.add(socket.id);
    s.socketsByParticipant.set(existing.id, set);

    socket.join(roomName(s.code));
    ack?.({ ok: true, state: toPublicState(s), participantId: existing.id, isHost: existing.isHost });
    broadcastState(s.code);
  });

  function buildItem(input: NewItemInput): Item | null {
    const name = (input.name ?? '').toString().trim().slice(0, 60);
    if (!name) return null;
    const quantity = Math.max(1, Math.min(99, Math.round(Number(input.quantity) || 1)));
    const unitPriceCents = Math.max(0, Math.round(Number(input.unitPriceCents) || 0));
    return {
      id: nanoid(10),
      name,
      quantity,
      unitPriceCents,
      claimerIds: [],
      createdAt: Date.now()
    };
  }

  socket.on(
    'item:add',
    (
      payload: { code: string } & NewItemInput,
      ack?: (r: { ok: boolean; error?: string; itemId?: string }) => void
    ) => {
      const s = getSession(payload.code);
      if (!s || s.closed) return ack?.({ ok: false, error: 'Sesión inválida' });
      const item = buildItem(payload);
      if (!item) return ack?.({ ok: false, error: 'Nombre vacío' });
      s.items.push(item);
      ack?.({ ok: true, itemId: item.id });
      broadcastState(s.code);
    }
  );

  socket.on(
    'items:addMany',
    (
      payload: { code: string; items: NewItemInput[] },
      ack?: (r: { ok: boolean; added?: number; error?: string }) => void
    ) => {
      const s = getSession(payload.code);
      if (!s || s.closed) return ack?.({ ok: false, error: 'Sesión inválida' });
      if (!Array.isArray(payload.items)) return ack?.({ ok: false, error: 'items inválido' });
      let added = 0;
      for (const raw of payload.items.slice(0, 50)) {
        const item = buildItem(raw);
        if (item) {
          s.items.push(item);
          added++;
        }
      }
      ack?.({ ok: true, added });
      broadcastState(s.code);
    }
  );

  socket.on(
    'item:remove',
    (payload: { code: string; itemId: string }, ack?: (r: { ok: boolean }) => void) => {
      const s = getSession(payload.code);
      if (!s || s.closed) return ack?.({ ok: false });
      s.items = s.items.filter((i) => i.id !== payload.itemId);
      ack?.({ ok: true });
      broadcastState(s.code);
    }
  );

  socket.on(
    'item:claim',
    (
      payload: { code: string; itemId: string; participantId: string; claim: boolean },
      ack?: (r: { ok: boolean }) => void
    ) => {
      const s = getSession(payload.code);
      if (!s || s.closed) return ack?.({ ok: false });
      const item = s.items.find((i) => i.id === payload.itemId);
      if (!item) return ack?.({ ok: false });
      const pid = payload.participantId;
      const has = item.claimerIds.includes(pid);
      if (payload.claim && !has) item.claimerIds.push(pid);
      if (!payload.claim && has) item.claimerIds = item.claimerIds.filter((x) => x !== pid);
      ack?.({ ok: true });
      broadcastState(s.code);
    }
  );

  socket.on(
    'session:tip',
    (payload: { code: string; percent: number }, ack?: (r: { ok: boolean }) => void) => {
      const s = getSession(payload.code);
      if (!s || s.closed) return ack?.({ ok: false });
      const p = Math.max(0, Math.min(100, Math.round(Number(payload.percent) || 0)));
      s.tipPercent = p;
      ack?.({ ok: true });
      broadcastState(s.code);
    }
  );

  socket.on(
    'session:rename',
    (payload: { code: string; title: string }, ack?: (r: { ok: boolean }) => void) => {
      const s = getSession(payload.code);
      if (!s || s.closed) return ack?.({ ok: false });
      s.title = (payload.title ?? '').toString().slice(0, 80) || s.title;
      ack?.({ ok: true });
      broadcastState(s.code);
    }
  );

  socket.on(
    'session:currency',
    (
      payload: { code: string; hostToken: string; currency: string },
      ack?: (r: { ok: boolean; error?: string }) => void
    ) => {
      const s = getSession(payload.code);
      if (!s) return ack?.({ ok: false, error: 'no existe' });
      if (s.hostToken !== payload.hostToken) return ack?.({ ok: false, error: 'solo host' });
      const code = (payload.currency ?? '').toString().trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) return ack?.({ ok: false, error: 'currency inválida' });
      s.currency = code;
      ack?.({ ok: true });
      broadcastState(s.code);
    }
  );

  socket.on(
    'session:close',
    (payload: { code: string; hostToken: string }, ack?: (r: { ok: boolean; error?: string }) => void) => {
      const s = getSession(payload.code);
      if (!s) return ack?.({ ok: false, error: 'no existe' });
      if (s.hostToken !== payload.hostToken) return ack?.({ ok: false, error: 'solo host' });
      s.closed = true;
      ack?.({ ok: true });
      broadcastState(s.code);
    }
  );

  socket.on(
    'session:reopen',
    (payload: { code: string; hostToken: string }, ack?: (r: { ok: boolean; error?: string }) => void) => {
      const s = getSession(payload.code);
      if (!s) return ack?.({ ok: false, error: 'no existe' });
      if (s.hostToken !== payload.hostToken) return ack?.({ ok: false, error: 'solo host' });
      s.closed = false;
      ack?.({ ok: true });
      broadcastState(s.code);
    }
  );

  socket.on(
    'participant:payment',
    (
      payload: { code: string; participantId: string; status: PaymentStatus },
      ack?: (r: { ok: boolean; error?: string }) => void
    ) => {
      const s = getSession(payload.code);
      if (!s) return ack?.({ ok: false, error: 'no existe' });
      const p = s.participants.find((x) => x.id === payload.participantId);
      if (!p) return ack?.({ ok: false, error: 'no participant' });
      const allowed: PaymentStatus[] = ['pending', 'intent_cash', 'intent_link', 'paid'];
      if (!allowed.includes(payload.status)) return ack?.({ ok: false, error: 'status inválido' });
      p.paymentStatus = payload.status;
      ack?.({ ok: true });
      broadcastState(s.code);
    }
  );

  socket.on('disconnect', () => {
    if (!joinedCode || !participantId) return;
    const s = getSession(joinedCode);
    if (!s) return;
    const set = s.socketsByParticipant.get(participantId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        s.socketsByParticipant.delete(participantId);
        const p = s.participants.find((p) => p.id === participantId);
        if (p) p.online = false;
      }
    }
    broadcastState(joinedCode);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🍽  Repartija server`);
  console.log(`  API:  http://localhost:${PORT}   (also http://${LAN_IP}:${PORT})`);
  console.log(`  App:  http://localhost:${CLIENT_PORT}   (also http://${LAN_IP}:${CLIENT_PORT})`);
  console.log(`  QR points to: ${PUBLIC_URL}\n`);
});
