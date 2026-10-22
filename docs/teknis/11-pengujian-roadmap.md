# 11 — Pengujian & Rencana Kerja

## 1. Strategi pengujian

| Level | Cakupan | Alat |
|---|---|---|
| Unit | Validator skema form, penomoran, transisi status, enkripsi, utilitas harga | Jest (backend), `flutter_test`, Vitest (web) |
| Integrasi | Endpoint API dengan PostgreSQL/PostGIS asli | Jest + Supertest + database uji |
| Otorisasi | Matriks peran × endpoint × wilayah (otomatis dari tabel izin) | Jest |
| Sinkron | Simulasi offline, putus di tengah unggah, kirim ganda, konflik revisi | `integration_test` Flutter + server staging |
| E2E web | Login, verifikasi laporan, ekspor, admin pengguna | Playwright |
| E2E mobile | Login → buat laporan per kategori → offline → sinkron | Patrol / `integration_test` di emulator & perangkat fisik |
| Beban | Pilot: 2.000 pengguna, 10 laporan/detik. Nasional: ±400 req/detik berkelanjutan + lonjakan sinkron pagi (dok. 12 §1) | k6 |
| Keamanan | OWASP ASVS L2, pentest independen | ZAP, pentester |
| Lapangan | Uji di desa dengan sinyal lemah/blank spot | Pilot |

Target cakupan test backend minimal 80% untuk modul `reports`, `auth`, `sync`, dan `form-schemas`.

### Skenario wajib sinkron
1. Buat 5 laporan offline (salah satunya dengan 5 foto). Online → semua masuk, tanpa duplikat.
2. Koneksi putus saat foto ke-3 diunggah → lanjut tanpa mengulang foto 1–2.
3. Aplikasi ditutup paksa saat sinkron → sinkron berlanjut pada pembukaan berikutnya.
4. Verifikator meminta revisi → Bhabin menerima catatan → perbaikan → kirim ulang.
5. Skema form diperbarui saat ada draft dengan versi lama → draft tetap dapat dikirim.
6. Jam HP salah 2 hari → laporan diterima dengan penanda selisih waktu.
7. Lokasi palsu aktif → laporan ditandai.

## 2. Rencana kerja

Estimasi untuk tim: 2 backend, 2 Flutter, 1–2 frontend web, 1 QA, 1 DevOps (paruh waktu), 1 PM/analis.

| Fase | Durasi | Hasil |
|---|---|---|
| **0. Persiapan** | 2 minggu | Validasi field form dengan pengguna, data unit & desa, spesifikasi server, keputusan jaringan (VPN vs endpoint publik) |
| **1. Fondasi** | 4 minggu | Repo & CI, server staging (instalasi native), auth + RBAC + wilayah, manajemen pengguna/unit/desa, skema form + renderer dasar (mobile & web) |
| **2. MVP Laporan** | 6 minggu | 7 kategori laporan, kamera + GPS + watermark, offline + sinkron, absensi, daftar & detail laporan di mobile |
| **3. Verifikasi & Dashboard** | 4 minggu | Alur status lengkap, dashboard ringkasan, peta, harga pangan, kinerja, ekspor, audit |
| **4. Pengerasan & Pilot** | 4 minggu | Uji beban & keamanan, pentest, perbaikan, pilot di 1 Polres (±50–100 Bhabin), pelatihan |
| **5. Rollout & Integrasi** | bertahap | Perluasan pilot → Polda → gelombang → nasional ([dok. 12 §6](12-skala-nasional.md#6-tahapan-menuju-nasional)), API Command Center, analitik korelasi, MFA penuh |

Total menuju pilot: **±20 minggu**.

### Kriteria siap pilot
- Semua skenario wajib sinkron lolos di perangkat Android acuan & iPhone.
- Tidak ada temuan pentest berisiko tinggi yang terbuka.
- Backup & restore teruji.
- Panduan pengguna (Bhabin & verifikator) dan materi pelatihan tersedia.

### Indikator keberhasilan pilot
| Indikator | Target |
|---|---|
| Bhabin aktif mengirim laporan mingguan | ≥ 90% |
| Laporan tersinkron ≤ 1 jam setelah dibuat (saat ada sinyal) | ≥ 95% |
| Crash-free sessions | ≥ 99,5% |
| Waktu rata-rata verifikasi | ≤ 24 jam |
| Absensi di dalam desa binaan | ≥ 85% |

## 3. Dokumen pendukung yang perlu dibuat berikutnya
1. Panduan pengguna Bhabin (bergambar, untuk HP).
2. Panduan verifikator & admin.
3. SOP operasional: reset sandi, perangkat hilang, penambahan Bhabin baru, mutasi.
4. Runbook operasi server (deploy, backup/restore, insiden).
5. DPIA (penilaian dampak pelindungan data).

## 4. Isu terbuka

| No | Isu | Pemilik keputusan | Dampak |
|---|---|---|---|
| 1 | Pengesahan field resmi tiap kategori | Pengguna/instansi | Skema form v1 |
| 2 | Akses HP lapangan ke server internal: VPN atau endpoint publik terbatas | TI instansi | Arsitektur jaringan, keandalan sinkron |
| 3 | Push notification via FCM/APNs diizinkan? | TI/keamanan instansi | Fitur notifikasi |
| 4 | Sumber data batas desa (Kemendagri/BIG/BPS) dan ketersediaannya | Analis | Fitur dalam/luar desa binaan |
| 5 | Data awal pengguna (NRP, unit, desa binaan) dan format impor | Admin instansi | Onboarding |
| 6 | Apakah NIK benar-benar wajib, dan dasar hukum pemrosesannya | Hukum instansi | Skema form & kepatuhan PDP |
| 7 | Kategori mana yang perlu verifikasi manual vs `auto_approve` | Pengguna | Beban verifikator |
| 8 | Spesifikasi server internal & storage | TI instansi | Kapasitas |
| 9 | Akun Apple untuk distribusi iOS (ABM / Enterprise) | Instansi | Ketersediaan di iOS |
| 10 | Tile peta offline / server peta internal | TI instansi | Fitur peta |
| 11 | Format integrasi Command Center Baharkam | Baharkam | Fase 5 |
| 12 | Hosting nasional, object storage, orkestrasi container ([dok. 12 §8](12-skala-nasional.md#8-keputusan-yang-dibutuhkan-dari-instansi)) | TI Polri | Arsitektur nasional |
| 13 | Jumlah resmi Bhabin & target pelaporan harian | Baharkam | Kapasitas & indikator kinerja |
