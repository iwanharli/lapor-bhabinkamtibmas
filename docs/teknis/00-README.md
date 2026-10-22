# Dokumentasi Teknis — Aplikasi Pelaporan Bhabinkamtibmas

Versi 0.2 · 22 Oktober 2026 · Status: **Draf untuk ditinjau**

Aplikasi terpadu untuk pelaporan kegiatan harian Bhabinkamtibmas, pemantauan harga pangan, dan absensi lapangan. Terdiri dari aplikasi mobile (Android & iOS), dashboard web, dan backend di server internal.

## Daftar dokumen

| No | Dokumen | Isi |
|---|---|---|
| 01 | [Arsitektur](01-arsitektur.md) | Komponen sistem, stack teknologi, aliran data |
| 02 | [Peran & Hak Akses](02-peran-hak-akses.md) | Peran pengguna, hierarki wilayah, matriks izin |
| 03 | [Modul Laporan](03-modul-laporan.md) | Spesifikasi 7 kategori laporan + absensi, field, alur status, penomoran |
| 04 | [Database](04-database.md) | Skema PostgreSQL + PostGIS, indeks, enkripsi |
| 05 | [API](05-api.md) | Endpoint REST, format request/response, error |
| 06 | [Backend (NestJS)](06-backend-nestjs.md) | Struktur modul, job antrean, konvensi kode |
| 07 | [Aplikasi Mobile (Flutter)](07-mobile-flutter.md) | Layar, offline & sinkron, kamera & GPS |
| 08 | [Dashboard Web (Next.js)](08-web-nextjs.md) | Halaman, komponen, peta & grafik |
| 09 | [Deployment Server Internal](09-deployment.md) | Instalasi native (systemd), jaringan, backup, monitoring |
| 10 | [Keamanan & Perlindungan Data](10-keamanan.md) | Autentikasi, enkripsi, audit, UU PDP |
| 11 | [Pengujian & Rencana Kerja](11-pengujian-roadmap.md) | Strategi uji, fase pengembangan, isu terbuka |
| 12 | [Skala Nasional](12-skala-nasional.md) | Asumsi beban nasional, arsitektur target, perubahan aplikasi, tahapan |

Ringkasan satu halaman: [../RANCANGAN_TEKNIS.md](../RANCANGAN_TEKNIS.md).

## Keputusan dasar

| Aspek | Keputusan |
|---|---|
| Cakupan modul | Gabungan proposal + demo SIMPEL: 7 kategori laporan + absensi |
| Aplikasi lapangan | Flutter (Android & iOS) |
| Dashboard | Next.js (React, TypeScript) |
| Backend | NestJS (TypeScript) |
| Database | PostgreSQL 16 + PostGIS |
| Penyimpanan file | Disk server (driver `local`), opsional S3/MinIO |
| Antrean | pg-boss (di PostgreSQL, tanpa Redis) |
| Hosting | Pilot: server internal, instalasi native (systemd + Nginx). Nasional: klaster di pusat data Polri (lihat dok. 12) |
| Skala | **Nasional** — seluruh Bhabinkamtibmas (±50.000, perkiraan) |
| Zona waktu | Per unit (WIB/WITA/WIT); penyimpanan UTC |

## Dokumen sumber

- *Proposal Teknis – Aplikasi Mobile Pelaporan Terpadu Bhabinkamtibmas* (PDF)
- *Paket 3 Demo SIMPEL*: Sistem 01 Dashboard Admin & Sistem 02 Pelaporan Bhabinkamtibmas (ZIP)

Dokumen lain di folder `docs/` (proposal Satpam & Debt Collector, laporan PLTN/Rosatom) **tidak termasuk** cakupan proyek ini.

## Istilah

| Istilah | Arti |
|---|---|
| Bhabin / Bhabinkamtibmas | Bhayangkara Pembina Keamanan dan Ketertiban Masyarakat, petugas Polri di tingkat desa/kelurahan |
| Desa binaan | Desa/kelurahan yang menjadi wilayah tugas seorang Bhabin |
| DDS | Door to Door System, kunjungan sambang ke rumah warga |
| Baharkam | Badan Pemelihara Keamanan Polri |
| Command Center | Dashboard pimpinan Baharkam yang akan menarik data dari sistem ini |
| Offline-first | Aplikasi tetap berfungsi tanpa internet; data dikirim saat koneksi tersedia |
| RBAC | Role-Based Access Control, hak akses berdasarkan peran |
| NRP | Nomor Registrasi Pokok anggota Polri |
