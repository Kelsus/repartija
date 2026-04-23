# Repartija

> **Equipo 11 — Repartija**
> Martín · Rodrigo · Hernán

**Dividir la cuenta sin drama.**

Uno en la mesa carga los ítems del ticket —a mano o con OCR— y genera un QR. Cada comensal entra desde su celu, toca lo que pidió (o lo comparte con quien corresponda) y ve **en vivo** cuánto le toca pagar. Cuando todos terminaron, se cierra la mesa y listo.

Sin planilla. Sin calculadora. Sin *"¿quién pidió la pizza?"* por WhatsApp al otro día.

---

Desarrollado como MVP hackathon por Kelsus.

## Que hace

- Crea una mesa con codigo corto y QR para sumarse rapido
- Sincroniza participantes e items en tiempo real con Socket.IO
- Permite repartir items entre varias personas
- Recalcula subtotal, propina y total en vivo
- Soporta pago en efectivo, al host o al restaurante
- Incluye OCR en cliente para sugerir items desde una foto del ticket

## Stack

- Frontend: Vite + React + TypeScript + Wouter
- Backend: Node.js + Express + Socket.IO
- UI: Tailwind + Radix UI
- OCR: `tesseract.js`
- Tests: Playwright

## Requisitos

- Node.js 18+
- npm

## Correr localmente

```bash
bash scripts/setup.sh
npm run dev
```

La app queda en `http://localhost:5173` y la API en `http://localhost:3001`.

Vite proxya `/api` y `/socket.io` al backend.

## Scripts

```bash
npm run dev         # frontend + backend
npm run dev:client  # solo frontend
npm run dev:server  # solo backend
npm run build       # build de frontend
npm run preview     # preview del build
npm run smoke       # tests Playwright (requiere dev server corriendo)
```

## Flujo de uso

1. Crear una mesa desde la pantalla principal.
2. Compartir el QR o el codigo de la sesion.
3. Hacer que cada participante entre con su nombre.
4. Agregar items manualmente o cargar sugerencias desde el ticket.
5. Marcar quien consume cada item.
6. Ajustar la propina y revisar el estado de pago.

## LAN y demos en celulares

El servidor detecta una IP local y genera el QR con una URL accesible desde otros dispositivos en la misma red Wi-Fi.

Si hace falta, se puede overridear:

```bash
PUBLIC_URL=http://mi-host:5173 npm run dev
CLIENT_PORT=5174 npm run dev
```

## Variables de entorno

- `PORT`: puerto del backend. Default `3001`.
- `CLIENT_PORT`: puerto del frontend usado para armar la URL del QR. Default `5173`.
- `PUBLIC_URL`: URL publica o LAN embebida en el QR.

## Deploy publico

Hay scripts incluidos para exponer la app temporalmente:

```bash
./scripts/deploy.sh
./scripts/destroy.sh
```

## Estructura

```text
client/   frontend React
server/   API + Socket.IO
shared/   tipos compartidos entre cliente y servidor
tests/    smoke tests y casos funcionales
docs/     notas operativas
```

## Limitaciones actuales

- Las sesiones viven en memoria; reiniciar el server borra el estado.
- No hay autenticacion fuerte.
- El host se identifica con un token guardado en `localStorage`.
- El OCR es heuristico y puede requerir correccion manual.

## Estado del proyecto

Repo: `Kelsus/repartija`

GitHub: <https://github.com/Kelsus/repartija>
