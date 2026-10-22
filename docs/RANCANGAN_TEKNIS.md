# Rancangan Teknis — Aplikasi Pelaporan Bhabinkamtibmas

Versi draf 0.1 · 22 Oktober 2026

> Ringkasan satu halaman. Dokumentasi lengkap ada di [teknis/00-README.md](teknis/00-README.md); jika ada perbedaan, dokumen di `teknis/` yang berlaku.

Sumber acuan:
- *Proposal Teknis – Aplikasi Mobile Pelaporan Bhabinkamtibmas* (PDF)
- *Paket 3 Demo SIMPEL* — Sistem 01 (Dashboard Admin) & Sistem 02 (Pelaporan Bhabinkamtibmas)

Keputusan dasar:
| Aspek | Keputusan |
|---|---|
| Cakupan modul | Gabungan proposal + demo (7 kategori laporan + absensi) |
| Aplikasi lapangan | Flutter (Android & iOS) |
| Dashboard | Web (Next.js) |
| Hosting | Server internal (on-premise) |

---

## 1. Arsitektur

```
┌───────────────────────┐        ┌───────────────────────┐
│  Aplikasi Flutter      │        │  Dashboard Web         │
│  (Bhabinkamtibmas)     │        │  (Next.js)             │
│  - SQLite lokal        │        │  Admin, Verifikator,   │
│  - Antrean sinkron     │        │  Pimpinan, Auditor     │
└──────────┬────────────┘        └──────────┬────────────┘
           │ HTTPS (REST + JWT)              │
           ▼                                 ▼
┌─────────────────────────────────────────────────────────┐
│  Reverse proxy (Nginx) — server internal                 │
├─────────────────────────────────────────────────────────┤
│  API Backend (NestJS)                                     │
│  Auth & RBAC · Laporan · Sinkron · Wilayah · Audit       │
├──────────────┬──────────────┬───────────────────────────┤
│ PostgreSQL + PostGIS │ Disk server   │ Antrean pg-boss    │
│ + PostGIS    │ (foto/file)  │ (proses foto, notifikasi)  │
└──────────────┴──────────────┴───────────────────────────┘
```

Semua komponen dipasang langsung di server internal (systemd + Nginx), tanpa Docker. Antrean memakai pg-boss di PostgreSQL dan file disimpan di disk server, sehingga server cukup berisi Node.js, PostgreSQL, dan Nginx.

## 2. Peran & hak akses

| Peran | Platform | Hak |
|---|---|---|
| `BHABIN` | Mobile (+ web cadangan) | Buat/edit draft, kirim, lihat laporan sendiri, absensi |
| `VERIFIKATOR` | Web | Tinjau laporan dalam wilayahnya: setujui, tolak, minta revisi |
| `PIMPINAN` | Web | Lihat dashboard, peta, grafik wilayahnya (read-only) |
| `ADMIN` | Web | Kelola pengguna, wilayah, master data (kategori, komoditas), konfigurasi form |
| `AUDITOR` | Web | Lihat audit log & ekspor |

Cakupan data dibatasi per wilayah berjenjang: **Mabes → Polda → Polres → Polsek → Desa/Kelurahan binaan**. Pengguna hanya melihat data di bawah unitnya. Pemeriksaan dilakukan di backend.

## 3. Modul laporan

Semua laporan memiliki **field umum**: nomor, kategori, Bhabin, desa binaan, waktu kegiatan, koordinat GPS, akurasi GPS, lampiran, status.

### 3.1 Sambang / DDS *(proposal)*
- Nama warga/tokoh*, NIK (opsional, terenkripsi)
- Jenis sasaran* (Warga, Tokoh Masyarakat, Tokoh Agama, Perangkat Desa)
- Kategori pesan Kamtibmas* (Pencurian, Penipuan, Narkoba, Karhutla, Lainnya)
- Tanggapan masyarakat*
- Foto bersama warga* (watermark GPS & waktu)

### 3.2 Deteksi Dini / Informasi Khusus *(proposal)*
- Kategori kerawanan* (Sengketa lahan, Gesekan antarkelompok, Radikalisme, Bencana alam, Lainnya)
- Tingkat urgensi* (Rendah, Sedang, Tinggi). Laporan dengan urgensi **Tinggi** memicu notifikasi ke verifikator dan pimpinan
- Uraian* (maks. 500 karakter)
- Foto kondisi lapangan*

### 3.3 Problem Solving / Mediasi *(proposal)*
- Identitas Pihak 1* & Pihak 2* (nama, NIK opsional terenkripsi)
- Pokok masalah* (Batas tanah, Perkelahian, Utang-piutang ringan, KDRT non-fisik, Lainnya)
- Hasil mediasi* (Sepakat damai, Lanjut proses hukum)
- Foto/dokumen surat kesepakatan

### 3.4 Penyuluhan & Pembinaan *(proposal, triwulanan)*
- Jenis kegiatan* (Pembinaan Siskamling, Penyuluhan tematik)
- Tema (mis. antinarkoba)
- Lokasi poskamling / balai desa*
- Foto stiker verifikasi*

### 3.5 Pemantauan Harga Pangan *(proposal + demo "Kios & Harga")*
Satu laporan memuat **banyak komoditas**:
- Nama pasar*, nama kios, nama pemilik kios
- Daftar item harga: komoditas* (dari master), harga (Rp)*, satuan, status stok* (Aman, Menipis, Kosong)
- Foto etalase/kios*

Master komoditas awal: Beras Medium, Beras Premium, Minyak Goreng Curah, Minyak Goreng Kemasan, Gula Pasir, Cabai Merah, Telur Ayam, Daging Sapi, Daging Ayam, Bawang Merah, Bawang Putih.

### 3.6 Mapping Kepala Keluarga *(demo)*
- Nama kepala keluarga*, jumlah anggota*, alamat/RT-RW*
- Kondisi hunian* (Layak, Perlu perhatian, Dalam pemantauan)
- Catatan

### 3.7 Ketahanan Pangan *(demo)*
- Komoditas/usaha pangan*, luas lahan (ha)*, estimasi produksi (ton)*
- Kondisi kegiatan* (Berjalan, Perlu pendampingan, Terhambat)
- Temuan lapangan

### 3.8 Absensi Lapangan *(proposal)*
- Check-in / check-out dengan selfie, koordinat GPS, dan waktu server
- Ditandai apakah lokasi berada di dalam batas desa binaan (PostGIS)

> **Form berbasis konfigurasi.** Definisi field tiap kategori disimpan sebagai skema JSON versi-an di backend (`form_schemas`). Aplikasi Flutter dan dashboard merender form dari skema ini, sehingga perubahan field tidak memerlukan rilis ulang aplikasi. Isian disimpan di kolom `data JSONB`, dan setiap laporan mencatat versi skema yang dipakai.

## 4. Alur status laporan

```
DRAFT ──kirim──► SUBMITTED ──tinjau──► IN_REVIEW ──► APPROVED
  ▲                                       │
  └────────── NEEDS_REVISION ◄────────────┤
                                          └──► REJECTED
```
- `DRAFT` hanya ada di perangkat/milik Bhabin dan bisa diedit.
- `NEEDS_REVISION` mengembalikan laporan ke Bhabin dengan catatan verifikator.
- Setiap perubahan status dicatat di `report_status_history` dan `audit_logs`.
- Nomor laporan diterbitkan server: `LAP-{KODE_POLRES}-{YYYYMM}-{urut}`. Selama offline, perangkat memakai UUID lokal.

## 5. Mode offline & sinkronisasi (Flutter)

- Penyimpanan lokal: **Drift (SQLite)** untuk laporan & antrean, file foto di storage aplikasi.
- Setiap laporan memiliki `client_uuid` yang dibuat perangkat, sehingga pengiriman ulang tidak menghasilkan duplikat (idempoten).
- Antrean sinkron: berjalan otomatis saat koneksi kembali (`connectivity_plus` + `workmanager`), dengan percobaan ulang bertahap.
- Urutan unggah: metadata laporan, lalu tiap lampiran (unggah per file, bisa dilanjutkan), lalu konfirmasi `SUBMITTED`.
- Master data (kategori, skema form, komoditas, wilayah) diunduh dan di-cache, lalu diperbarui berdasarkan versi.

## 6. Bukti lapangan (anti-manipulasi)

- Foto **hanya dari kamera** di dalam aplikasi (tanpa galeri) untuk field bukti utama.
- Watermark dibakar ke gambar: tanggal-jam, koordinat, nama desa, nama Bhabin.
- Metadata yang ikut dikirim: waktu perangkat, akurasi GPS, flag *mock location* (Android).
- Server mencatat waktu terima. Selisih besar antara waktu perangkat dan server ditandai.
- Hash SHA-256 file disimpan untuk memeriksa integritas.

## 7. Skema database (ringkas)

```
units            (id, parent_id, level[MABES|POLDA|POLRES|POLSEK], kode, nama)
villages         (id, kode_bps, nama, kecamatan, kabupaten, provinsi, geom MULTIPOLYGON)
users            (id, nrp, nama, pangkat, role, unit_id, phone, password_hash, active)
user_villages    (user_id, village_id)                 -- desa binaan Bhabin
form_schemas     (id, category, version, schema JSONB, active)
reports          (id, client_uuid UNIQUE, nomor, category, schema_version,
                  user_id, unit_id, village_id, status, data JSONB,
                  occurred_at, location GEOGRAPHY(Point), gps_accuracy,
                  submitted_at, created_at, updated_at)
report_items     (id, report_id, commodity_id, harga, satuan, stok_status)  -- harga pangan
commodities      (id, nama, satuan_default, active)
attachments      (id, report_id, object_key, mime, size, sha256,
                  captured_at, location, watermarked)
report_status_history (id, report_id, from_status, to_status, actor_id, note, at)
attendances      (id, user_id, type[IN|OUT], at, location, inside_village, photo_id)
audit_logs       (id, actor_id, action, entity, entity_id, meta JSONB, ip, at)
```
- NIK & identitas pihak disimpan terenkripsi di tingkat aplikasi (AES-256-GCM). Hanya peran tertentu yang dapat membukanya.
- Item harga pangan dipisahkan ke `report_items` agar mudah dianalisis tren per komoditas/wilayah.

## 8. API utama (REST, prefix `/api/v1`)

| Endpoint | Fungsi |
|---|---|
| `POST /auth/login`, `/auth/refresh` | Login NRP + sandi, JWT access & refresh |
| `GET /master/sync?since=` | Unduh master data (skema form, komoditas, desa binaan) |
| `POST /reports` | Buat/kirim laporan (idempoten via `client_uuid`) |
| `PATCH /reports/:id` | Ubah draft / revisi |
| `POST /reports/:id/attachments` | Unggah lampiran |
| `GET /reports` | Daftar laporan dengan filter & cakupan wilayah |
| `POST /reports/:id/transition` | Ubah status (verifikator) |
| `POST /attendances` | Absensi |
| `GET /analytics/*` | Agregat untuk dashboard (jumlah, peta, tren harga) |
| `GET /exports/reports.csv` | Ekspor |
| `GET /integration/*` | Endpoint baca untuk Command Center Baharkam (API key, read-only) |

## 9. Layar

**Aplikasi Flutter (Bhabin)**
1. Login
2. Beranda: ringkasan, tombol absensi, status sinkron, pintasan kategori
3. Pilih kategori, lalu form dinamis (kamera, GPS otomatis)
4. Draft & antrean kirim
5. Riwayat laporan + detail + catatan revisi
6. Absensi (check-in/out)
7. Profil & desa binaan

**Dashboard Web**
1. Login
2. Ringkasan: jumlah laporan per kategori/status/wilayah, laporan urgensi tinggi
3. Peta sebaran laporan & absensi
4. Daftar laporan + detail + aksi verifikasi
5. Pemantauan harga pangan: tabel & grafik tren per komoditas/wilayah
6. Rekap kinerja Bhabin (jumlah kegiatan, kehadiran)
7. Manajemen pengguna, unit, desa binaan
8. Master data & konfigurasi form
9. Audit log & ekspor

## 10. Keamanan

- HTTPS di jaringan internal, dan sertifikat dipin pada aplikasi mobile.
- JWT access token berumur pendek + refresh token yang dirotasi. Perangkat dapat dicabut aksesnya dari dashboard.
- RBAC + pembatasan wilayah di setiap query backend.
- Enkripsi data sensitif (NIK), file di folder privat server, unduhan hanya lewat API dengan pemeriksaan izin.
- Database lokal di HP dienkripsi (SQLCipher).
- Audit log untuk semua aksi tulis dan akses data sensitif.
- Backup harian PostgreSQL & folder file.

## 11. Struktur repositori (usulan)

```
lapor-bhabinkamtibmas/
├── docs/
├── backend/        # NestJS + Prisma/TypeORM
├── web/            # Next.js dashboard
├── mobile/         # Flutter app
└── infra/          # systemd, nginx, skrip install/backup
```

## 12. Tahapan

| Fase | Isi |
|---|---|
| 1. Fondasi | Infra server (native), auth & RBAC, unit/wilayah/pengguna, skema form |
| 2. MVP laporan | 8 kategori, draft/kirim, lampiran, offline & sinkron, absensi |
| 3. Verifikasi & dashboard | Alur status, daftar & detail, peta, harga pangan, ekspor |
| 4. Pengerasan | Keamanan, audit, uji lapangan (pilot 1 Polres), perbaikan |
| 5. Integrasi | API Command Center, analitik korelasi lintas modul |

## 13. Hal yang masih perlu dipastikan

1. Field resmi tiap kategori: field di atas masih usulan dan perlu divalidasi oleh pengguna/instansi.
2. Sumber data wilayah & batas desa (BPS / Kemendagri) untuk PostGIS.
3. Data pengguna awal: impor NRP, unit, dan desa binaan.
4. Apakah NIK benar-benar wajib dikumpulkan (pertimbangan UU PDP).
5. Spesifikasi server internal (CPU, RAM, storage foto) dan akses jaringan HP lapangan ke server internal (VPN atau endpoint publik terbatas).
6. Distribusi aplikasi iOS (App Store / Apple Business Manager) dan Android (Play Store / APK internal).
