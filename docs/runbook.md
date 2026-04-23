# Repartija — Runbook

Split the check without the drama. Real-time, multi-user, QR-based.

## Run locally

```bash
bash scripts/setup.sh    # one-time install
npm run dev              # front + back
```

Open <http://localhost:5173>. Backend runs on `:3001` (proxied by Vite).

### LAN mode (for demos on phones in the same Wi-Fi)

The server auto-detects your LAN IP on startup. The QR code embeds that URL so any phone on the same Wi-Fi can scan it and join. Example server output:

```
App:  http://localhost:5173   (also http://192.168.1.42:5173)
QR points to: http://192.168.1.42:5173
```

- macOS may prompt once to allow incoming connections — accept.
- To override the detected IP: `PUBLIC_URL=http://my-host:5173 npm run dev`
- To force a different client port: `CLIENT_PORT=5174 npm run dev`

## 2-minute demo script

1. **Host creates mesa** — Open <http://localhost:5173>, type your name, click **Crear mesa**.
2. **Show QR** — Click the small QR button (top-right). Either scan from a phone or copy the 6-char code.
3. **Add items** — "Pizza 1000", "Gaseosa 600", "Postre 800".
4. **Open two incognito windows** as guests:
   - Ana → visits `/s/CODE`, enters name, claims *Pizza* + *Postre*.
   - Pedro → joins, claims *Gaseosa*. Ana also claims *Gaseosa* → auto-split in half.
5. **Watch the magic** — every tab shows totals updating live. Ana = 1000+800+300. Pedro = 300.
6. **Tip toggle** — host taps 10% → all totals recalculate across devices.
7. **Close mesa** — host taps **Cerrar mesa**, everyone sees it's final.

## Stack

- Backend: Node + Express + Socket.io (in-memory sessions)
- Frontend: Vite + React + TS + wouter
- Real-time: WebSocket broadcast of full session state on every mutation
- QR: `qrcode` package, data URL embedded in response

## File layout

```
server/index.ts        Socket.io + REST
shared/types.ts        Session/Item/Participant types
client/pages/Home.tsx     Create / join
client/pages/Session.tsx  Main UI
client/components/Footer.tsx   Powered by Kelsus
```

## Deploy publicly

```bash
./scripts/deploy.sh      # cloudflared tunnel (recommended) → ngrok fallback
./scripts/destroy.sh     # close tunnels + stop dev server
```

`cloudflared` is recommended (no signup): `brew install cloudflared`.

## Environment

- `PORT` — backend port (default 3001)
- `PUBLIC_URL` — URL embedded in QR codes (default `http://localhost:5173`). Set to the cloudflared URL when exposing publicly.

## Known limitations (hackathon MVP)

- Sessions live in server memory — restart = data loss. Add SQLite in `server/` if you need persistence.
- No auth. Host token is stored in `localStorage` on the host device. Whoever has the code can join.
- No OCR (yet) — items are entered manually.
