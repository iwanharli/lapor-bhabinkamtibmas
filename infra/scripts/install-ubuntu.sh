#!/usr/bin/env bash
# Instalasi awal server Ubuntu 24.04 untuk Lapor Bhabinkamtibmas (tanpa Docker).
# Jalankan sebagai root dari folder repositori: sudo bash infra/scripts/install-ubuntu.sh
set -euo pipefail

DB_PASSWORD="${DB_PASSWORD:?Set DB_PASSWORD terlebih dahulu}"

apt-get update
apt-get install -y curl ca-certificates gnupg nginx postgresql-common
/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
apt-get install -y postgresql-16 postgresql-16-postgis-3
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

id lapor >/dev/null 2>&1 || useradd --system --home /opt/lapor --shell /usr/sbin/nologin lapor
mkdir -p /opt/lapor/releases /etc/lapor /var/lib/lapor/storage /var/log/lapor
chown -R lapor:lapor /opt/lapor /var/lib/lapor /var/log/lapor
chmod 750 /var/lib/lapor/storage
chown root:lapor /etc/lapor && chmod 750 /etc/lapor

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lapor') THEN
    CREATE ROLE lapor LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END \$\$;
SQL
sudo -u postgres createdb -O lapor lapor 2>/dev/null || true
sudo -u postgres psql -d lapor -c "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pgcrypto;"

if [ ! -f /etc/lapor/api.env ]; then
  cat > /etc/lapor/api.env <<ENV
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://lapor:${DB_PASSWORD}@localhost:5432/lapor
JWT_ACCESS_SECRET=$(openssl rand -base64 48)
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL_MOBILE=2592000
JWT_REFRESH_TTL_WEB=43200
CORS_ORIGINS=https://lapor.example.internal
MIN_APP_VERSION=1.0.0
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=/var/lib/lapor/storage
ENV
  echo "API_URL=http://127.0.0.1:3000/api/v1" > /etc/lapor/web.env
  chown root:lapor /etc/lapor/*.env && chmod 640 /etc/lapor/*.env
fi

cp infra/systemd/*.service /etc/systemd/system/
cp infra/nginx/lapor.conf /etc/nginx/sites-available/lapor.conf
ln -sf /etc/nginx/sites-available/lapor.conf /etc/nginx/sites-enabled/lapor.conf
systemctl daemon-reload
systemctl enable lapor-api lapor-worker lapor-web

echo "Selesai. Lengkapi sertifikat TLS & server_name di /etc/nginx/sites-available/lapor.conf, lalu jalankan deploy.sh."
