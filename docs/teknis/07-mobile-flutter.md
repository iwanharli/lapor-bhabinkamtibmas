# 07 — Aplikasi Mobile (Flutter)

## 1. Target

| Hal | Ketentuan |
|---|---|
| Platform | Android 8.0+ (API 26), iOS 14+ |
| Perangkat acuan | Android kelas menengah-bawah (RAM 3 GB), layar 5,5–6,7" |
| Bahasa UI | Bahasa Indonesia |
| Pengguna | Peran `BHABIN` saja |

## 2. Stack & paket

| Kebutuhan | Paket |
|---|---|
| State management | `flutter_riverpod` |
| Routing | `go_router` |
| HTTP | `dio` (+ interceptor auth/refresh, retry) |
| Database lokal | `drift` + `sqlcipher_flutter_libs` (terenkripsi) |
| Penyimpanan kunci | `flutter_secure_storage` (Keystore/Keychain) |
| Kamera | `camera` (kamera internal, tanpa galeri untuk bukti) |
| Kompres & watermark | `image` / `flutter_image_compress` + render teks di Canvas |
| Lokasi | `geolocator` (akurasi, `isMocked` di Android) |
| Konektivitas | `connectivity_plus` |
| Sinkron latar | `workmanager` (Android), `background_fetch` / BGTaskScheduler (iOS) |
| Notifikasi | `firebase_messaging` atau polling `GET /sync/reports` jika FCM tidak diizinkan (lihat §8) |
| Peta (opsional) | `flutter_map` + tile server internal |
| Form dinamis | Renderer internal dari skema JSON |
| Lainnya | `uuid`, `intl`, `crypto` (SHA-256), `package_info_plus`, `device_info_plus` |

## 3. Struktur proyek

```
mobile/lib/
├── main.dart
├── app/                 # router, tema, DI (provider)
├── core/
│   ├── api/             # Dio client, interceptor, model error
│   ├── db/              # Drift database, tabel, DAO
│   ├── sync/            # SyncEngine, antrean, kebijakan retry
│   ├── location/        # LocationService
│   ├── camera/          # CaptureService + watermark
│   └── security/        # secure storage, root/jailbreak check
├── features/
│   ├── auth/
│   ├── home/
│   ├── reports/
│   │   ├── form_renderer/   # widget per tipe field
│   │   ├── create/
│   │   ├── list/
│   │   └── detail/
│   ├── attendance/
│   └── profile/
└── l10n/
```

## 4. Layar

| # | Layar | Isi utama |
|---|---|---|
| 1 | Splash & cek versi | Cek `minAppVersion`, paksa update bila perlu |
| 2 | Login | NRP, sandi; ganti sandi saat login pertama |
| 3 | Beranda | Sapaan, status absensi hari ini (tombol Check-in/out), indikator sinkron (✔ tersinkron / ⏳ n antrean / ⚠ gagal), kartu 7 kategori, ringkasan laporan minggu ini |
| 4 | Pilih desa | Jika Bhabin membina > 1 desa |
| 5 | Form laporan | Dirender dari skema; GPS otomatis di header (akurasi & status), tombol *Simpan draft* & *Kirim* |
| 6 | Kamera | Ambil foto, pratinjau dengan watermark, ulangi |
| 7 | Harga pangan | Daftar komoditas dengan input numpad Rupiah + pilihan stok (chip Aman/Menipis/Kosong) |
| 8 | Laporan saya | Tab: Draft · Antrean · Terkirim · Perlu Revisi; filter kategori |
| 9 | Detail laporan | Isian, foto, status & catatan verifikator, tombol *Perbaiki* bila revisi |
| 10 | Absensi | Kamera depan + lokasi + hasil (di dalam/luar desa binaan) |
| 11 | Profil | Data diri, desa binaan, versi aplikasi, *Sinkron sekarang*, *Keluar* |

## 5. Offline & sinkronisasi

### 5.1 Tabel lokal (Drift)

```
local_reports     (client_uuid PK, server_id, nomor, category, schema_version, village_id,
                   data_json, sensitive_json, occurred_at, lat, lng, accuracy, is_mock,
                   local_status[DRAFT|QUEUED|SYNCING|SYNCED|FAILED], server_status,
                   review_note, last_error, attempts, updated_at)
local_attachments (client_uuid PK, report_uuid, field_key, file_path, sha256, mime, size,
                   captured_at, lat, lng, uploaded bool, attempts)
local_attendances (client_uuid PK, type, client_time, lat, lng, accuracy, is_mock,
                   selfie_path, synced bool)
cache_schemas, cache_commodities, cache_villages, sync_state(key, value)
```

### 5.2 SyncEngine

```
pemicu: koneksi kembali | aplikasi dibuka | tiap 15 menit (latar) | tombol manual
loop:
  1. kirim absensi yang belum tersinkron
  2. untuk setiap laporan QUEUED (prioritas dulu, lalu terlama):
       a. POST /reports            (idempoten via client_uuid) → simpan server_id, nomor
       b. POST /attachments        per file yang belum terunggah
       c. POST /reports/:id/submit
       d. tandai SYNCED, hapus file lokal setelah 7 hari
  3. GET /sync/reports?since=      → perbarui status & catatan revisi
  4. GET /sync/master?since=       → perbarui skema/komoditas/desa
gagal: backoff 30s → 1m → 5m → 15m → 1j (maks.), simpan last_error
error 4xx validasi → FAILED, tampilkan ke pengguna untuk diperbaiki (tidak diulang otomatis)
```

- Hanya satu sinkron berjalan pada satu waktu (mutex).
- Opsi "Unggah foto hanya via Wi-Fi" **tidak** disediakan di MVP karena laporan harus segera masuk.
- Saat logout, aplikasi memperingatkan bila masih ada antrean. Data lokal dihapus setelah konfirmasi.

## 6. Kamera, GPS & watermark

1. Saat form dibuka: minta lokasi akurasi tinggi, tunggu hingga akurasi ≤ 50 m atau maks. 30 detik. Jika tidak tercapai, gunakan titik terbaik dan tandai akurasi rendah.
2. Jika `isMocked = true` (Android): laporan tetap bisa disimpan tetapi ditandai, dan pengguna diberi peringatan.
3. Foto diambil dari kamera internal. Gambar diperkecil ke 1600 px, lalu watermark dibakar di pojok bawah:
   ```
   22/10/2026 07:42:13 WIB
   -6.595123, 106.816234 (±8 m)
   Ds. Sukamaju, Kec. Contoh
   Bripka Contoh · 87010123
   ```
4. SHA-256 dihitung dari file akhir (setelah watermark).
5. Untuk field `file` (dokumen kesepakatan), pemilihan dari galeri/berkas diizinkan dengan `source = FILE`.

## 7. Keamanan perangkat

- Token disimpan di `flutter_secure_storage`. Kunci SQLCipher dibuat acak saat instalasi dan disimpan di Keystore/Keychain.
- Opsional: kunci aplikasi dengan PIN/biometrik setelah tidak aktif 15 menit.
- Deteksi root/jailbreak hanya sebagai peringatan dan audit (tidak memblokir di MVP).
- *Certificate pinning* ke sertifikat server internal.
- Screenshot diblokir pada layar yang memuat NIK (`FLAG_SECURE` di Android).
- File foto disimpan di direktori privat aplikasi, bukan di galeri.

## 8. Notifikasi

Server internal mungkin tidak boleh bergantung pada Firebase/Apple:
- **Opsi A (default):** FCM untuk Android dan APNs untuk iOS. Payload hanya berisi ID (tanpa isi laporan).
- **Opsi B (tanpa layanan luar):** tanpa push. Aplikasi mengecek `GET /sync/reports` saat dibuka dan pada sinkron latar.

Keputusan bergantung pada kebijakan jaringan instansi (lihat [11 — isu terbuka](11-pengujian-roadmap.md#4-isu-terbuka)).

## 9. Distribusi

| Platform | Opsi |
|---|---|
| Android | Google Play (Managed/Private app) atau APK internal + MDM. Pembaruan dipaksa via `minAppVersion` |
| iOS | Apple Business Manager (Custom App) atau Apple Developer Enterprise Program (perlu syarat organisasi) |

Build flavor: `dev`, `staging`, `prod` (URL server & ikon berbeda).
