# 10 — Keamanan & Perlindungan Data

## 1. Klasifikasi data

| Kelas | Contoh | Perlakuan |
|---|---|---|
| **Sangat sensitif** | NIK, identitas pihak mediasi, isi Deteksi Dini terkait radikalisme/konflik | Enkripsi field (AES-256-GCM), akses dibatasi, setiap baca diaudit |
| **Sensitif** | Nama warga, alamat, foto warga, lokasi absensi | Akses dibatasi wilayah, tidak dikirim ke integrasi luar |
| **Internal** | Data harga pangan, rekap jumlah kegiatan | Dibatasi pengguna terautentikasi |
| **Publik (potensial)** | Rekap harga agregat per kabupaten | Bisa dibagikan setelah persetujuan |

## 2. Autentikasi

- Login NRP + sandi. Sandi minimal 10 karakter dan dicek terhadap daftar sandi umum. Hash memakai **argon2id**.
- Wajib ganti sandi saat login pertama dan setelah reset.
- **MFA (TOTP)** wajib untuk peran web `ADMIN_UNIT`, `SUPERADMIN`, `AUDITOR`. Opsional untuk peran lain.
- Penguncian akun sementara setelah 5 kali gagal.
- Access token 15 menit. Refresh token dirotasi dan dideteksi bila dipakai ulang.
- Admin dapat mencabut perangkat tertentu atau semua sesi seorang pengguna.

## 3. Otorisasi

- RBAC + pembatasan wilayah di backend ([02-peran-hak-akses](02-peran-hak-akses.md)).
- Pengecekan kepemilikan objek pada setiap endpoint `/:id` untuk mencegah IDOR.
- Test otomatis: untuk setiap endpoint, pastikan peran/wilayah lain mendapat 403/404.

## 4. Enkripsi

| Lapisan | Mekanisme |
|---|---|
| Transit | TLS 1.2+ di semua koneksi; certificate pinning di mobile |
| Field sensitif | AES-256-GCM di aplikasi, kunci berversi (`key_id`), rotasi tahunan |
| Pencarian NIK | HMAC-SHA256 terpisah dari kunci enkripsi |
| Database lokal HP | SQLCipher, kunci di Keystore/Keychain |
| Penyimpanan file | Folder di luar web root, hanya dapat dibaca user `lapor`, disajikan lewat API dengan pemeriksaan izin; disk terenkripsi (LUKS) |
| Disk server | LUKS (opsional, sesuai kebijakan) |
| Backup | Terenkripsi (pgBackRest `repo-cipher-type=aes-256-cbc`) |

## 5. Keamanan aplikasi (OWASP)

- Validasi input di backend untuk semua field, dengan skema form sebagai sumber aturan.
- Query terparameter (Prisma / `$queryRaw` dengan template aman). Dilarang menyusun SQL dari string.
- Upload: verifikasi *magic bytes* (bukan hanya ekstensi), batas ukuran, nama objek acak, tanpa eksekusi, tidak disajikan dari domain yang sama dengan web.
- Hapus metadata EXIF dari salinan yang dibagikan (koordinat tetap tersimpan di DB).
- Web: CSP ketat, cookie `httpOnly/Secure/SameSite`, proteksi CSRF untuk aksi BFF.
- Rate limit dan ukuran payload maksimum.
- Dependency scanning (`npm audit`, `osv-scanner`, `flutter pub outdated`) di CI. Paket OS diperbarui rutin (`unattended-upgrades`/`dnf-automatic`).
- Uji penetrasi independen sebelum go-live dan setiap rilis besar.

## 6. Audit

Aksi yang wajib tercatat:

| Kategori | Aksi |
|---|---|
| Autentikasi | `LOGIN`, `LOGIN_FAILED`, `LOGOUT`, `TOKEN_REUSE_DETECTED`, `PASSWORD_CHANGED`, `MFA_ENABLED` |
| Laporan | `REPORT_CREATE`, `REPORT_UPDATE`, `REPORT_SUBMIT`, `REPORT_APPROVE`, `REPORT_REVISION`, `REPORT_REJECT` |
| Data sensitif | `SENSITIVE_READ` (dengan alasan), `EXPORT_CREATE`, `ATTACHMENT_DOWNLOAD` |
| Administrasi | `USER_*`, `UNIT_*`, `VILLAGE_*`, `SCHEMA_PUBLISH`, `DEVICE_REVOKE` |

- Tabel audit hanya boleh ditambah (append-only), dan role database aplikasi tidak memiliki izin `UPDATE/DELETE`.
- Salinan log dikirim ke Loki untuk pemantauan anomali (mis. banyak `SENSITIVE_READ` dari satu akun).

## 7. Kepatuhan UU No. 27/2022 tentang Pelindungan Data Pribadi

| Prinsip | Penerapan |
|---|---|
| Dasar pemrosesan | Pelaksanaan tugas/kewenangan instansi. Perlu dikonfirmasi oleh bagian hukum instansi |
| Minimalisasi | NIK **opsional** dan hanya pada kategori yang membutuhkan. Field tidak perlu dihapus dari skema |
| Pembatasan tujuan | Data hanya untuk tugas Kamtibmas. Integrasi luar hanya menerima data teragregasi/anonim |
| Keamanan | Lihat §2–§6 |
| Retensi | Kebijakan retensi tertulis ([04-database §7](04-database.md#7-partisi--retensi)) |
| Hak subjek data | Prosedur koreksi/penghapusan melalui admin, tercatat di audit |
| Insiden | Prosedur respons insiden + kewajiban notifikasi 3×24 jam |
| DPIA | Lakukan *Data Protection Impact Assessment* sebelum go-live |

## 8. Respons insiden (ringkas)

1. **Deteksi:** alert monitoring / laporan pengguna.
2. **Penahanan:** cabut token/perangkat, blokir IP, nonaktifkan akun.
3. **Investigasi:** audit log, log nginx/aplikasi.
4. **Pemulihan:** patch, rotasi kunci/secrets, restore bila perlu.
5. **Pelaporan:** ke pimpinan & pihak terkait sesuai UU PDP.
6. **Evaluasi:** catatan pasca-insiden.

## 9. Perangkat hilang

1. Bhabin melapor ke admin unit.
2. Admin mencabut perangkat sehingga refresh token tidak berlaku lagi.
3. Data lokal tetap terenkripsi SQLCipher. Laporan yang belum tersinkron dari perangkat tersebut hilang dan perlu dibuat ulang.
