#!/usr/bin/env bash
# Pasang rilis baru dari arsip hasil CI: sudo bash deploy.sh lapor-2026.10.29-1.tar.gz
set -euo pipefail

ARCHIVE="${1:?Gunakan: deploy.sh <arsip-rilis.tar.gz>}"
VERSION="$(basename "$ARCHIVE" .tar.gz | sed 's/^lapor-//')"
DIR="/opt/lapor/releases/$VERSION"
PREV="$(readlink -f /opt/lapor/current || true)"

mkdir -p "$DIR"
tar -xzf "$ARCHIVE" -C "$DIR"
chown -R lapor:lapor "$DIR"

# Migrasi dijalankan sebelum layanan diganti; harus kompatibel dengan rilis sebelumnya.
sudo -u lapor bash -c "set -a; source /etc/lapor/api.env; cd '$DIR/backend' && npx prisma migrate deploy"

ln -sfn "$DIR" /opt/lapor/current
systemctl restart lapor-api lapor-worker lapor-web

sleep 5
if ! curl -fsS http://127.0.0.1:3000/api/v1/health >/dev/null; then
  echo "Health check gagal, rollback ke $PREV" >&2
  [ -n "$PREV" ] && ln -sfn "$PREV" /opt/lapor/current && systemctl restart lapor-api lapor-worker lapor-web
  exit 1
fi

# Simpan 5 rilis terakhir.
ls -1dt /opt/lapor/releases/* | tail -n +6 | xargs -r rm -rf
echo "Rilis $VERSION aktif."
