# Lapor Bhabinkamtibmas

Aplikasi pelaporan terpadu Bhabinkamtibmas: aplikasi mobile Flutter untuk petugas lapangan, dashboard web Next.js untuk pimpinan/admin, dan backend NestJS + PostgreSQL/PostGIS di server internal. Dirancang untuk skala nasional (±50.000 Bhabin, 38 Polda).

Dokumentasi teknis lengkap: [docs/teknis/00-README.md](docs/teknis/00-README.md)

## Daftar isi

- [Struktur](#struktur)
- [Fitur](#fitur)
- [Menjalankan di lokal](#menjalankan-di-lokal)
- [Data contoh (seeder)](#data-contoh-seeder)
- [Akun uji](#akun-uji)
- [Konfigurasi](#konfigurasi)
- [Test](#test)
- [Perawatan](#perawatan)
- [Status & rencana](#status--rencana)

## Struktur

```
backend/                 NestJS API (Prisma, PostgreSQL + PostGIS), port 3000
  prisma/                skema, migrasi, seeder
  storage/               berkas lampiran, ekspor, cache data wilayah (tidak masuk git)
web/                     Dashboard Next.js 15 (App Router, Tailwind v4), port 3001
mobile/                  Aplikasi Flutter (Android & iOS) — masih kerangka
packages/form-schemas/   Skema form kategori laporan + master komoditas (JSON)
infra/                   Unit systemd, konfigurasi Nginx, skrip server
docs/teknis/             Dokumentasi teknis (arsitektur, API, database, keamanan, skala nasional)
```

## Fitur

**Laporan** (dikirim Bhabin dari aplikasi mobile)
- 6 kategori aktif: Sambang/DDS, Deteksi Dini, Problem Solving, Harga Pangan, Mapping Data Keluarga, Ketahanan Pangan. Penyuluhan & Pembinaan **ditunda**.
- **Tanpa verifikasi:** laporan yang dikirim langsung final. Pelapor masih bisa **meralat** selama 3×24 jam (`REPORT_RALAT_HOURS`).
- Pengaman kualitas data:
  - validasi isian & lampiran wajib,
  - **cek lokasi otomatis** (titik harus ≤ 200 m dari desa binaan, deteksi lokasi palsu),
  - field sensitif (NIK dll.) terenkripsi AES-256-GCM, dibuka dengan alasan & tercatat di audit.
- Penomoran `{KAT}-{KODE_POLRES}-{YYMM}-{URUT}` mengikuti zona waktu unit (WIB/WITA/WIT).
- Foto dikompres saat unggah (maks. 1920 px, JPEG q78); foto kamera ±4–5 MB menjadi ±0,2–0,4 MB.

**Tampilan lapangan Bhabin (web/HP)** — `/bhabin`, pengganti sementara aplikasi mobile
- Mobile-first dengan tab bawah: Beranda, Laporan, **Lapor**, Absensi; tetap nyaman di laptop.
- Formulir laporan dibangun otomatis dari skema JSON: GPS browser, foto langsung dari kamera (diperkecil di HP sebelum diunggah), simpan draft, kirim, dan ralat ≤ 3×24 jam.
- Absen masuk/pulang dengan GPS + swafoto kamera depan, riwayat 14 hari.
- Bhabin otomatis diarahkan ke `/bhabin` setelah login; peran lain tidak dapat membukanya. Lokasi kamera/GPS butuh HTTPS (atau `localhost`).

**Dashboard web**
- **Ringkasan:** total laporan, tren harian, sesuai desa binaan, partisipasi Bhabin, deteksi dini prioritas, lonjakan harga.
- **Peta sebaran:**
  - batas wilayah Kemendagri 2025 (provinsi → kabupaten → kecamatan → desa, mengikuti zoom),
  - titik berdekatan dikelompokkan dan laporan prioritas beranimasi,
  - filter periode, kategori, dan wilayah.
- **Kinerja Bhabin:** hari aktif, komposisi kategori, lokasi perlu dicek; paginasi, cari, dan filter unit.
- **Absensi lapangan:** check-in/out harian dengan GPS & swafoto; rekap per hari (hadir, terlambat, di luar desa, lokasi palsu).
- **Laporan:** daftar & detail dengan lampiran, harga komoditas, riwayat, dan cek lokasi.
- **Harga pangan:** harga rata-rata, perubahan 7 hari, tren, dan sebaran per wilayah.
- **Administrasi:**
  - pengguna (termasuk impor CSV),
  - unit (pohon bertahap, zona waktu),
  - desa (tetapkan desa Kemendagri ke Polsek, impor GeoJSON),
  - audit log.
- **Notifikasi:** lonceng di topbar (dan header tampilan Bhabin) dengan angka belum dibaca, menu & halaman Notifikasi.
  - Deteksi Dini urgensi tinggi → Pimpinan & Admin Unit di Polsek, Polres, dan Polda pelapor (Mabes tidak, agar tidak banjir).
  - Lokasi palsu / di luar desa binaan → Pimpinan & Admin Unit di Polsek dan Polres pelapor.
  - Bhabin diberi tahu saat desa binaannya diubah.
- **Ekspor CSV** lewat antrean (`export_jobs`): diunduh otomatis saat selesai, berkas disimpan 24 jam.

**Aturan desa binaan:** 1 Bhabin membina 1 desa dan 1 desa dibina 1 Bhabin (dijaga indeks unik di database); desa & waktu kegiatan di formulir Bhabin terkunci.

**Peran:** Bhabinkamtibmas (web `/bhabin` & mobile), Pimpinan, Admin Unit, Superadmin, Auditor. Peran Verifikator **tidak dipakai lagi**. Akses dibatasi cakupan unit (Polda → Polres → Polsek). Rincian: [docs/teknis/02-peran-hak-akses.md](docs/teknis/02-peran-hak-akses.md).

## Menjalankan di lokal

Prasyarat: Node.js 22, PostgreSQL 16+ dengan PostGIS (mis. Postgres.app di macOS), Flutter 3.24+ (untuk mobile). Tidak memerlukan Docker.

```bash
# 1. Database (Postgres.app sudah menyertakan PostGIS)
createdb lapor_dev

# 2. Backend → http://localhost:3000/api/v1 (Swagger: /api/docs)
cd backend
cp .env.example .env             # sekali saja; isi DATABASE_URL & DATA_ENCRYPTION_KEYS
npm install
npx prisma migrate deploy
npm run seed:semua               # semua data contoh (±2 menit), lihat bagian berikut
npm run start:dev

# 3. Web → http://localhost:3001
cd ../web
cp .env.example .env.local       # sekali saja
npm install
npm run dev

# 4. Mobile: lihat mobile/README.md
```

> `DATA_ENCRYPTION_KEYS` adalah kunci data sensitif. Jangan diganti atau dihilangkan setelah ada data; tanpa kunci yang sama, data terenkripsi tidak bisa dibuka.

Bila `nest start --watch` tidak memuat ulang setelah perubahan (endpoint baru 404), hentikan dengan `Ctrl+C` lalu jalankan lagi `npm run start:dev`.

## Data contoh (seeder)

Semua perintah dijalankan di folder `backend/`. Seeder data contoh menolak berjalan bila `NODE_ENV=production`.

### Sekaligus

```bash
npm run seed:semua                            # membuat ulang SEMUA data contoh (data contoh lama dihapus)
npm run seed:semua -- --tanpa-desa            # lewati impor desa (lebih cepat bila desa sudah ada)
npm run seed:semua -- --hari=60 --per-hari=1  # laporan nasional lebih banyak
npm run seed:semua -- --prov=32,33            # laporan nasional hanya provinsi tertentu
```

Urutan yang dijalankan `seed:semua`:

| # | Perintah | Isi | ± Waktu |
|---|---|---|---|
| 1 | `npm run seed` | Unit & akun contoh, komoditas, skema form | 1 dtk |
| 2 | `npm run seed:wilayah -- --desa=all` | 38 provinsi, 514 kab/kota, 7.285 kecamatan, 83.708 desa (Kepmendagri 2025) | 15 dtk (1 mnt pertama kali) |
| 3 | `npm run seed:demo-nasional -- --hapus` | Hapus data contoh nasional lama | 20 dtk |
| 4 | `npm run seed:demo -- --reset` | ±235 laporan Polres Contoh (dipakai test E2E) | 1 dtk |
| 5 | `npm run seed:demo-attachments -- --reset` | ±400 foto contoh untuk laporan Polres Contoh | 15 dtk |
| 6 | `npm run seed:demo-nasional` | ±135 ribu laporan di seluruh kecamatan, desa asli | 15 dtk |
| 7 | `npm run aggregates:rebuild` | Hitung ulang data ringkasan/kinerja | 10 dtk |
| 8 | `npm run seed:demo-absensi` | ±185 ribu absensi 15 hari untuk semua Bhabin | 30 dtk |
| 9 | `npm run notifications:isi` | Notifikasi dari laporan prioritas/lokasi 7 hari terakhir (`--hari=`) | 2 dtk |

### Satu per satu

| Perintah | Keterangan |
|---|---|
| `npm run seed` | Data dasar. Aman diulang. |
| `npm run seed:wilayah` | Batas provinsi–kecamatan. `--desa=32,34` desa provinsi tertentu, `--desa=all` seluruh Indonesia, `--timpa` menimpa geometri desa. Sumber: [cahyadsn/wilayah_boundaries](https://github.com/cahyadsn/wilayah_boundaries) (MIT), di-cache di `storage/wilayah-cache`. |
| `npm run seed:demo` | Laporan Polres Contoh 30 hari. `--reset` menghapus semua laporan lalu membuat ulang. |
| `npm run seed:demo-attachments` | Foto contoh laporan Polres Contoh (`--reset`). |
| `npm run seed:demo-nasional` | Struktur & laporan nasional dengan kode wilayah asli. Opsi `--hari=`, `--per-hari=`, `--prov=`; `--hapus` untuk membersihkan. Perlu desa (`seed:wilayah -- --desa=all`). |
| `npm run seed:demo-absensi` | Absensi 14 hari untuk semua Bhabin aktif (`--hapus` untuk membersihkan). |
| `npm run aggregates:rebuild` | Wajib setelah mengubah laporan langsung di database. |

Data contoh nasional:
- **Unit:** Polda per provinsi (`DEMO-POLDA-xx`), Polres per kab/kota (`DEMO-RES-xxxx`), dan Polsek per kecamatan (`DEMO-SEK-xxxxxx`).
- **Bhabin:** 1 per kecamatan dengan 1 desa binaan asli.
- **Laporan:** titik diacak di dalam batas desa, ±3% di luar desa, ±1% lokasi palsu.

Batas desa demo Polres Contoh (kode `99.*`) ada di `backend/prisma/demo/*.geojson` dan bisa diimpor lewat menu **Desa → Impor GeoJSON**.

## Akun uji

Sandi semua akun contoh: `Demo#12345`.

| NRP | Peran | Unit |
|---|---|---|
| 90000001 | Bhabinkamtibmas (web `/bhabin` & mobile) | Polsek Contoh |
| 90000002 | Pimpinan | Polsek Contoh |
| 90000003 | Pimpinan | Polres Contoh |
| 90000004 | Admin Unit | Polres Contoh |
| 90000005 | Auditor | Polda Contoh |
| 90000007 | Pimpinan | Mabes — **melihat seluruh Indonesia** (data contoh nasional) |
| 00000001 | Superadmin | Mabes (sandi dari `SEED_SUPERADMIN_PASSWORD`, wajib diganti) |
| `99` + kode provinsi, mis. 99000035 | Pimpinan Polda (data nasional) | Polda Jawa Timur |
| `97` + kode kab/kota, mis. 97003314 | Pimpinan Polres (data nasional) | Polres Sragen |
| `98` + kode kecamatan, mis. 98331409 | Bhabinkamtibmas (data nasional) | Polsek Karangmalang |

**Login cepat (hanya lokal):**
- Saat `npm run dev`, halaman login menampilkan tombol akun percobaan per peran. Sandinya tetap di server dan tidak dikirim ke browser.
- Untuk build lokal (`next start`), aktifkan dengan `DEV_LOGIN=true`.
- Tombol Superadmin muncul bila `DEV_SUPERADMIN_NRP` dan `DEV_SUPERADMIN_PASSWORD` diisi di `web/.env.local`.

## Konfigurasi

### `backend/.env`

| Variabel | Default | Keterangan |
|---|---|---|
| `DATABASE_URL` | — | Koneksi PostgreSQL + PostGIS |
| `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL` | —, 900 | Token akses (detik) |
| `JWT_REFRESH_TTL_MOBILE` / `_WEB` | 30 hari / 12 jam | Masa berlaku sesi |
| `CORS_ORIGINS` | `http://localhost:3001` | Asal web yang diizinkan |
| `DATA_ENCRYPTION_KEYS` | — | Kunci AES-256 field sensitif (`k1:<base64 32 byte>`) |
| `STORAGE_DRIVER`, `STORAGE_LOCAL_DIR` | `local`, `./storage` | Penyimpanan berkas (disk lokal; S3/MinIO ditunda) |
| `PHOTO_MAX_EDGE`, `PHOTO_QUALITY` | 1920, 78 | Kompresi foto saat unggah |
| `REPORT_RALAT_HOURS` | 72 | Jendela ralat laporan terkirim |
| `ATTENDANCE_LATE_AFTER` | `08:00` | Check-in setelah jam ini (setempat) = terlambat |
| `MAP_POINT_LIMIT` | 1500 | Di atas jumlah ini, peta menerima gugus dari server |
| `AGG_REFRESH_SECONDS` | 60 | Penyegaran agregat dashboard (0 = mati di instance ini) |
| `EXPORT_POLL_MS`, `EXPORT_KEEP_HOURS`, `EXPORT_MAX_ROWS` | 2000, 24, 200000 | Antrean ekspor CSV |
| `LOGIN_RATE_LIMIT` | 10 | Percobaan login per IP per menit (dev/E2E: 100+) |
| `SEED_SUPERADMIN_NRP`, `SEED_SUPERADMIN_PASSWORD` | — | Akun superadmin awal |
| `MIN_APP_VERSION` | 1.0.0 | Versi minimum aplikasi mobile |

### `web/.env.local`

| Variabel | Keterangan |
|---|---|
| `API_URL` | Alamat API backend, mis. `http://localhost:3000/api/v1` |
| `NEXT_PUBLIC_TILE_URL` | (opsional) Tile server peta internal; default OpenStreetMap |
| `DEV_LOGIN` | (opsional) `true` untuk login cepat pada build lokal; **jangan di produksi** |
| `DEV_SUPERADMIN_NRP`, `DEV_SUPERADMIN_PASSWORD` | (opsional) Tombol login cepat Superadmin |
| `NEXT_DIST_DIR` | (opsional) Folder build lain, mis. `.next-build` agar tidak bentrok dengan `npm run dev` |

## Test

```bash
cd backend && npm test                       # unit test (Jest)
cd web && npm run typecheck && npm run lint

# E2E (Playwright): backend & web harus berjalan dengan data seed + seed:demo
cd web
npx playwright install chromium              # sekali saja (atau pakai Chrome terpasang: PW_CHANNEL=chrome)
E2E_BASE_URL=http://localhost:3001 npm run e2e
```

- Untuk E2E lokal, longgarkan batas login di `backend/.env`: `LOGIN_RATE_LIMIT=100`.
- Untuk menguji build produksi tanpa mengganggu `npm run dev`:
  ```bash
  NEXT_DIST_DIR=.next-build npx next build && NEXT_DIST_DIR=.next-build npx next start -p 3002
  ```
- CI (GitHub Actions, `.github/workflows/ci.yml`) menjalankan typecheck, lint, unit test, build, lalu E2E dengan PostgreSQL + PostGIS.

## Perawatan

```bash
cd backend
npm run aggregates:rebuild        # hitung ulang ringkasan/kinerja (juga otomatis tiap AGG_REFRESH_SECONDS)
npm run storage:compress          # kompres ulang foto lama; --cek untuk perkiraan saja
npx prisma migrate deploy         # terapkan migrasi baru
```

Deployment server (systemd + Nginx, tanpa Docker): [docs/teknis/09-deployment.md](docs/teknis/09-deployment.md). Rencana skala nasional: [docs/teknis/12-skala-nasional.md](docs/teknis/12-skala-nasional.md).

## Status & rencana

**Sudah berjalan**
- Backend:
  - auth + RBAC + cakupan unit, zona waktu per unit,
  - laporan (kirim final + ralat), lampiran terkompresi, absensi,
  - batas wilayah Kemendagri, agregat analitik, antrean ekspor, audit log.
- Web: semua halaman pada bagian [Fitur](#fitur).
- Data contoh nasional dan test E2E.

**Belum dikerjakan**
- Aplikasi mobile Flutter (baru kerangka; sementara Bhabin memakai tampilan web `/bhabin`).
- Notifikasi push ke HP (notifikasi dalam aplikasi web sudah ada).
- API Command Center & tampilan korelasi.
- Rekap absensi per Bhabin/bulanan & ekspor absensi.
- Filter wilayah (provinsi/kab/kec) di halaman Laporan & Kinerja.
- Partisi tabel per bulan & uji beban (k6) untuk tahap nasional.

**Ditunda atas keputusan:** modul Penyuluhan & Pembinaan triwulanan, penyimpanan S3/MinIO.
