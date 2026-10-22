# 12 — Skala Nasional

Versi 0.1 · 22 Oktober 2026 · Status: **Draf untuk dibahas dengan TI Polri / Baharkam**

Aplikasi ditargetkan dipakai **seluruh Bhabinkamtibmas di Indonesia**. Dokumen 01 dan 09 menggambarkan arsitektur **tahap pilot** (satu server, instalasi native). Dokumen ini menjelaskan apa yang berubah untuk tahap nasional, apa yang sudah disiapkan di kode, dan keputusan yang perlu diambil instansi.

## 1. Asumsi beban

Angka di bawah adalah **perkiraan untuk perencanaan** dan perlu dikonfirmasi dengan data resmi Baharkam (jumlah Bhabin aktif, desa binaan, pola pelaporan).

| Parameter | Asumsi |
|---|---|
| Bhabinkamtibmas aktif | ±50.000 |
| Desa / kelurahan | ±83.000 (data Kemendagri) |
| Unit | ±38 Polda, ±500 Polres, ±5.000 Polsek |
| Pengguna dashboard | ±10.000 (verifikator, pimpinan, admin, auditor) |
| Laporan per Bhabin per hari | 3 |
| Foto per laporan | 2 × ±400 KB (setelah kompresi di perangkat) |

### Turunan beban

| Besaran | Pilot (1 Polda) | Nasional |
|---|---|---|
| Laporan per hari | ±6.000 | **±150.000** |
| Laporan per tahun | ±2 juta | **±55 juta** |
| Item harga per tahun (±10 item × ±20% laporan) | ±4 juta | **±110 juta** |
| Foto per tahun | ±1 TB | **±40 TB** |
| Ukuran database per tahun (tanpa foto) | ±5 GB | **±150 GB** (+ indeks) |
| Puncak sinkron (pagi, 30% Bhabin dalam 1 jam, ±10 request/laporan) | ±5 req/detik | **±400 req/detik** (lonjakan sesaat ribuan) |
| Audit log per tahun | ±5 juta baris | **±150 juta baris** |

## 2. Zona waktu

Indonesia memiliki tiga zona waktu: **WIB (UTC+7), WITA (UTC+8), WIT (UTC+9)**. Seluruh penanggalan bisnis harus memakai zona waktu **unit pelapor**, bukan WIB:

- tanggal di nomor laporan (`YYMM`),
- "hari aktif melapor", batas 3×24 jam, rekap harian,
- tampilan waktu di dashboard dan ekspor (dengan label WIB/WITA/WIT).

Penyimpanan tetap `timestamptz` (UTC). Kolom `units.timezone` (mis. `Asia/Makassar`) menjadi sumber kebenaran; Polsek mewarisi dari Polres/Polda bila tidak diisi.

## 3. Arsitektur target

```
                 HP Bhabin (±50.000)                Browser dashboard (±10.000)
                        │                                   │
                        ▼                                   ▼
              ┌──────────────────────────── Load balancer / WAF (HA) ───────────────────────────┐
              │                                                                                  │
      ┌───────┴────────┐  ┌────────────────┐                                      ┌─────────────┴──┐
      │ api × N         │  │ api × N         │   (stateless, autoscale)             │ web × N         │
      └───────┬────────┘  └───────┬────────┘                                      └────────────────┘
              │                   │
   ┌──────────┼───────────────────┼─────────────────────────────────────────────┐
   │          ▼                   ▼                                             │
   │   PgBouncer ──► PostgreSQL primary ──(replikasi)──► replica (dashboard)   │
   │                 + PostGIS, tabel dipartisi per bulan                        │
   │                                                                             │
   │   Redis (antrean BullMQ, rate limit, cache unit)                            │
   │   Object storage S3-compatible (MinIO cluster) — foto & ekspor              │
   │   worker × N: thumbnail, notifikasi, agregasi analitik, ekspor             │
   └─────────────────────────────────────────────────────────────────────────────┘
```

| Komponen | Pilot | Nasional |
|---|---|---|
| API | 1 proses (systemd) | ≥3 instance stateless di belakang load balancer (container) |
| Worker | 1 proses | Pool terpisah per jenis job (media, analitik, ekspor) |
| Database | 1 PostgreSQL | Primary + ≥1 read replica, PgBouncer, partisi bulanan |
| Antrean | pg-boss | Redis + BullMQ |
| Rate limit & cache | Memori proses | Redis (konsisten antar instance) |
| File | Disk lokal | Object storage S3-compatible, berklaster & tereplikasi |
| Deployment | systemd + Nginx | Container (Docker/Kubernetes) di pusat data Polri |
| Peta | OpenStreetMap publik | Tile server internal |

Prinsip pilot tetap berlaku: kode yang sama, perbedaan hanya di konfigurasi (driver storage, antrean, URL tile).

## 4. Perubahan aplikasi

### 4.1 Analitik berbasis agregat
Query dashboard saat ini menghitung langsung dari tabel `reports`. Untuk tingkat Mabes (puluhan juta baris) ini tidak layak. Solusi:

- Tabel agregat harian `agg_reports_daily(hari_lokal, unit_id, village_id, category, status, jumlah, prioritas, lokasi_janggal)` dan `agg_prices_daily(hari_lokal, kabupaten, commodity_id, sum, count, min, max, stok_*)`, diperbarui worker secara inkremental (laporan yang berubah sejak pembaruan terakhir).
- Endpoint ringkasan, harga, dan kinerja membaca agregat; detail (daftar laporan) tetap dari tabel utama dengan indeks.
- Dashboard pimpinan memakai read replica.

### 4.2 Peta
- Di atas ±5.000 titik, server mengembalikan **cluster per sel grid** (bergantung zoom) atau heatmap per kecamatan/kabupaten, bukan titik mentah.
- Batas desa disajikan sebagai vector tiles (mis. `ST_AsMVT`) bila jumlah desa dalam tampilan besar.

### 4.3 Daftar besar
- Kinerja Bhabin: paginasi server + filter Polda/Polres/Polsek.
- Pohon unit: dimuat bertahap per cabang; pemilih unit di form menjadi kolom pencarian (autocomplete).
- Desa: sudah paginasi; pemilih desa binaan cukup per Polsek.

### 4.4 Ekspor & berkas
- Ekspor besar menjadi **job**: diproses worker, disimpan ke object storage, diunduh lewat tautan bertanda waktu.
- Thumbnail dibuat worker setelah unggah, bukan di request.
- Driver penyimpanan `s3` di `StorageService` (antarmuka sudah ada).

### 4.5 Database
- Partisi `reports`, `report_items`, `report_status_history`, `attachments`, `audit_logs` per bulan (`PARTITION BY RANGE`).
- Indeks parsial untuk status aktif (`SUBMITTED`, `IN_REVIEW`) yang sering diakses verifikator.
- Retensi & arsip: audit log > 5 tahun dipindah ke arsip dingin; foto > 1 tahun ke kelas penyimpanan murah.

### 4.6 Data master
- Batas wilayah: `npm run seed:wilayah` memuat 38 provinsi, 514 kabupaten/kota, 7.285 kecamatan, dan desa/kelurahan per provinsi (`--desa=all` untuk ±83.000 desa) dari data komunitas berbasis Kepmendagri 2025. Untuk produksi, ganti dengan data resmi BIG/Kemendagri bila tersedia (format sama: kode Kemendagri + poligon).
- Impor akun Bhabin per Polda (CSV, sudah ada; batas 1.000 baris per file dinaikkan atau dipecah otomatis).
- Pemetaan desa ↔ Polsek dari data Polri.

## 5. Kapasitas awal (perkiraan)

| Komponen | Spesifikasi awal nasional |
|---|---|
| API | 4–6 instance × 2 vCPU / 2 GB |
| Worker | 4 instance × 2 vCPU / 4 GB |
| PostgreSQL primary | 16–32 vCPU, 64–128 GB RAM, 2 TB NVMe (tumbuh ±200 GB/tahun) |
| Read replica | sama dengan primary |
| Redis | 2 vCPU / 8 GB, replikasi |
| Object storage | ≥ 60 TB tahun pertama (40 TB + replikasi/erasure coding), dapat ditambah |
| Backup | Lokasi fisik terpisah; database (PITR) + replikasi object storage |

Angka divalidasi lewat uji beban (k6) pada tahap pilot Polda sebelum pengadaan final.

## 6. Tahapan menuju nasional

| Tahap | Cakupan | Infrastruktur | Gerbang lanjut |
|---|---|---|---|
| 1. Pilot | 1 Polres (±50–100 Bhabin) | Satu server, native (dok. 09) | Kriteria siap pilot (dok. 11) tercapai |
| 2. Polda | 1 Polda (±2.000 Bhabin) | Satu server lebih besar atau 2–3 node | Uji beban skala nasional lolos; agregat analitik aktif |
| 3. Gelombang | 5–10 Polda | Klaster container, object storage, replica | SLA & dukungan operasional siap |
| 4. Nasional | Seluruh Polda | Arsitektur §3 penuh | — |

## 7. Status kesiapan di kode

| Item | Status |
|---|---|
| Hierarki unit & pembatasan wilayah | ✅ siap (query rekursif + cache) |
| Idempotensi sinkron mobile (`clientUuid`) | ✅ siap |
| Antarmuka penyimpanan (`StorageService`) | 🟡 driver `local`; `s3` belum |
| Zona waktu per unit | ✅ siap (`units.timezone`, nomor laporan, rekap, ekspor) |
| Analitik dari agregat | ✅ siap (`agg_unit_daily`, `agg_user_daily`, `agg_price_daily`; refresh inkremental tiap `AGG_REFRESH_SECONDS`) |
| Batas wilayah provinsi → desa di peta | ✅ siap (`regions` + `villages`, tingkat mengikuti zoom) |
| Peta ter-cluster | ❌ batas 5.000 titik |
| Paginasi kinerja, pencarian unit | 🟡 kinerja: paginasi + cari + filter unit; pencarian unit belum |
| Ekspor sebagai job, thumbnail di worker | ❌ |
| Partisi tabel | ❌ (bisa ditambahkan lewat migrasi tanpa mengubah kode aplikasi) |
| Redis untuk rate limit/cache/antrean | ❌ |

## 8. Keputusan yang dibutuhkan dari instansi

1. Lokasi hosting nasional: pusat data Polri mana, dan apakah dapat dijangkau HP lapangan di seluruh Indonesia (lewat internet dengan WAF, atau APN/VPN operator).
2. Kebijakan container/orkestrasi di pusat data (Docker, Kubernetes, atau VM saja).
3. Ketersediaan object storage dan kapasitas tahunan.
4. Sumber resmi data desa & batas wilayah, serta pemetaan desa ↔ Polsek.
5. Jumlah resmi Bhabin aktif dan target pelaporan harian (untuk validasi angka di §1).
6. Kebijakan retensi data laporan, foto, dan audit log.
