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

port_pids() {
  lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
}

SERVER_PIDS="$(port_pids "$PORT")"
CLIENT_PIDS="$(port_pids "$CLIENT_PORT")"

if [[ -n "$SERVER_PIDS" && -n "$CLIENT_PIDS" ]]; then
  cat <<ALREADY
────────────────────────────────────────────
  Repartija ya está corriendo
  Frontend: http://${LAN_IP}:${CLIENT_PORT}
  Backend:  http://${LAN_IP}:${PORT}
────────────────────────────────────────────
  PIDs: server=${SERVER_PIDS//$'\n'/,} client=${CLIENT_PIDS//$'\n'/,}
  Para reiniciarlo:    ./run.sh --restart
  Para dejar de compartirlo:  ./run.sh --stop
────────────────────────────────────────────
ALREADY
  exit 0
fi

if [[ "${1:-}" == "--stop" ]]; then
  PIDS="$SERVER_PIDS $CLIENT_PIDS"
  PIDS="$(echo $PIDS | xargs)"
  if [[ -z "$PIDS" ]]; then
    echo "Nada que parar en :${PORT} ni :${CLIENT_PORT}."
    exit 0
  fi
  echo "→ Matando procesos: $PIDS"
  kill $PIDS 2>/dev/null || true
  exit 0
fi

if [[ "${1:-}" == "--restart" ]]; then
  PIDS="$SERVER_PIDS $CLIENT_PIDS"
  PIDS="$(echo $PIDS | xargs)"
  if [[ -n "$PIDS" ]]; then
    echo "→ Matando procesos previos: $PIDS"
    kill $PIDS 2>/dev/null || true
    # Esperar a que los puertos se liberen
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      if [[ -z "$(port_pids "$PORT")" && -z "$(port_pids "$CLIENT_PORT")" ]]; then
        break
      fi
      sleep 0.5
    done
  fi
elif [[ -n "$SERVER_PIDS" || -n "$CLIENT_PIDS" ]]; then
  echo "Hay un proceso previo ocupando solo uno de los puertos Repartija:"
  [[ -n "$SERVER_PIDS" ]] && echo "  :${PORT} (backend) → PID ${SERVER_PIDS//$'\n'/,}"
  [[ -n "$CLIENT_PIDS" ]] && echo "  :${CLIENT_PORT} (frontend) → PID ${CLIENT_PIDS//$'\n'/,}"
  echo ""
  echo "Reiniciá todo limpio:  ./run.sh --restart"
  echo "O matalo y relanzá:    ./run.sh --stop && ./run.sh"
  exit 1
fi

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
