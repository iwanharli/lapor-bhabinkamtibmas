# 05 — Spesifikasi API

Base URL: `https://<host-internal>/api/v1` · Format: JSON (UTF-8) · Dokumentasi interaktif: OpenAPI/Swagger di `/api/docs` (hanya lingkungan dev/staging).

## 1. Konvensi

| Hal | Aturan |
|---|---|
| Autentikasi | Header `Authorization: Bearer <access_token>` |
| Waktu | ISO 8601 dengan zona, mis. `2026-10-22T08:15:00+07:00` |
| Koordinat | `{ "lat": -6.595, "lng": 106.816 }` |
| Paginasi | `?page=1&limit=20` → respons `{ data: [], meta: { page, limit, total } }` |
| Pengurutan | `?sort=-occurred_at` (minus = menurun) |
| Idempotensi | Header `Idempotency-Key: <uuid>` untuk POST dari mobile; atau `client_uuid` di body |
| Versi aplikasi | Header `X-App-Version: 1.0.3`, `X-Device-Id: <id>` |

### Format error

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Isian tidak valid",
    "details": [ { "field": "data.uraian", "rule": "maxLength", "message": "Maksimal 500 karakter" } ]
  }
}
```

| HTTP | Kode | Arti |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Isian tidak sesuai skema |
| 401 | `UNAUTHENTICATED` / `TOKEN_EXPIRED` | Belum login / token kedaluwarsa |
| 403 | `FORBIDDEN` / `OUT_OF_SCOPE` | Peran tidak berhak / di luar wilayah |
| 404 | `NOT_FOUND` | Data tidak ada (juga dipakai untuk data di luar cakupan, agar tidak membocorkan keberadaan) |
| 409 | `INVALID_TRANSITION` / `DUPLICATE` | Perubahan status tidak sah / duplikat |
| 413 | `FILE_TOO_LARGE` | Lampiran melebihi batas |
| 426 | `APP_UPDATE_REQUIRED` | Versi aplikasi terlalu lama |
| 429 | `RATE_LIMITED` | Terlalu banyak permintaan |

## 2. Autentikasi

### `POST /auth/login`
```json
// request
{ "nrp": "87010123", "password": "******", "device": { "deviceId": "a1b2...", "platform": "android", "model": "SM-A155F", "appVersion": "1.0.0" } }
// response 200
{ "accessToken": "eyJ...", "refreshToken": "rt_...", "expiresIn": 900,
  "user": { "id": "…", "nrp": "87010123", "nama": "Bripka Contoh", "role": "BHABIN",
            "unit": { "id": "…", "nama": "Polsek Contoh" }, "mustChangePassword": false } }
```
- Access token 15 menit. Refresh token 30 hari (mobile) atau 12 jam (web), dirotasi setiap kali dipakai.
- Login gagal 5× dalam 15 menit → akun dikunci 15 menit.
- Mobile hanya menerima akun `BHABIN`.

### `POST /auth/refresh`
`{ "refreshToken": "rt_..." }` → token baru. Refresh token lama langsung dicabut. Jika token yang sudah dicabut dipakai lagi, semua sesi perangkat tersebut dicabut (deteksi pencurian token).

### `POST /auth/logout` · `POST /auth/change-password` · `GET /auth/me`

## 3. Master & sinkron (mobile)

### `GET /sync/master?since=2026-10-20T00:00:00Z`
```json
{
  "serverTime": "2026-10-22T01:00:00Z",
  "formSchemas": [ { "category": "DETEKSI_DINI", "version": 1, "schema": { … }, "status": "ACTIVE" } ],
  "commodities": [ { "id": 1, "kode": "BERAS_MEDIUM", "nama": "Beras Medium", "satuan": "kg" } ],
  "villages": [ { "id": "…", "nama": "Sukamaju", "kecamatan": "…", "centroid": { "lat": …, "lng": … } } ],
  "minAppVersion": "1.0.0"
}
```
Hanya mengembalikan data yang berubah sejak `since`. Poligon desa diunduh terpisah: `GET /sync/villages/:id/geometry` (GeoJSON, disederhanakan).

### `GET /sync/reports?since=…`
Perubahan status laporan milik Bhabin (mis. `NEEDS_REVISION` + catatan) sejak waktu tertentu.

## 4. Laporan

### `POST /reports` — buat / perbarui draft di server (idempoten)
```json
{
  "clientUuid": "5f1c…",
  "category": "HARGA_PANGAN",
  "schemaVersion": 1,
  "villageId": "…",
  "occurredAt": "2026-10-22T07:40:00+07:00",
  "location": { "lat": -6.5951, "lng": 106.8162 },
  "gpsAccuracyM": 8.5,
  "isMockLocation": false,
  "data": {
    "jenis_lokasi": "Pasar Tradisional",
    "nama_pasar": "Pasar Harapan",
    "items": [
      { "commodityId": 1, "harga": 13500, "satuan": "kg", "stok": "AMAN" },
      { "commodityId": 6, "harga": 52000, "satuan": "kg", "stok": "MENIPIS" }
    ]
  }
}
```
Respons `201` (atau `200` jika `clientUuid` sudah ada):
```json
{ "id": "…", "nomor": "HP-POLRESBGR-2610-00042", "status": "DRAFT",
  "requiredAttachments": [ { "fieldKey": "foto_etalase", "min": 1, "max": 3, "uploaded": 0 } ] }
```

### `POST /reports/:id/attachments` — unggah lampiran
`multipart/form-data`: `file`, `fieldKey`, `clientUuid`, `sha256`, `capturedAt`, `lat`, `lng`, `source`, `watermarked`.
- Server menghitung ulang SHA-256. Jika berbeda, unggahan ditolak (`400 CHECKSUM_MISMATCH`).
- Mengirim ulang `clientUuid` yang sama akan mengembalikan lampiran yang sudah ada.
- Foto dikompres server sebelum disimpan (sisi terpanjang maks. `PHOTO_MAX_EDGE` = 1920 px, JPEG `PHOTO_QUALITY` = 78, tanpa EXIF) bila hemat ≥ 10%; `sizeBytes`/`mime` mengikuti file tersimpan, `sha256` tetap milik file asli.
- Untuk koneksi lambat tersedia unggahan terpotong (fase 2): `POST /uploads` (init) → `PUT /uploads/:id/parts/:n` → `POST /uploads/:id/complete`.

### `POST /reports/:id/submit`
Validasi skema + kelengkapan lampiran → status `SUBMITTED` (atau `APPROVED` jika kategori `auto_approve`). Error `400 VALIDATION_FAILED` berisi daftar field.

### `PATCH /reports/:id`
Ubah `data`/`villageId`/`occurredAt`/`location`. Hanya oleh pemilik, hanya untuk status `DRAFT` atau `NEEDS_REVISION`. `data` **mengganti seluruh isian** (aplikasi selalu mengirim formulir lengkap). Field bertanda `sensitive` di skema disimpan terenkripsi (AES-256-GCM, kunci `DATA_ENCRYPTION_KEYS`) dan tidak pernah dikirim balik kecuali lewat `reveal-sensitive`.

### Filter status gabungan
`status=MENUNGGU` = Terkirim + Ditinjau (belum diputuskan). `GET /reports/status-counts` mengembalikan jumlah per status untuk filter yang sama.

### `GET /reports`
Filter: `category`, `status`, `unitId`, `villageId`, `userId`, `from`, `to`, `priority`, `q` (teks), `bbox` (`minLng,minLat,maxLng,maxLat`). Hasil otomatis dibatasi cakupan wilayah.

### `GET /reports/:id`
Detail laporan + lampiran (URL presigned berlaku 10 menit) + riwayat status. Field sensitif ditampilkan tersamar (`3201********0003`).

### `POST /reports/:id/reveal-sensitive`
Mengembalikan field sensitif asli. Wajib `reason` (teks). Dicatat `SENSITIVE_READ`.

### `POST /reports/:id/transition` — verifikasi
```json
{ "to": "NEEDS_REVISION", "note": "Foto etalase buram, mohon diulang." }
```
Transisi yang sah dijelaskan di [03-modul-laporan §6](03-modul-laporan.md#6-alur-status-laporan). Transisi lain → `409 INVALID_TRANSITION`.

### Kode galat tambahan
| HTTP | Kode | Arti |
|---|---|---|
| 403 | `PASSWORD_CHANGE_REQUIRED` | Masih memakai sandi sementara; hanya `/auth/me`, `/auth/change-password`, `/auth/logout` yang boleh |
| 400 | `SCHEMA_RETIRED` | Versi formulir sudah tidak berlaku; aplikasi perlu diperbarui |
| 400 | `UNSUPPORTED_FILE` / `CHECKSUM_MISMATCH` | Lampiran bukan JPG/PNG/WEBP/PDF/MP4 (dicek dari isi berkas) / rusak saat dikirim |

`POST /auth/change-password` mengembalikan token baru dan mencabut semua sesi lain.

## 5. Absensi

### `POST /attendances`
`multipart/form-data`: `clientUuid`, `type`, `clientTime`, `lat`, `lng`, `gpsAccuracyM`, `isMockLocation`, `selfie` (file).
Respons berisi `insideVillage`, `villageName`, `lateSync`.

### `GET /attendances?userId=&from=&to=` · `GET /attendances/summary?unitId=&month=2026-10`

## 6. Analitik (web)

| Endpoint | Isi |
|---|---|
| `GET /analytics/overview?unitId=&from=&to=` | Jumlah laporan per kategori/status, laporan prioritas terbuka, tingkat kehadiran |
| `GET /analytics/map?category=&from=&to=&bbox=` | Titik laporan (GeoJSON), dengan clustering di sisi klien |
| `GET /analytics/prices?commodityId=&level=kabupaten&from=&to=` | Tren harga (rata-rata/min/maks/sampel) |
| `GET /analytics/prices/latest?unitId=` | Harga terbaru per komoditas + perubahan vs 7 hari lalu |
| `GET /analytics/bhabin-performance?unitId=&month=` | Jumlah kegiatan per Bhabin per kategori + kehadiran |
| `GET /analytics/hotspots?category=DETEKSI_DINI&from=&to=` | Agregat kerawanan per desa/kecamatan |

## 6b. Lampiran, peta, kinerja, ekspor

| Endpoint | Fungsi |
|---|---|
| `GET /attachments/:id/file?thumb=1` | Berkas/thumbnail lampiran (cek cakupan laporan) |
| `GET /analytics/map?from=&category=&priority=` | Titik laporan untuk peta (maks. 5.000) |
| `GET /analytics/bhabin-performance?from=&to=` | Rekap kinerja per Bhabin |
| `GET /exports/{reports,prices,users,performance}.csv` | Ekspor CSV (`;` + BOM UTF-8), tercatat di audit |

## 6c. Batas wilayah

Sumber: [cahyadsn/wilayah_boundaries](https://github.com/cahyadsn/wilayah_boundaries) (Kepmendagri No 300.2.2-2430 Tahun 2025, MIT), dimuat dengan `npm run seed:wilayah`. Provinsi, kabupaten/kota, dan kecamatan disimpan di tabel `regions`; desa/kelurahan di `villages` (kode Kemendagri, Polsek pembina tidak diubah).

### `GET /regions/boundaries?level=1..4&bbox=w,s,e,n&parent=kode`
GeoJSON FeatureCollection (`properties: kode, nama, chain, level`), maksimal 3.000 fitur (`truncated: true` bila lebih). Level 1 provinsi, 2 kabupaten/kota, 3 kecamatan, 4 desa (wajib `bbox` atau `parent` = kode kecamatan). Geometri disederhanakan untuk tampilan. Semua peran.

### `GET /regions?parent=kode`
Anak wilayah tanpa geometri (tanpa `parent`: daftar provinsi), dengan jumlah desa per kecamatan. Untuk pemilih bertingkat.

### `GET /admin/villages/by-kecamatan/:kode` · `POST /admin/villages/assign`
Desa satu kecamatan Kemendagri beserta Polsek-nya (`assignable` bila belum ada Polsek atau Polsek dalam cakupan), lalu tetapkan banyak desa ke satu Polsek: `{ polsekId, villageIds[] }`. Ditolak (409, `details` per desa) bila desa milik Polsek di luar cakupan atau masih dibina Bhabin Polsek lain. Admin unit & superadmin.

### `GET /regions/at?lat=&lng=`
Rantai wilayah pada satu titik: `[{kode, nama, level}]` dari provinsi sampai desa.

## 6d. Peta ter-cluster & unit

### `GET /analytics/map?from=&to=&category=&priority=&bbox=w,s,e,n&zoom=`
`{ mode: 'points', total, points[] }` bila jumlah dalam bbox ≤ `MAP_POINT_LIMIT` (default 1.500) atau zoom ≥ 15; selain itu `{ mode: 'clusters', total, clusters[{ lat, lng, jumlah, prioritas, category }] }` per sel grid (±64 px).

### `GET /analytics/map/summary`
Jumlah per kategori, lokasi janggal, dan 8 laporan prioritas terbaru untuk panel peta.

### `GET /units/search?q=&level=POLSEK,POLRES&ids=&limit=` · `GET /units/children?parentId=` · `GET /units/summary`
Pencarian unit dalam cakupan (dengan `path` rantai induk), anak satu cabang untuk pohon bertahap (`childCount`, `counts`), dan ringkasan cakupan. `GET /admin/users` dan `/admin/users/role-counts` menerima `unitId`.

## 7. Administrasi (web)

| Endpoint | Fungsi |
|---|---|
| `GET/POST/PATCH /admin/users` | Kelola pengguna (`POST /admin/users/import` untuk impor CSV) |
| `POST /admin/users/:id/reset-password` | Reset sandi (sandi sementara) |
| `GET/DELETE /admin/users/:id/devices/:deviceId` | Lihat/cabut perangkat |
| `GET/POST/PATCH /admin/units` | Kelola unit |
| `GET/POST/PATCH /admin/villages` | Kelola desa (daftar memuat status batas, jumlah Bhabin, laporan 30 hari) |
| `POST /admin/villages/import` | Impor desa + batas dari GeoJSON ke satu Polsek (`dryRun` untuk pratinjau) |
| `GET /villages/geojson?polsekId=` | Batas desa (disederhanakan) untuk peta |
| `POST /admin/users/import` | Impor pengguna dari baris CSV (`dryRun` untuk pratinjau; semua-atau-tidak) |
| `GET /admin/users/role-counts` | Jumlah pengguna per peran |
| `PUT /admin/users/:id/villages` | Atur desa binaan Bhabin |
| `GET/POST/PATCH /admin/commodities` | Master komoditas |
| `GET/POST /admin/form-schemas` · `POST /admin/form-schemas/:id/retire` | Kelola skema form |
| `GET /audit-logs?actorId=&action=&from=&to=` | Audit log |

## 8. Ekspor

### Antrean ekspor (dipakai web)
`POST /exports/jobs` `{ kind: reports|prices|performance|users, params: {…filter} }` → pekerjaan `QUEUED`; `GET /exports/jobs/:id` untuk status (`QUEUED → RUNNING → DONE/FAILED`, `rows`, `error`); `GET /exports/jobs/:id/file` mengunduh CSV (hanya pembuatnya, berlaku `EXPORT_KEEP_HOURS` = 24 jam); `GET /exports/jobs` 20 ekspor terakhir. Diproses worker di proses API (tabel `export_jobs`, `FOR UPDATE SKIP LOCKED`, tanpa Redis) atas nama pembuat dengan peran & cakupan terkini; pekerjaan macet > 15 menit diantrekan ulang (maks. 3 kali). Batas `EXPORT_MAX_ROWS` = 200.000 baris.

### Unduhan langsung

`POST /exports` `{ "type": "reports", "format": "xlsx", "filters": { … } }` → `{ "jobId": "…" }`. Ekspor diproses worker.
`GET /exports/:jobId` → status + URL unduh (presigned, 1 jam). Setiap ekspor dicatat di audit log.

## 9. Integrasi Command Center (fase 5)

- Autentikasi: akun `INTEGRASI` dengan *client credentials* (`POST /auth/token`) + allowlist IP.
- `GET /integration/reports?updatedSince=&category=`: data teragregasi/teranonimkan (tanpa NIK dan nama warga).
- `GET /integration/prices?date=`: rekap harga harian per kabupaten.
- Opsional: webhook `report.priority_created` untuk Deteksi Dini urgensi tinggi.

## 10. Rate limit (default)

| Kelompok | Batas |
|---|---|
| `/auth/login` | 10/menit per IP, 5 gagal/15 menit per NRP |
| Endpoint tulis mobile | 120/menit per pengguna |
| Unggah lampiran | 60/menit per pengguna |
| Analitik & ekspor | 30/menit per pengguna |
