#!/usr/bin/env bash
# Expose Repartija publicly via cloudflared (no signup). Falls back to ngrok if available.
set -e
cd "$(dirname "$0")/.."

PORT="${PORT:-5173}"

echo "→ Checking local server on :$PORT ..."
if ! curl -sf "http://localhost:$PORT" > /dev/null 2>&1; then
  echo "  Local server not running. Start it first: npm run dev"
  exit 1
fi

if command -v cloudflared > /dev/null 2>&1; then
  echo "→ Using cloudflared tunnel..."
  cloudflared tunnel --url "http://localhost:$PORT"
elif command -v ngrok > /dev/null 2>&1; then
  echo "→ Using ngrok..."
  ngrok http "$PORT"
else
  echo "  Neither cloudflared nor ngrok installed."
  echo "  macOS install:"
  echo "    brew install cloudflared   (recommended, no signup)"
  echo "    brew install ngrok         (requires free signup)"
  echo ""
  echo "  Or share on LAN: http://$(ipconfig getifaddr en0 2>/dev/null || echo '<your-ip>'):$PORT"
  exit 1
fi
