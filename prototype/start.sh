#!/usr/bin/env bash
# Встановлює залежності й запускає Pulsar (server + site).
# Usage:
#   ./start.sh
#   ./start.sh --db
#   ./start.sh --demo
#   ./start.sh --com COM11    # або /dev/ttyUSB0
#   ./start.sh --install-only

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVER="$ROOT/server"
SITE="$ROOT/site"
BRIDGE="$(cd "$ROOT/../site/prototype" && pwd)"

DB=0
DEMO=0
COM=""
INSTALL_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db) DB=1; shift ;;
    --demo) DEMO=1; shift ;;
    --com) COM="${2:-}"; shift 2 ;;
    --install-only) INSTALL_ONLY=1; shift ;;
    -h|--help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *) echo "Невідома опція: $1"; exit 1 ;;
  esac
done

need_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js не знайдено. Встановіть Node ≥ 18." >&2
    exit 1
  fi
  major="$(node -v | sed 's/^v//' | cut -d. -f1)"
  if [[ "$major" -lt 18 ]]; then
    echo "Потрібен Node ≥ 18 (зараз $(node -v))" >&2
    exit 1
  fi
  echo "Node $(node -v)"
}

npm_install() {
  local dir="$1" label="$2"
  echo
  echo "=== npm install · $label ==="
  (cd "$dir" && npm install)
}

start_bg() {
  local title="$1" dir="$2" cmd="$3"
  local log="$ROOT/.run-${title}.log"
  echo "[$title] → $log"
  (cd "$dir" && nohup bash -c "$cmd" >"$log" 2>&1 & echo $! >"$ROOT/.run-${title}.pid")
}

need_node
npm_install "$SERVER" "prototype/server"
[[ -f "$SITE/package.json" ]] && npm_install "$SITE" "prototype/site"
npm_install "$BRIDGE" "site/prototype (USB bridge)"

if [[ "$INSTALL_ONLY" -eq 1 ]]; then
  echo
  echo "Готово: лише встановлення пакетів."
  exit 0
fi

if [[ "$DB" -eq 1 ]]; then
  echo
  echo "=== MySQL (docker compose) ==="
  (cd "$SERVER" && npm run db:up) || echo "Попередження: db:up не вдався — RAM-режим."
fi

echo
echo "=== Запуск процесів ==="
start_bg "server" "$SERVER" "npm start"
sleep 1
start_bg "site" "$SITE" "npm start"

if [[ "$DEMO" -eq 1 ]]; then
  sleep 1
  start_bg "demo" "$SERVER" "npm run demo"
fi

if [[ -n "$COM" ]]; then
  sleep 1
  echo "USB bridge → $COM"
  start_bg "bridge" "$BRIDGE" "npm run bt -- $COM"
fi

cat <<EOF

────────────────────────────────────────
  PULSAR запущено

  Сайт екіпажу:     http://127.0.0.1:4200
  Панель сервера:   http://127.0.0.1:4100/panel
  Health:           http://127.0.0.1:4100/health

  Логи:             prototype/.run-*.log
  Зупинити:         kill \$(cat prototype/.run-*.pid)

  Реальний годинник:
    ./start.sh --com COM11
  Симуляція без заліза:
    ./start.sh --demo
────────────────────────────────────────
EOF
