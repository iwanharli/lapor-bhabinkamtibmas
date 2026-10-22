#!/usr/bin/env bash
# Backup harian: database (pg_dump format custom) + berkas lampiran/swafoto (snapshot rsync berbasis hardlink).
# Dipasang install-ubuntu.sh sebagai /usr/local/sbin/lapor-backup dan dijalankan lapor-backup.timer (02.00).
# Manual: sudo -u lapor lapor-backup
#
# PENTING: DATA_ENCRYPTION_KEYS TIDAK ikut dibackup di sini. Tanpa kunci itu NIK/No. KK & data kesehatan
# di backup tidak bisa dibuka. Simpan kunci terpisah (brankas/password manager instansi, minimal 2 salinan).
set -euo pipefail

set -a; source "${LAPOR_ENV:-/etc/lapor/api.env}"; set +a
DEST="${BACKUP_DIR:-/var/backups/lapor}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M)"
mkdir -p "$DEST/db" "$DEST/storage"

# 1. Database. Format custom: terkompresi & bisa dipulihkan per tabel.
DUMP="$DEST/db/lapor-$STAMP.dump"
pg_dump --format=custom --no-owner --dbname="${DATABASE_URL%%\?*}" --file="$DUMP.part"
pg_restore --list "$DUMP.part" >/dev/null   # pastikan arsip terbaca sebelum dianggap jadi
mv "$DUMP.part" "$DUMP"

# 2. Lampiran: snapshot per tanggal; berkas yang tidak berubah di-hardlink ke snapshot sebelumnya (hemat ruang).
SRC="${STORAGE_LOCAL_DIR:-/var/lib/lapor/storage}"
LAST="$(ls -1d "$DEST"/storage/*/ 2>/dev/null | tail -n 1 || true)"
rsync -a --delete ${LAST:+--link-dest="$LAST"} "$SRC/" "$DEST/storage/$STAMP/"

# 3. Retensi.
find "$DEST/db" -name 'lapor-*.dump' -mtime +"$KEEP_DAYS" -delete
find "$DEST/storage" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +

# 4. Salinan di luar server (opsional): BACKUP_REMOTE=user@host:/path di /etc/lapor/api.env.
if [ -n "${BACKUP_REMOTE:-}" ]; then
  rsync -a --delete "$DEST/" "$BACKUP_REMOTE/"
fi

echo "Backup $STAMP selesai: $(du -h "$DUMP" | cut -f1) database."
