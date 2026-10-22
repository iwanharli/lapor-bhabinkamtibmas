# 09 — Deployment Server Internal (tanpa Docker)

Sistem dipasang langsung di sistem operasi server. Komponen yang dibutuhkan hanya:

| Komponen | Paket | Fungsi |
|---|---|---|
| Node.js 22 LTS | NodeSource / paket OS | Menjalankan `lapor-api`, `lapor-worker`, `lapor-web` |
| PostgreSQL 16 + PostGIS 3.4 | Paket OS (PGDG) | Database, data spasial, antrean job (pg-boss) |
| Nginx | Paket OS | TLS, reverse proxy, rate limit |
| systemd | Bawaan OS | Menjalankan & menghidupkan ulang layanan |

Tidak diperlukan Docker, Redis, atau MinIO. File lampiran disimpan di disk server (`/var/lib/lapor/storage`).

## 1. Topologi jaringan

```
 HP Bhabin (4G/Wi-Fi)                         Server internal
        │                                    ┌──────────────────────────────────┐
        │  Opsi A: VPN klien di HP ─────────►│ Nginx :443 (TLS)                 │
        │                                    │   ├─ /api/v1 → lapor-api :3000    │
        │  Opsi B: Endpoint publik terbatas  │   └─ /       → lapor-web :3001    │
        └──► Firewall/WAF ──► DMZ ──────────►│ lapor-worker                     │
                                             │ PostgreSQL :5432 (localhost saja)│
 Browser pimpinan (LAN/VPN) ────────────────►│ /var/lib/lapor/storage           │
                                             └──────────────────────────────────┘
```

| Opsi | Kelebihan | Kekurangan |
|---|---|---|
| **A. VPN di HP** | Server tidak terekspos ke internet | Setiap HP perlu klien & akun VPN; sinyal lemah memperburuk koneksi; beban dukungan tinggi |
| **B. Endpoint publik terbatas** (direkomendasikan) | Paling andal untuk lapangan | Perlu WAF, rate limit, TLS kuat, dan hanya `/api/v1` mobile yang dibuka |

Untuk opsi B, hanya path API mobile (`/api/v1/auth`, `/sync`, `/reports`, `/attendances`) yang dibuka ke publik. Dashboard web dan endpoint admin hanya bisa diakses dari LAN/VPN.

## 2. Lingkungan

| Lingkungan | Tujuan | Data |
|---|---|---|
| `dev` | Pengembangan lokal (Postgres.app / PostgreSQL lokal) | Seed dummy |
| `staging` | Uji terima & uji lapangan | Data dummy / anonim |
| `prod` | Operasional | Data asli |

Disarankan staging & prod memakai versi OS dan paket yang sama.

## 3. Tata letak di server

```
/opt/lapor/
├── releases/2026.10.22-1/      # satu folder per rilis (backend/, web/, packages/)
├── releases/2026.10.29-1/
└── current -> releases/2026.10.29-1   # symlink rilis aktif
/etc/lapor/
├── api.env                     # rahasia & konfigurasi backend (0640 root:lapor)
└── web.env
/var/lib/lapor/storage/         # lampiran (0750 lapor:lapor)
/var/log/lapor/                 # log aplikasi (juga tersedia via journalctl)
```

Semua layanan berjalan sebagai user sistem `lapor` (tanpa shell, tanpa sudo).

## 4. Instalasi awal (Ubuntu Server 24.04)

Skrip lengkap: [`infra/scripts/install-ubuntu.sh`](../../infra/scripts/install-ubuntu.sh). Ringkasnya:

```bash
# Paket dasar
sudo apt install -y nginx postgresql-16 postgresql-16-postgis-3 curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt install -y nodejs

# User & folder
sudo useradd --system --home /opt/lapor --shell /usr/sbin/nologin lapor
sudo mkdir -p /opt/lapor/releases /etc/lapor /var/lib/lapor/storage /var/log/lapor
sudo chown -R lapor:lapor /opt/lapor /var/lib/lapor /var/log/lapor

# Database
sudo -u postgres psql -c "CREATE ROLE lapor LOGIN PASSWORD '<sandi-kuat>'"
sudo -u postgres psql -c "CREATE DATABASE lapor OWNER lapor"
sudo -u postgres psql -d lapor -c "CREATE EXTENSION postgis; CREATE EXTENSION pgcrypto;"

# Layanan
sudo cp infra/systemd/*.service /etc/systemd/system/
sudo cp infra/nginx/lapor.conf /etc/nginx/sites-available/ && sudo ln -s ../sites-available/lapor.conf /etc/nginx/sites-enabled/
sudo systemctl daemon-reload && sudo systemctl enable lapor-api lapor-worker lapor-web
```

PostgreSQL hanya mendengarkan `localhost` (`listen_addresses = 'localhost'`).

## 5. Layanan systemd

| Unit | Perintah | Catatan |
|---|---|---|
| `lapor-api.service` | `node backend/dist/main.js` | Bisa dijalankan 2 instance (`lapor-api@3000`, `lapor-api@3002`) di belakang Nginx untuk pembaruan tanpa jeda |
| `lapor-worker.service` | `node backend/dist/worker.js` | Memproses antrean pg-boss |
| `lapor-web.service` | `node web/.next/standalone/server.js` | Build Next.js mode `standalone` |

Contoh unit: [`infra/systemd/`](../../infra/systemd/). Semua unit memakai `Restart=always`, `EnvironmentFile=/etc/lapor/*.env`, dan pengerasan systemd (`NoNewPrivileges`, `ProtectSystem=strict`, `ReadWritePaths=/var/lib/lapor /var/log/lapor`).

## 6. Rilis

Skrip: [`infra/scripts/deploy.sh`](../../infra/scripts/deploy.sh).

1. CI (GitLab CI / Jenkins internal / GitHub Actions): lint → test → build → hasilkan arsip `lapor-<versi>.tar.gz` (berisi `backend/dist`, `backend/prisma`, `backend/node_modules` produksi, `web/.next/standalone`, `packages/`).
2. Salin arsip ke server, ekstrak ke `/opt/lapor/releases/<versi>`.
3. Jalankan migrasi: `npx prisma migrate deploy`.
4. Ganti symlink `current` ke rilis baru, lalu `systemctl restart lapor-api lapor-worker lapor-web`.
5. Smoke test: `curl -f https://<host>/api/v1/health`, lalu login dengan akun uji di staging.
6. Rollback: arahkan `current` ke rilis sebelumnya dan restart. Migrasi harus kompatibel mundur satu versi (pola *expand–contract*).

Simpan 5 rilis terakhir dan hapus yang lebih lama.

## 7. Nginx

Contoh lengkap: [`infra/nginx/lapor.conf`](../../infra/nginx/lapor.conf).

- TLS 1.2/1.3, HSTS, sertifikat dari CA internal atau publik (opsi B membutuhkan sertifikat publik agar dipercaya HP).
- `client_max_body_size 30m` untuk upload.
- Rate limit `limit_req` per IP pada `/api/v1/auth/login`.
- Blokir `/api/docs` dan `/api/v1/admin` dari luar LAN.
- Header keamanan: `X-Content-Type-Options`, `Content-Security-Policy` (untuk web), `Referrer-Policy`.
- Folder storage **tidak** disajikan langsung oleh Nginx. File diunduh lewat API yang memeriksa izin (opsional: `X-Accel-Redirect` agar Nginx yang mengirim file setelah API mengizinkan).

## 8. Backup & pemulihan

| Data | Metode | Jadwal | Retensi |
|---|---|---|---|
| PostgreSQL | pgBackRest (full mingguan + diff harian + WAL archive) | Kontinu | 30 hari + bulanan 12 bulan |
| Lampiran (`/var/lib/lapor/storage`) | `rsync` / `restic` ke server/NAS kedua | Tiap jam | Snapshot 30 hari |
| `/etc/lapor` | Arsip terenkripsi | Setiap perubahan | Permanen |

- Target pemulihan: RPO ≤ 15 menit (database), ≤ 1 jam (lampiran); RTO ≤ 4 jam.
- Uji restore ke staging setiap bulan, dengan hasil uji tercatat.
- Simpan backup di lokasi fisik berbeda dari server utama.

## 9. Monitoring & logging

| Aspek | Alat |
|---|---|
| Log | `journalctl -u lapor-api` (log JSON pino); opsional dikirim ke Loki/Graylog |
| Metrik | Prometheus + Grafana (node exporter, postgres exporter, `/metrics` aplikasi), opsional |
| Uptime | Uptime Kuma / cron `curl /api/v1/health` |
| Antrean | Halaman admin "Job gagal" (dari tabel pg-boss) |

Alert minimum: API down, error 5xx > 2%, disk storage > 80%, job antrean gagal > 50/jam, backup gagal, sertifikat kedaluwarsa < 14 hari.

## 10. Hardening server

- OS LTS (Ubuntu Server 24.04 / RHEL 9), update keamanan otomatis.
- SSH dengan kunci saja, tanpa login root, akses dari jump host.
- Firewall (`ufw`/`firewalld`): hanya 443 (dan 22 dari jump host) yang dibuka.
- PostgreSQL, `lapor-api`, `lapor-web` hanya mendengarkan `127.0.0.1`.
- Disk data dienkripsi (LUKS) bila kebijakan mengharuskan.
- Jam server disinkronkan NTP, karena validasi waktu laporan bergantung padanya.

## 11. Kapan menambah komponen

> Untuk tahap nasional, komponen di bawah bukan lagi opsional — lihat [12-skala-nasional §3](12-skala-nasional.md#3-arsitektur-target).

| Gejala | Tambahan |
|---|---|
| Antrean > ±100 ribu job/hari atau latensi job tinggi | Redis + BullMQ untuk antrean |
| Storage > kapasitas satu server / butuh replikasi file | MinIO (driver `STORAGE_DRIVER=s3`) |
| Beban API tinggi | Tambah instance `lapor-api` atau server aplikasi kedua di belakang Nginx |
| Ingin paket rilis seragam di banyak server | Docker / container (opsional) |
