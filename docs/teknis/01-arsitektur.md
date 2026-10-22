# 01 — Arsitektur Sistem

## 1. Gambaran umum

```
              ┌────────────────────────┐      ┌────────────────────────┐
              │ Aplikasi Mobile         │      │ Dashboard Web           │
              │ Flutter (Android/iOS)   │      │ Next.js                 │
              │ • SQLite terenkripsi    │      │ Verifikator, Pimpinan,  │
              │ • Antrean sinkron       │      │ Admin, Auditor          │
              │ • Kamera + GPS          │      │                         │
              └───────────┬────────────┘      └───────────┬────────────┘
                          │  HTTPS (REST/JSON, JWT)        │
                          ▼                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                SERVER INTERNAL (native: systemd + Nginx)                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Nginx — reverse proxy, TLS, rate limit, batas ukuran upload       │  │
│  └───────────────┬───────────────────────────────┬──────────────────┘  │
│                  ▼                               ▼                      │
│  ┌───────────────────────────┐     ┌───────────────────────────┐       │
│  │ api (NestJS)              │     │ web (Next.js server)      │       │
│  │ REST /api/v1              │     │ SSR dashboard             │       │
│  └──┬──────────┬─────────┬───┘     └───────────────────────────┘       │
│     │          │         │                                              │
│     ▼          ▼                                                        │
│  ┌──────────────────┐ ┌──────────────┐  ┌──────────────────────────┐   │
│  │ PostgreSQL       │ │ Disk server  │  │ worker (NestJS + pg-boss)│   │
│  │ + PostGIS        │◄┤ /var/lib/    │◄─┤ thumbnail, notifikasi,   │   │
│  │ + antrean pg-boss│ │ lapor/storage│  │ ekspor, agregasi         │   │
│  └──────────────────┘ └──────────────┘  └──────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                          │ (fase 5)
                          ▼
                 Command Center Baharkam (API read-only)
```

## 2. Komponen

| Komponen | Teknologi | Tanggung jawab |
|---|---|---|
| `mobile` | Flutter 3.x, Dart, Riverpod, Drift (SQLite + SQLCipher), Dio | Input laporan di lapangan, offline, kamera & GPS, absensi |
| `web` | Next.js 15 (App Router), React, TypeScript, Tailwind, shadcn/ui | Verifikasi, monitoring, peta, analitik, administrasi |
| `api` | NestJS 10, TypeScript, Prisma ORM | Logika bisnis, auth, RBAC, validasi skema form, penomoran |
| `worker` | NestJS + pg-boss (kode sama dengan `api`, proses terpisah) | Pembuatan thumbnail, kompres video, notifikasi, ekspor besar, agregasi harian |
| `postgres` | PostgreSQL 16+ + PostGIS 3.4+ | Data utama, data spasial, antrean job (pg-boss) |
| storage | Folder di disk server (driver `local`) | Foto, video, PDF; di luar web root, hanya diakses lewat API. Driver `s3` (MinIO) tersedia bila kelak dibutuhkan |
| `nginx` | Nginx | TLS, routing, proteksi dasar |

## 3. Aliran data utama

### 3.1 Membuat & mengirim laporan (mobile)
1. Bhabin memilih kategori. Aplikasi memuat skema form dari cache lokal.
2. Aplikasi mengambil GPS (akurasi + flag mock) dan memotret dengan kamera internal. Watermark ditambahkan di perangkat.
3. Data disimpan ke SQLite dengan `client_uuid` dan status lokal `DRAFT` / `QUEUED`.
4. Saat online, sync engine:
   1. `POST /reports` (metadata + data form) → server membalas `id` + `nomor`.
   2. `POST /reports/:id/attachments` per file (bisa diulang).
   3. `POST /reports/:id/submit` → status `SUBMITTED`.
5. Worker membuat thumbnail dan mengirim notifikasi ke verifikator (urgensi tinggi diprioritaskan).

### 3.2 Verifikasi (web)
1. Verifikator membuka daftar laporan `SUBMITTED` di wilayahnya.
2. Memeriksa detail, foto, dan posisi di peta.
3. Memilih *Setujui*, *Minta revisi* (wajib catatan), atau *Tolak* (wajib catatan).
4. Bhabin menerima notifikasi status pada sinkron berikutnya.

### 3.3 Analitik
- Ringkasan dashboard dihitung dari *materialized view* yang diperbarui worker tiap 15 menit.
- Tren harga dihitung dari tabel `report_items` (lihat [04-database](04-database.md)).

## 4. Prinsip desain

1. **Offline-first di mobile.** Semua aksi input berjalan tanpa jaringan.
2. **Server sebagai sumber kebenaran.** Nomor laporan, waktu terima, status, dan hak akses ditentukan server.
3. **Form berbasis skema.** Field kategori didefinisikan sebagai JSON versi-an, dirender oleh mobile & web, dan divalidasi di backend.
4. **Idempoten.** Semua operasi tulis dari mobile aman diulang (`client_uuid`, `Idempotency-Key`).
5. **Pembatasan wilayah di backend.** Klien tidak dipercaya untuk memfilter data.
6. **Semua aksi tercatat.** Audit log untuk setiap perubahan dan akses data sensitif.
7. **Sederhana untuk dioperasikan.** Server cukup berisi Node.js, PostgreSQL, dan Nginx, tanpa Docker, Redis, atau object storage terpisah. Komponen tambahan dipasang hanya bila skala menuntut.

## 5. Struktur repositori

```
lapor-bhabinkamtibmas/
├── docs/                 # dokumentasi (folder ini)
├── backend/              # NestJS: api + worker
│   ├── prisma/           # schema.prisma, migrasi, seed
│   └── src/
├── web/                  # Next.js dashboard
├── mobile/               # Flutter app
├── packages/
│   └── form-schemas/     # skema form JSON (sumber tunggal untuk seed)
└── infra/
    ├── systemd/          # unit lapor-api, lapor-worker, lapor-web
    ├── nginx/
    └── scripts/          # install, deploy, backup, restore
```

## 6. Kebutuhan server awal (estimasi pilot 1 Polda)

Asumsi: ±2.000 Bhabin, rata-rata 3 laporan/hari, 2 foto/laporan @ ±400 KB setelah kompresi.

| Sumber daya | Kebutuhan |
|---|---|
| CPU | 8 vCPU |
| RAM | 16–32 GB |
| Disk database | 100 GB SSD |
| Disk file | ±1 TB/tahun (2.000 × 3 × 2 × 400 KB × 365 ≈ 1,75 TB, dengan kompresi lebih lanjut ±1 TB) |
| Disk backup | ≥ 2× ukuran data, di mesin/lokasi terpisah |
| Jaringan | Endpoint HTTPS yang dapat dijangkau HP lapangan (lihat [09-deployment](09-deployment.md)) |
