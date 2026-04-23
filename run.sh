#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

CLIENT_PORT="${CLIENT_PORT:-5173}"
PORT="${PORT:-3001}"

detect_lan_ip() {
  for iface in en0 en1 en2 en3 wlan0 eth0; do
    local ip
    ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
    if [[ -n "$ip" ]]; then
      echo "$ip"
      return 0
    fi
  done
  ifconfig 2>/dev/null \
    | awk '/inet / && $2 != "127.0.0.1" && $2 !~ /^169\.254\./ { print $2; exit }'
}

LAN_IP="${LAN_IP:-$(detect_lan_ip)}"

if [[ -z "${LAN_IP:-}" ]]; then
  echo "No se pudo detectar una IP de la red local."
  echo "Pasá la IP a mano: LAN_IP=192.168.x.x ./run.sh"
  exit 1
fi

export PUBLIC_URL="http://${LAN_IP}:${CLIENT_PORT}"
export HOST="0.0.0.0"
export PORT CLIENT_PORT

# npm run dev usa `tsx --env-file=.env`; node aborta si el archivo no existe.
[[ -f .env ]] || touch .env

cat <<INFO
────────────────────────────────────────────
  Repartija en red local
  Frontend:  http://${LAN_IP}:${CLIENT_PORT}
  Backend:   http://${LAN_IP}:${PORT}
  QR target: ${PUBLIC_URL}
────────────────────────────────────────────
  Compartí la URL del frontend con los demás
  dispositivos de la misma red Wi-Fi.
  Ctrl+C para cortar.
────────────────────────────────────────────
INFO

exec npm run dev
