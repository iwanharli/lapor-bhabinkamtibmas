#!/usr/bin/env bash
# Pemantauan ringan (lapor-healthcheck.timer, tiap 5 menit): API & web hidup, database terjangkau, disk,
# umur backup terakhir, dan layanan systemd yang gagal. Peringatan dikirim HANYA saat status berubah
# (masalah baru / pulih) agar tidak membanjiri: ke journal (selalu) dan ke ALERT_WEBHOOK_URL bila diisi
# (JSON {"text": "..."} — cocok untuk webhook Mattermost/Rocket.Chat/Slack atau jembatan Telegram internal).
set -uo pipefail

set -a; source "${LAPOR_ENV:-/etc/lapor/api.env}"; set +a
STATE_DIR="${HEALTH_STATE_DIR:-/var/lib/lapor/health}"
DISK_MAX="${ALERT_DISK_PERCENT:-85}"
BACKUP_MAX_HOURS="${ALERT_BACKUP_HOURS:-26}"
API_URL_CHECK="${HEALTH_API_URL:-http://127.0.0.1:3000/api/v1/health}"
WEB_URL_CHECK="${HEALTH_WEB_URL:-http://127.0.0.1:3001/login}"
HOST="$(hostname)"
mkdir -p "$STATE_DIR"
NOW_DIR="$(mktemp -d)"; trap 'rm -rf "$NOW_DIR"' EXIT

# Masalah saat ini dicatat sebagai berkas <kode> berisi pesan, lalu dibandingkan dengan STATE_DIR (status sebelumnya).
fail() { printf '%s\n' "$2" > "$NOW_DIR/$1"; }

curl -fsS -m 10 "$API_URL_CHECK" >/dev/null 2>&1 || fail api "API tidak merespons ($API_URL_CHECK; termasuk koneksi database)"
curl -fsS -m 10 -o /dev/null "$WEB_URL_CHECK" 2>/dev/null || fail web "Web dashboard tidak merespons ($WEB_URL_CHECK)"

# Per sistem berkas (bukan per folder) agar satu disk tidak dilaporkan berkali-kali.
for dir in / "${STORAGE_LOCAL_DIR:-/var/lib/lapor/storage}" "${BACKUP_DIR:-/var/backups/lapor}"; do
  [ -d "$dir" ] && df -P "$dir" | awk 'NR==2 {gsub("%","",$5); print $6 "|" $5}'
done | sort -u | while IFS='|' read -r mount used; do
  [ "${used:-0}" -ge "$DISK_MAX" ] && fail "disk$(echo "$mount" | tr '/' '_')" "Disk $mount terpakai ${used}% (batas ${DISK_MAX}%)"
done

latest="$(ls -1t "${BACKUP_DIR:-/var/backups/lapor}"/db/lapor-*.dump 2>/dev/null | head -n 1)"
if [ -z "$latest" ]; then
  fail backup "Belum ada backup database di ${BACKUP_DIR:-/var/backups/lapor}/db"
else
  age=$(( ($(date +%s) - $(stat -c %Y "$latest" 2>/dev/null || stat -f %m "$latest")) / 3600 ))
  [ "$age" -ge "$BACKUP_MAX_HOURS" ] && fail backup "Backup database terakhir ${age} jam lalu (batas ${BACKUP_MAX_HOURS} jam): $(basename "$latest")"
fi

if command -v systemctl >/dev/null 2>&1; then
  for unit in lapor-api lapor-web lapor-worker lapor-backup; do
    systemctl is-failed --quiet "$unit" 2>/dev/null && fail "unit_$unit" "Layanan $unit berstatus gagal (journalctl -u $unit)"
  done
fi

notify() {
  logger -t lapor-health -- "$1" 2>/dev/null || true
  echo "$1"
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    local text="${1//\\/\\\\}"; text="${text//\"/\\\"}"
    curl -fsS -m 10 -H 'content-type: application/json' -d "{\"text\": \"$text\"}" "$ALERT_WEBHOOK_URL" >/dev/null 2>&1 || true
  fi
}

# Masalah baru → kirim & catat; masalah yang sama masih ada → diam.
count=0
for f in "$NOW_DIR"/*; do
  [ -e "$f" ] || continue
  count=$((count + 1)); id="$(basename "$f")"
  [ -f "$STATE_DIR/$id" ] || { notify "⚠️ [$HOST] Lapor Bhabinkamtibmas: $(cat "$f")"; cp "$f" "$STATE_DIR/$id"; }
done
# Tercatat sebelumnya tapi kini tidak bermasalah → pulih.
for f in "$STATE_DIR"/*; do
  [ -e "$f" ] || continue
  id="$(basename "$f")"
  [ -f "$NOW_DIR/$id" ] || { notify "✅ [$HOST] Lapor Bhabinkamtibmas pulih: $(cat "$f")"; rm -f "$f"; }
done
[ "$count" -eq 0 ]
