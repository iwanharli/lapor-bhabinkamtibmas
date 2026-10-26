#!/usr/bin/env bash
# Deploy satu commit ke server demo (PM2, folder rilis per commit + symlink), tanpa jeda layanan.
#
#   DEPLOY_HOST=root@203.0.113.10 infra/scripts/deploy-demo.sh [commit] [--only=api|web|all] [--apk=path/ke.apk]
#
# - Login SSH memakai kunci (disarankan). Bila server hanya menerima sandi, isi SSHPASS di lingkungan (bukan di repo) dan pasang sshpass.
# - Rilis dibangun di $DEPLOY_DIR/lapor-release-<commit>; node_modules disalin (hardlink) dari rilis aktif dan
#   `npm install` hanya dijalankan bila package-lock berubah.
# - Aktivasi: pindahkan symlink lalu `pm2 reload` (cluster, satu proses per giliran). Gagal cek kesehatan → symlink lama dipulihkan.
# - APK demo tidak ada di git: folder web/public/unduh di server selalu ikut disalin ke rilis web.
set -euo pipefail

HOST="${DEPLOY_HOST:?Isi DEPLOY_HOST, mis. root@203.0.113.10}"
DIR="${DEPLOY_DIR:-/var/www/_demo-project}"
APP="$DIR/lapor-bhabinkamtibmas"
REF="HEAD"; ONLY="all"; APK=""
for a in "$@"; do
  case "$a" in
    --only=*) ONLY="${a#--only=}" ;;
    --apk=*) APK="${a#--apk=}" ;;
    -*) echo "Opsi tidak dikenal: $a" >&2; exit 2 ;;
    *) REF="$a" ;;
  esac
done
[[ "$ONLY" =~ ^(api|web|all)$ ]] || { echo "--only harus api|web|all" >&2; exit 2; }

cd "$(git rev-parse --show-toplevel)"
SHA="$(git rev-parse --short "$REF")"
remote() { if [ -n "${SSHPASS:-}" ]; then sshpass -e ssh -o StrictHostKeyChecking=accept-new "$HOST" "$@"; else ssh "$HOST" "$@"; fi; }
upload() { if [ -n "${SSHPASS:-}" ]; then sshpass -e scp -q "$1" "$HOST:$2"; else scp -q "$1" "$HOST:$2"; fi; }

echo "→ Rilis $SHA ($ONLY) ke $HOST"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git archive --format=tar.gz -o "$TMP/rel.tgz" "$SHA"
upload "$TMP/rel.tgz" "/tmp/lapor-$SHA.tgz"
[ -n "$APK" ] && upload "$APK" "/tmp/lapor-bhabin-demo-$SHA.apk"

remote bash -s -- "$SHA" "$ONLY" "$DIR" "$APP" "${APK:+1}" <<'REMOTE'
set -euo pipefail
SHA="$1"; ONLY="$2"; DIR="$3"; APP="$4"; HAS_APK="${5:-}"
R="$DIR/lapor-release-$SHA/source"
mkdir -p "$R" && tar -xzf "/tmp/lapor-$SHA.tgz" -C "$R" && rm "/tmp/lapor-$SHA.tgz"
CUR_API="$(readlink -f "$APP/backend/dist")"; CUR_API="${CUR_API%/dist}"
CUR_WEB="$(readlink -f "$APP/web/.next/standalone")"; CUR_WEB="${CUR_WEB%/.next-release/standalone}"  # …/source/web

wait200() { local c=000; for _ in $(seq 1 40); do c=$(curl -s -o /dev/null -w '%{http_code}' "$1" || true); [ "$c" = 200 ] && break; sleep 1; done; echo "$c"; }

# Salin node_modules dari rilis aktif (hardlink, cepat); npm install hanya bila dependensi berubah.
deps() {
  local src="$1" dst="$2"
  cp -al "$(readlink -f "$src/node_modules")" "$dst/node_modules"
  if ! cmp -s "$src/package-lock.json" "$dst/package-lock.json"; then
    echo "  dependensi berubah: npm install"
    (cd "$dst" && npm install --no-audit --no-fund --loglevel=error)
  fi
}

if [ "$ONLY" != web ]; then
  echo "• build API"
  deps "$CUR_API" "$R/backend"
  ln -s "$APP/backend/.env" "$R/backend/.env"
  # Klien Prisma dibuat ulang hanya bila skema berubah; hapus dulu salinan hardlink agar rilis aktif tidak ikut tertimpa.
  if ! cmp -s "$CUR_API/prisma/schema.prisma" "$R/backend/prisma/schema.prisma"; then
    rm -rf "$R/backend/node_modules/.prisma" && (cd "$R/backend" && npx prisma generate >/dev/null)
  fi
  (cd "$R/backend" && npm run build >/dev/null)
  [ -f "$R/backend/dist/main.js" ] || { echo "BUILD API GAGAL"; exit 1; }
  echo "• migrasi database"
  (cd "$R/backend" && npx prisma migrate deploy | tail -1)
fi

if [ "$ONLY" != api ]; then
  echo "• build web"
  W="$R/web"
  cp -a "$CUR_WEB/.env.production.local" "$W/"
  deps "$CUR_WEB" "$W"
  (cd "$W" && NEXT_DIST_DIR=.next-release npm run build >/dev/null)
  ST="$W/.next-release/standalone"
  [ -f "$ST/server.js" ] || { echo "BUILD WEB GAGAL"; exit 1; }
  mkdir -p "$ST/.next-release" "$ST/.next"
  cp -r "$W/.next-release/static" "$ST/.next-release/static"; cp -r "$W/.next-release/static" "$ST/.next/static"
  cp -r "$W/public" "$ST/"
  if [ -n "$HAS_APK" ]; then
    cp -a "$APP/web/public/unduh/lapor-bhabin-demo.apk" "$DIR/lapor-release-$SHA/lapor-bhabin-demo-lama.apk"
    mv "/tmp/lapor-bhabin-demo-$SHA.apk" "$APP/web/public/unduh/lapor-bhabin-demo.apk"
  fi
  cp -r "$APP/web/public/unduh" "$ST/public/unduh"
fi

if [ "$ONLY" != web ]; then
  ln -sfn "$R/backend/dist" "$APP/backend/dist"; pm2 reload lapor-brs-api --update-env >/dev/null
  c=$(wait200 http://127.0.0.1:3610/api/v1/health)
  if [ "$c" != 200 ]; then ln -sfn "$CUR_API/dist" "$APP/backend/dist"; pm2 reload lapor-brs-api >/dev/null; echo "API GAGAL ($c) → dikembalikan ke $CUR_API"; exit 1; fi
  echo "✓ API aktif"
fi
if [ "$ONLY" != api ]; then
  ln -sfn "$ST" "$APP/web/.next/standalone"; pm2 reload lapor-brs-web --update-env >/dev/null
  c=$(wait200 http://127.0.0.1:3611/login)
  if [ "$c" != 200 ]; then ln -sfn "$CUR_WEB/.next-release/standalone" "$APP/web/.next/standalone"; pm2 reload lapor-brs-web >/dev/null; echo "WEB GAGAL ($c) → dikembalikan"; exit 1; fi
  echo "✓ Web aktif"
fi
REMOTE
echo "✓ Rilis $SHA selesai"
