#!/usr/bin/env bash
# Menjalankan project di lokal; log API dan web tampil bersama, Ctrl+C menghentikan keduanya.
#
#   ./run.sh         backend + web
#   ./run.sh api     backend saja
#   ./run.sh web     web saja
#
# Port bisa diganti: API_PORT=3620 WEB_PORT=3621 ./run.sh
set -euo pipefail
cd "$(dirname "$0")"

MODE="${1:-all}"
API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-3001}"
case "$MODE" in
  all|api|web) ;;
  *) echo "Pemakaian: ./run.sh [api|web]" >&2; exit 2 ;;
esac

fail() { echo "✗ $1" >&2; exit 1; }
need_port() { if lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; then fail "Port $1 sudah dipakai. Hentikan prosesnya atau ganti port (lihat atas berkas ini)."; fi; }
need_deps() { [ -d "$1/node_modules" ] || (echo "• npm install di $1"; cd "$1" && npm install --no-audit --no-fund); }
# Beri awalan per baris agar log kedua proses bisa dibedakan.
tag() { awk -v t="$1" '{ print t " " $0; fflush() }'; }

prepare_api() {
  [ -f backend/.env ] || fail "backend/.env belum ada. Salin dari backend/.env.example lalu isi."
  need_port "$API_PORT"
  need_deps backend
  if command -v pg_isready >/dev/null && ! pg_isready -q; then fail "PostgreSQL belum berjalan."; fi
  echo "• migrasi database"
  (cd backend && npx prisma generate >/dev/null && npx prisma migrate deploy | tail -1)
  # Model pengenal wajah tidak ada di git.
  [ -d backend/models ] || (cd backend && npm run -s face:models)
}

prepare_web() {
  need_port "$WEB_PORT"
  need_deps web
}

[ "$MODE" = web ] || prepare_api
[ "$MODE" = api ] || prepare_web

trap 'trap - INT TERM EXIT; kill 0 2>/dev/null' INT TERM EXIT

if [ "$MODE" != web ]; then
  (cd backend && PORT="$API_PORT" npm run -s start:dev 2>&1 | tag "[api]") &
  echo "✓ API  http://localhost:$API_PORT/api/v1"
fi
if [ "$MODE" != api ]; then
  (cd web && API_URL="http://localhost:$API_PORT/api/v1" npx next dev --turbopack -p "$WEB_PORT" 2>&1 | tag "[web]") &
  echo "✓ Web  http://localhost:$WEB_PORT"
fi
wait
