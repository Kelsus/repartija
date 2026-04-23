# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Repartija** — real-time, multi-user, QR-based bill splitter. Hackathon MVP, in-memory only (server restart = data loss).

Stack: Node + Express + Socket.io backend, Vite + React + TS + wouter frontend, single shared `socket.io-client` instance, no database.

## Commands

```bash
bash scripts/setup.sh              # one-time install (pnpm/npm)
npm run dev                        # backend (:3001) + frontend (:5173) concurrently
npm run dev:server                 # server only
npm run dev:client                 # vite only
npm run build                      # vite build → dist/
npm run smoke                      # playwright tests (requires dev server running)
npx playwright test tests/parser.spec.ts            # single file
npx playwright test tests/parser.spec.ts -g "name"  # single test by name
./scripts/deploy.sh                # cloudflared tunnel (ngrok fallback)
./scripts/destroy.sh               # close tunnels + stop dev
```

Vite proxies `/api` and `/socket.io` to `:3001`. Playwright runs against `http://localhost:5173` and assumes the dev server is already up — it does not start its own server.

## Environment

- `PORT` — backend (default 3001)
- `CLIENT_PORT` — frontend port for QR URL (default 5173)
- `PUBLIC_URL` — overrides QR target; otherwise server auto-detects LAN IP via `os.networkInterfaces()` (prefers `en0`/`en1`/`wlan0`/`eth0`). Set this when exposing through a tunnel.

## Architecture

### Three-package layout, one tsconfig

`client/`, `server/`, and `shared/` are all compiled by the same root `tsconfig.json` with `moduleResolution: bundler` and `allowImportingTsExtensions`. The server imports types from `../shared/types.js` (`.js` extension required by node ESM resolution even though source is `.ts`); the client imports from `../../shared/types`. **Don't break this — types must stay in `shared/` so client and server agree on the wire format.**

### Server is the single source of truth

`server/index.ts` holds all sessions in an in-process `Map<string, StoredSession>`. Every mutation (item add/remove/claim, tip change, payment status, close/reopen) goes through a Socket.io handler that updates the map and then calls `broadcastState(code)`, which emits the **entire** `SessionState` to every socket in the room. Clients never patch — they replace state on each `session:state` event. This is what makes the realtime UX trivial; preserve it.

`StoredSession` extends the public `SessionState` with `hostToken` (never sent to clients) and `socketsByParticipant: Map<pid, Set<socketId>>` so that a participant is marked offline only when their **last** socket disconnects (one user can have multiple tabs).

Auth model: there is none. The `hostToken` returned at session creation is stashed in the host's `localStorage` (`repartija.host.<CODE>`); any socket that presents the matching token gets `isHost: true`. Whoever has the 6-char join code can join.

### Totals are computed client-side

`client/lib/totals.ts:computeTotals` is the canonical splitter. Rules that are easy to miss:

- **Offline participants are ignored**, both from the participant list in totals and from the divisor on items they had claimed. An item claimed only by offline people becomes "unassigned".
- Each item's line total is split equally among **online** claimers; per-person subtotals are rounded once at the end with `Math.round`.
- Tip is applied per-person on their rounded subtotal, then the grand-total tip line uses `Math.round(gross * tipRate)` independently — the two won't always sum to the same cent. This is intentional (per-person totals stay clean integers); don't try to "fix" it by recomputing.

`parsePrice` is locale-robust (handles `1.000,50`, `1,000.50`, plain `1000`, etc.) — used for both the manual add form and the OCR receipt parser. There are dedicated tests in `tests/price.spec.ts` and `tests/parser.spec.ts` covering this; extend those when changing parsing.

### Receipt OCR is client-side

`client/components/ScanReceipt.tsx` + `client/lib/receiptParser.ts` use `tesseract.js` (in the browser) plus heuristic line-skipping (totals, IVA, "gracias", addresses, etc.) to extract `{name, quantity, unitPriceCents}` rows. Parsed items are confirmed by the user, then sent in one `items:addMany` socket emit.

### Client routing

`wouter` with two routes: `/` (Home — create or join) and `/s/:CODE` (Session). Session.tsx handles a small state machine (`needName` → `joining` → `connected` | `error`) before rendering `SessionView`.

Per-session `localStorage` keys (`client/lib/storage.ts`):
- `repartija.name` — display name (global)
- `repartija.host.<CODE>` — host token (auth)
- `repartija.pid.<CODE>` — stable participant id so reconnects re-attach to the same participant
- `repartija.pay.target.v3` — saved alias/CBU/link for next session creation

### Socket events (server-defined, in `server/index.ts`)

`session:join` (with ack), `item:add`, `items:addMany`, `item:remove`, `item:claim`, `session:tip`, `session:rename`, `session:close`/`reopen` (host-token gated), `participant:payment`. Server emits `session:state` to broadcast. Add new events here and mirror types in `shared/types.ts`.

### Payment

Three modes (`PaymentMode`): `cash`, `host` (host's alias/link), `restaurant`. The actual payment happens out-of-band; the app only tracks `PaymentStatus` per participant (`pending` → `intent_cash` | `intent_link` → `paid`) for visibility. `client/lib/payLinks.ts` builds deep links for various wallets from a single identifier string.

## Tests

Playwright smoke tests in `tests/`. They drive real browsers against the running dev server and exercise multi-tab scenarios (host + guest in separate browser contexts). Pure logic (totals, parser, price) is also tested through Playwright by injecting modules — see `tests/parser.spec.ts` and `tests/price.spec.ts` for the pattern. `playwright.config.ts` runs single-worker, non-parallel because tests share a server with shared in-memory state.
