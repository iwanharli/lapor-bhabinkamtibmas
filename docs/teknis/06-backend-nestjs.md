# 06 — Backend (NestJS)

## 1. Stack

| Kebutuhan | Pilihan |
|---|---|
| Runtime | Node.js 22 LTS |
| Framework | NestJS 10 |
| ORM | Prisma (+ SQL mentah untuk PostGIS) |
| Validasi DTO | `class-validator` / Zod (`nestjs-zod`) |
| Validasi skema form | Validator internal yang membaca `form_schemas` (dibangun di atas Zod) |
| Auth | `@nestjs/jwt`, `argon2` |
| Antrean | pg-boss (tabel antrean di PostgreSQL) |
| Storage | `StorageService` dengan driver `local` (disk, default) dan `s3` (opsional, `@aws-sdk/client-s3`) |
| Gambar | `sharp` (thumbnail, verifikasi format) |
| Log | `pino` (JSON) |
| Dokumentasi API | `@nestjs/swagger` |
| Test | Jest + Supertest + database PostgreSQL uji |

## 2. Struktur modul

```
backend/src/
├── main.ts                    # bootstrap api
├── worker.ts                  # bootstrap worker (handler pg-boss)
├── app.module.ts
├── common/
│   ├── guards/                # JwtAuthGuard, RolesGuard, ScopeGuard
│   ├── decorators/            # @Roles, @CurrentUser, @Scope
│   ├── filters/               # format error standar
│   ├── interceptors/          # audit, logging, idempotency
│   └── crypto/                # SensitiveDataService (AES-GCM, HMAC)
├── config/                    # validasi env
├── prisma/                    # PrismaService
└── modules/
    ├── auth/                  # login, refresh, logout, perangkat
    ├── users/
    ├── units/                 # hierarki + cache unit turunan
    ├── villages/              # desa, geometri, uji titik-dalam-poligon
    ├── master/                # komoditas
    ├── form-schemas/          # CRUD skema, validator
    ├── reports/               # laporan, transisi status, penomoran
    ├── attachments/           # unggah, presigned URL
    ├── attendances/
    ├── sync/                  # endpoint delta untuk mobile
    ├── analytics/
    ├── exports/
    ├── notifications/         # push (FCM/APNs atau push internal)
    ├── audit/
    └── integration/           # API Command Center
```

## 3. Alur layanan penting

### 3.1 `ReportsService.submit(id, user)`
1. Ambil laporan dengan `FOR UPDATE`. Pastikan pemilik = user dan status ∈ {DRAFT, NEEDS_REVISION}.
2. Validasi `data` terhadap `form_schemas(category, schema_version)`.
3. Periksa jumlah lampiran per `fieldKey` sesuai `min`/`max`.
4. Hitung `inside_village` (PostGIS) dan `priority` (dari `rules` skema).
5. Untuk `HARGA_PANGAN`: tulis ulang `report_items` dari `data.items`.
6. Ubah status (`SUBMITTED` atau `APPROVED` jika `auto_approve`), tulis `report_status_history` dan `audit_logs`, semuanya dalam satu transaksi.
7. Setelah commit: enqueue `notify.report-submitted` (prioritas tinggi jika `priority`).

### 3.2 Penomoran
```sql
INSERT INTO report_counters (unit_id, category, period, last_no) VALUES ($1,$2,$3,1)
ON CONFLICT (unit_id, category, period) DO UPDATE SET last_no = report_counters.last_no + 1
RETURNING last_no;
```
`unit_id` di sini adalah Polres induk dari unit pelapor.

### 3.3 Idempotensi
- `reports.client_uuid` & `attachments.client_uuid` UNIQUE. Jika terjadi konflik, kembalikan entitas yang sudah ada.
- `IdempotencyInterceptor`: menyimpan respons POST per `Idempotency-Key` di tabel `idempotency_keys` selama 24 jam.

## 4. Job worker (pg-boss)

| Queue | Job | Pemicu |
|---|---|---|
| `media` | `thumbnail` | Lampiran gambar baru: buat thumbnail 320 px, hapus EXIF sensitif dari versi yang dibagikan |
| `media` | `video-probe` | Validasi durasi/codec MP4 (ffprobe) |
| `notify` | `report-submitted`, `report-reviewed`, `priority-alert` | Perubahan status |
| `analytics` | `refresh-mv` | Cron tiap 15 menit |
| `exports` | `export-reports`, `export-attendance` | Permintaan ekspor |
| `maintenance` | `purge-orphan-uploads` | Cron harian: hapus lampiran tanpa laporan > 7 hari |

Semua job: retry 5× dengan backoff eksponensial. Job yang gagal permanen masuk *dead letter* (tabel `pgboss.job` status `failed`) dan ditampilkan di halaman admin.

Catatan: pg-boss memadai untuk beban pilot (puluhan ribu job/hari). Jika kelak dibutuhkan throughput lebih tinggi, antrean dapat dipindah ke Redis + BullMQ tanpa mengubah logika handler.

## 5. Konfigurasi (env)

```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://lapor:***@localhost:5432/lapor
STORAGE_DRIVER=local               # local | s3
STORAGE_LOCAL_DIR=/var/lib/lapor/storage
# S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY bila STORAGE_DRIVER=s3
JWT_ACCESS_SECRET=***          # atau kunci RS256 dari file
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL_MOBILE=2592000
JWT_REFRESH_TTL_WEB=43200
DATA_ENCRYPTION_KEYS=k1:base64...,k2:base64...   # kunci AES-256, entri pertama = aktif
DATA_HMAC_KEY=***
MIN_APP_VERSION=1.0.0
CORS_ORIGINS=https://lapor.internal
```
Rahasia disimpan di `/etc/lapor/*.env` (pemilik `root`, mode `0640`, grup `lapor`), bukan di repositori.

## 6. Konvensi kode

- Controller tipis. Logika ada di service, akses data di repository/Prisma.
- Setiap endpoint wajib mendeklarasikan `@Roles()` (endpoint tanpa dekorator ditolak oleh guard global).
- Setiap query yang mengembalikan data operasional wajib menerima `scope` dari `ScopeGuard`.
- Gunakan transaksi untuk perubahan multi-tabel.
- Pesan error untuk pengguna dalam Bahasa Indonesia. Kode error dalam Bahasa Inggris, konstan.
- Lint (`eslint`), format (`prettier`), dan test wajib lolos di CI sebelum merge.
