#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
echo "→ Installing dependencies..."
npm install
echo "→ Attempting to fetch real Kelsus logo (fallback exists if this fails)..."
curl -sfL -o client/public/kelsus-logo-remote.svg https://kelsus.com/wp-content/uploads/2023/logo.svg 2>/dev/null \
  || curl -sfL -o client/public/kelsus-logo-remote.png https://kelsus.com/wp-content/themes/kelsus/assets/images/logo.png 2>/dev/null \
  || echo "  (no remote logo found — keeping fallback SVG)"
echo "→ Done. Run: npm run dev"
