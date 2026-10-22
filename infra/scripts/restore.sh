#!/usr/bin/env bash
# Pulihkan database (+ opsional lampiran) dari backup.sh. Layanan dihentikan selama pemulihan.
#   sudo lapor-restore /var/backups/lapor/db/lapor-20261023-0200.dump [/var/backups/lapor/storage/20261023-0200]
# Database tujuan DIKOSONGKAN dulu (pg_restore --clean). Uji dulu di server cadangan sebelum di produksi.
set -euo pipefail

DUMP="${1:?Gunakan: restore.sh <berkas.dump> [folder-storage]}"
STORAGE_SNAPSHOT="${2:-}"
set -a; source "${LAPOR_ENV:-/etc/lapor/api.env}"; set +a

systemctl stop lapor-web lapor-worker lapor-api
pg_restore --clean --if-exists --no-owner --dbname="${DATABASE_URL%%\?*}" "$DUMP"
if [ -n "$STORAGE_SNAPSHOT" ]; then
  rsync -a --delete "$STORAGE_SNAPSHOT/" "${STORAGE_LOCAL_DIR:-/var/lib/lapor/storage}/"
  chown -R lapor:lapor "${STORAGE_LOCAL_DIR:-/var/lib/lapor/storage}"
fi
systemctl start lapor-api lapor-worker lapor-web
echo "Pemulihan selesai. Pastikan DATA_ENCRYPTION_KEYS sama dengan saat backup dibuat."
