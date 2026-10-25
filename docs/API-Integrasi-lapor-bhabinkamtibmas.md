# Spesifikasi API Integrasi untuk lapor-bhabinkamtibmas

Untuk: pengembang repo `iwanharli/lapor-bhabinkamtibmas`
Dari: tim Baharkam Command Center (Pusat)
Status: usulan v0.1, untuk dibahas dan disepakati bersama

## 1. Latar belakang

Aplikasi lapor-bhabinkamtibmas dipasang di setiap Polda. Baharkam Command Center (Pusat) hanya **memantau**: menarik data dari semua instance Polda dan menampilkannya. Pusat tidak menulis apa pun ke instance Polda.

Agar Pusat bisa menarik data, setiap instance perlu menyediakan 7 endpoint baca-saja di bawah `/integration/*` (rencana ini sudah disebut di dokumen 05-api bagian 9 repo Anda, tetapi belum dibangun).

Data ini dipakai untuk: Ringkasan Command Center, Profil Wilayah, Laporan Executive, menu Bhabinkamtibmas (dasbor, peta, kinerja, absensi, laporan, keluarga, stunting, bulanan, notifikasi) dan menu Harga Pangan (dasbor, tren, sebaran, tabel).

## 2. Aturan umum semua endpoint

| Hal | Ketentuan |
|---|---|
| Protokol | HTTPS saja |
| Metode | `GET` saja. Tidak ada tulis, ubah, atau hapus |
| Autentikasi | Header `Authorization: Bearer <token>`. Token khusus klien "Pusat", hak baca-saja, bisa dirotasi, dapat dicabut |
| Pembatasan | Daftar IP yang diizinkan (IP server Pusat). Batas laju minimal 60 permintaan per menit |
| Pemilik token | Superadmin instance membuat dan mengelola token. Klien Pusat memakai token bearer untuk membaca API; tidak perlu akun Integrasi terpisah |
| Format | JSON, UTF-8. Waktu dalam ISO 8601 beserta zona waktu, contoh `2026-10-25T08:30:00+07:00` |
| Paginasi | Kursor. Parameter `limit` (bawaan 500, maksimal 2000) dan `cursor`. Respons memuat `nextCursor` (null bila habis) |
| Sinkron bertahap | Parameter `updatedSince` (ISO 8601). Hanya baris yang dibuat atau diubah sejak waktu itu. Wajib ada kolom `updatedAt` di setiap baris |
| Data terhapus | Endpoint yang mendukung `updatedSince` juga mengembalikan baris yang dihapus dengan `deleted: true` agar Pusat bisa ikut menghapus |
| Urutan | Stabil berdasarkan `updatedAt` lalu `id` |
| Kesalahan | `401` token salah, `403` IP atau peran tidak diizinkan, `429` terlalu sering, `400` parameter salah. Isi: `{ "error": { "code": "...", "message": "..." } }` |
| Pencatatan | Setiap pemanggilan dicatat di log audit instance (waktu, endpoint, parameter, jumlah baris) |

Bentuk respons daftar:

```json
{
  "data": [ ... ],
  "nextCursor": "eyJ1IjoiMjAyNi0xMC0yNVQwODozMDowMFoiLCJpIjoxMjN9",
  "generatedAt": "2026-10-25T16:00:00+07:00"
}
```

## 3. Daftar endpoint

### 3.1 `GET /integration/units`

Pohon unit organisasi instance ini beserta zona waktu. Tidak perlu `updatedSince`; datanya kecil.

```json
{
  "data": [
    { "id": "POLDA-JATIM", "level": "POLDA", "nama": "Polda Jawa Timur", "parentId": null, "zonaWaktu": "Asia/Jakarta" },
    { "id": "POLRES-0101", "level": "POLRES", "nama": "Polrestabes Surabaya", "parentId": "POLDA-JATIM", "zonaWaktu": "Asia/Jakarta" },
    { "id": "POLSEK-010101", "level": "POLSEK", "nama": "Polsek Gubeng", "parentId": "POLRES-0101", "zonaWaktu": "Asia/Jakarta" }
  ]
}
```

Kolom: `id`, `level` (`POLDA` | `POLRES` | `POLSEK`), `nama`, `parentId`, `zonaWaktu` (IANA), `kodePolda` (kode resmi Polda, untuk pemetaan di Pusat).

### 3.2 `GET /integration/villages`

Desa/kelurahan binaan. Mendukung `updatedSince`.

```json
{
  "data": [
    {
      "id": "DESA-3578010001",
      "nama": "Gubeng",
      "kodeKabupaten": "3578",
      "kodeKecamatan": "357801",
      "kodeDesa": "3578010001",
      "lat": -7.2756,
      "lng": 112.7508,
      "polsekId": "POLSEK-010101",
      "bhabinId": "BHB-0001",
      "updatedAt": "2026-10-20T10:00:00+07:00"
    }
  ]
}
```

Kode wilayah mengikuti Kemendagri (kabupaten 4 digit, kecamatan 6 digit, desa 10 digit). Kode ini menjadi kunci pertemuan antar sumber di Pusat.

### 3.3 `GET /integration/bhabins`

Data Bhabinkamtibmas. Mendukung `updatedSince`.

```json
{
  "data": [
    {
      "id": "BHB-0001",
      "pangkat": "BRIPKA",
      "nama": "Budi Santoso",
      "nrp": "85010123",
      "polsekId": "POLSEK-010101",
      "desaIds": ["DESA-3578010001"],
      "aktif": true,
      "updatedAt": "2026-10-20T10:00:00+07:00"
    }
  ]
}
```

Tidak perlu nomor telepon, alamat rumah, atau data pribadi lain.

### 3.4 `GET /integration/reports?updatedSince=&category=`

Laporan kegiatan Bhabin. Mendukung `updatedSince`, `category`, `from`, `to` (rentang tanggal laporan).

Kategori yang dipakai Pusat: `SAMBANG`, `DETEKSI_DINI`, `PROBLEM_SOLVING`, `HARGA_PANGAN`, `MAPPING_KK`, `KETAHANAN_PANGAN`.

```json
{
  "data": [
    {
      "id": "LAP-20261025-0042",
      "kategori": "DETEKSI_DINI",
      "waktu": "2026-10-25T09:12:00+07:00",
      "judul": "Potensi gesekan antarwarga",
      "urgensi": "TINGGI",
      "prioritas": true,
      "lat": -7.2761,
      "lng": 112.7519,
      "akurasiGps": 12,
      "lokasiDicek": false,
      "desaId": "DESA-3578010001",
      "bhabinId": "BHB-0001",
      "jumlahFoto": 3,
      "isian": { "...": "sesuai skema form kategori" },
      "updatedAt": "2026-10-25T09:15:00+07:00",
      "deleted": false
    }
  ]
}
```

Catatan:
- `urgensi`: `RENDAH` | `SEDANG` | `TINGGI` (hanya untuk `DETEKSI_DINI`).
- `prioritas`: boolean, sesuai tanda prioritas yang sudah ada.
- `lokasiDicek`: `true` bila lokasi dicurigai dan perlu diperiksa (misalnya lokasi palsu atau di luar desa binaan).
- `isian`: objek bebas mengikuti skema form tiap kategori. Mohon sertakan versi skema di `skemaVersi`.
- **Nomor KK dan nama anggota keluarga di rincian laporan `MAPPING_KK`:** keputusan Pusat adalah menampilkannya apa adanya untuk kebutuhan pementaan penerima manfaat. Mohon kirim dalam bentuk terdekripsi lewat kanal terenkripsi (HTTPS). Data kesehatan per orang (status stunting, risiko ibu hamil) **tidak** perlu dikirim; cukup lewat ringkasan di 3.7.
- Foto tidak dikirim di respons; cukup `jumlahFoto` dan, bila Pusat perlu menampilkan, tautan bertanda tangan sementara di endpoint terpisah (dibahas kemudian).

### 3.5 `GET /integration/attendance?date=`

Absensi harian Bhabin. Parameter `date` (YYYY-MM-DD) atau `from`/`to`. Mendukung `updatedSince`.

```json
{
  "data": [
    {
      "id": "ABS-20261025-BHB-0001",
      "bhabinId": "BHB-0001",
      "tanggal": "2026-10-25",
      "jamMasuk": "2026-10-25T07:55:00+07:00",
      "jamPulang": "2026-10-25T16:05:00+07:00",
      "lokasiMasuk": { "lat": -7.2757, "lng": 112.7509, "didalamDesa": true },
      "lokasiPulang": { "lat": -7.2759, "lng": 112.7511, "didalamDesa": true },
      "lokasiPalsu": false,
      "updatedAt": "2026-10-25T16:06:00+07:00"
    }
  ]
}
```

### 3.6 `GET /integration/prices?date=`

Harga pangan harian yang diinput Bhabin. Ini **satu-satunya sumber** menu Harga Pangan di Pusat. Pusat tidak membandingkan dengan harga nasional atau lembaga lain.

Parameter: `date`, atau `from`/`to`; mendukung `updatedSince`.

```json
{
  "data": [
    {
      "id": "HRG-20261025-DESA-3578010001-BERAS",
      "tanggal": "2026-10-25",
      "komoditas": "BERAS_MEDIUM",
      "namaKomoditas": "Beras medium",
      "satuan": "kg",
      "harga": 13200,
      "stok": "AMAN",
      "desaId": "DESA-3578010001",
      "bhabinId": "BHB-0001",
      "updatedAt": "2026-10-25T09:00:00+07:00"
    }
  ]
}
```

- `stok`: `AMAN` | `MENIPIS` | `KOSONG`.
- `komoditas`: kode tetap yang stabil (daftar komoditas lengkap mohon disediakan lewat `GET /integration/commodities`, opsional).
- Bila lebih dari satu input untuk komoditas, desa, dan hari yang sama, kirim semuanya; Pusat yang merata-ratakan.

### 3.7 `GET /integration/family-summary`

**Hanya angka ringkasan per desa.** Tidak ada data per orang. Mendukung `updatedSince`.

```json
{
  "data": [
    {
      "desaId": "DESA-3578010001",
      "periode": "2026-10",
      "kk": 1840,
      "balita": 412,
      "stunting": 38,
      "berisikoStunting": 61,
      "belumDitangani": 24,
      "ibuHamil": 57,
      "kek": 9,
      "anemia": 14,
      "calonPengantin": 22,
      "sanitasiLayak": 1655,
      "sanitasiTidakLayak": 185,
      "updatedAt": "2026-10-25T00:30:00+07:00"
    }
  ]
}
```

Bila definisi tiap angka di repo Anda berbeda, mohon dituliskan di dokumen API agar Pusat memakai arti yang sama.

## 4. Yang kami butuhkan dari tim repo

1. Persetujuan bentuk respons di atas, atau usulan perubahan. Mohon jangan mengubah nama kolom tanpa kabar.
2. Penerbitan token oleh Superadmin untuk Pusat per instance Polda.
3. Dokumentasi di `05-api`, termasuk definisi tiap angka ringkasan.
4. Kode resmi Polda di setiap instance (`kodePolda`) untuk pemetaan wilayah.
5. Instance uji (staging) dengan data contoh agar pengembangan Pusat bisa berjalan sebelum produksi.

## 5. Di luar cakupan

- Tidak ada endpoint tulis dari Pusat ke instance Polda.
- Tidak ada data kesehatan per orang.
- Tidak ada foto atau berkas dalam respons daftar.
- Tidak ada perubahan pada aplikasi mobile Bhabin.

## 6. Pertanyaan terbuka untuk tim repo

1. Apakah nomor KK saat ini hanya tersimpan terenkripsi dan bisa didekripsi di sisi server untuk endpoint ini?
2. Zona waktu tiap instance: apakah semua WIB atau mengikuti Polda (WITA, WIT)?
3. Berapa lama instance menyimpan laporan dan absensi (untuk menentukan jangkauan `from`/`to`)?
4. Kapan instance Polda yang pertama siap dipasangi endpoint ini?
