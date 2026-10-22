# Lapor Bhabinkamtibmas

Aplikasi pelaporan terpadu Bhabinkamtibmas: aplikasi mobile Flutter untuk petugas lapangan, dashboard web Next.js, dan backend NestJS + PostgreSQL/PostGIS di server internal.

Dokumentasi: [docs/teknis/00-README.md](docs/teknis/00-README.md)

## Struktur

```
backend/                 NestJS API (Prisma, PostgreSQL + PostGIS)
web/                     Dashboard Next.js (port 3001)
mobile/                  Aplikasi Flutter (Android & iOS)
packages/form-schemas/   Skema form 7 kategori laporan + master komoditas
infra/                   Unit systemd, konfigurasi Nginx, skrip server
docs/                    Dokumentasi & dokumen sumber
```

## Menjalankan di lokal

Prasyarat: Node.js 22, PostgreSQL 16+ dengan PostGIS (mis. Postgres.app di macOS), Flutter 3.24+ (untuk mobile). Tidak memerlukan Docker.

```bash
# 1. Database (Postgres.app sudah menyertakan PostGIS)
createdb lapor_dev
#    lalu sesuaikan DATABASE_URL di backend/.env, mis. postgresql://<user>@localhost:5432/lapor_dev

# 2. Backend → http://localhost:3000/api/v1, Swagger di /api/docs
cd backend
cp .env.example .env          # sekali saja
npm install
npx prisma migrate dev
npx prisma db seed
npm run seed:demo              # ±250 laporan contoh (dev)
npm run seed:demo-attachments  # foto contoh untuk laporan (dev, disimpan di backend/storage)
npm run start:dev

# 3. Web → http://localhost:3001
cd ../web
cp .env.example .env.local    # sekali saja
npm install
npm run dev

# 4. Mobile: lihat mobile/README.md
```

### Akun uji (seed dev, sandi `Demo#12345`)

| NRP | Peran | Unit |
|---|---|---|
| 90000001 | Bhabinkamtibmas (mobile) | Polsek Contoh |
| 90000002 | Verifikator | Polsek Contoh |
| 90000003 | Pimpinan | Polres Contoh |
| 90000004 | Admin unit | Polres Contoh |
| 90000005 | Auditor | Polda Contoh |
| 00000001 | Superadmin | Mabes (sandi dari `SEED_SUPERADMIN_PASSWORD`, wajib diganti) |

## Test

```bash
cd backend && npm test                 # unit test (Jest)
cd web && npm run typecheck && npx eslint src e2e

# E2E (Playwright) — backend & web harus berjalan dengan data seed + seed:demo
cd web
npx playwright install chromium        # sekali saja (atau pakai Chrome terpasang: PW_CHANNEL=chrome)
E2E_BASE_URL=http://localhost:3001 npm run e2e
```

Untuk E2E lokal, longgarkan batas login di `backend/.env`: `LOGIN_RATE_LIMIT=100`.
CI (GitHub Actions, `.github/workflows/ci.yml`) menjalankan typecheck, lint, unit test, build, lalu E2E dengan PostgreSQL + PostGIS.

Batas wilayah contoh untuk 4 desa demo ada di `backend/prisma/demo/*.geojson` — impor lewat menu **Desa → Impor GeoJSON**.

## Status

**Fase 1 — Fondasi** (sedang berjalan): auth + RBAC + cakupan wilayah, pengguna/unit/desa, master komoditas, skema form, audit log, login & admin di web, login & beranda di mobile.

Berikutnya, fase 2: laporan 7 kategori, kamera + GPS + watermark, mode offline & sinkron, absensi.
