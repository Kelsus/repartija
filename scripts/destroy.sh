#!/usr/bin/env bash
# Close any active cloudflared / ngrok tunnels and the dev server.
pkill -f "cloudflared tunnel" 2>/dev/null && echo "→ cloudflared stopped"
pkill -f "ngrok http" 2>/dev/null && echo "→ ngrok stopped"
pkill -f "tsx watch server/index.ts" 2>/dev/null && echo "→ server stopped"
pkill -f "vite" 2>/dev/null && echo "→ vite stopped"
echo "Done."
