# 03 — Modul Laporan

> Field di bawah adalah **usulan** dari dokumen sumber dan masih perlu disahkan oleh pengguna/instansi. Karena form berbasis skema, perubahan cukup dilakukan pada skema tanpa rilis ulang aplikasi.

## 1. Daftar kategori

| Kode | Nama | Sumber | Frekuensi |
|---|---|---|---|
| `SAMBANG` | Sambang / Door to Door System | Proposal | Harian |
| `DETEKSI_DINI` | Deteksi Dini (Informasi Khusus) | Proposal | Insidental |
| `PROBLEM_SOLVING` | Penyelesaian Masalah / Mediasi | Proposal | Insidental |
| `PENYULUHAN` | Penyuluhan & Pembinaan | Proposal | **Ditunda** — formulir nonaktif (status skema `RETIRED`); data lama tetap tampil |
| `HARGA_PANGAN` | Pemantauan Harga Pangan & Kios Pasar | Proposal + Demo | Harian/mingguan |
| `MAPPING_KK` | Mapping Data Keluarga | Demo | Bertahap |
| `KETAHANAN_PANGAN` | Ketahanan Pangan | Demo | Berkala |

Ditambah modul **Absensi Lapangan** (bukan laporan, lihat §5).

## 2. Field umum (semua kategori)

Diisi otomatis atau dipilih di awal form.

| Field | Tipe | Wajib | Sumber |
|---|---|---|---|
| `client_uuid` | UUID | ✔ | Dibuat perangkat |
| `category` | enum | ✔ | Pilihan pengguna |
| `village_id` | ref desa | ✔ | Pilih dari desa binaan |
| `occurred_at` | datetime | ✔ | Default: waktu sekarang, boleh diubah mundur maks. 3×24 jam |
| `location` | titik (lat, lng) | ✔ | GPS otomatis |
| `gps_accuracy_m` | angka | ✔ | GPS otomatis |
| `is_mock_location` | boolean | ✔ | Deteksi perangkat (Android) |
| `attachments[]` | file | sesuai kategori | Kamera / file |

## 3. Spesifikasi per kategori

Notasi tipe: `text`, `textarea(n)` (maks. n karakter), `number`, `currency` (Rupiah, bilangan bulat), `select[...]`, `multiselect[...]`, `nik` (16 digit, terenkripsi), `photo` (kamera, watermark), `file` (foto/PDF), `repeater` (daftar baris).

### 3.1 SAMBANG — Sambang / DDS

| Key | Label | Tipe | Wajib |
|---|---|---|---|
| `jenis_sasaran` | Jenis sasaran | select[Warga, Tokoh Masyarakat, Tokoh Agama, Perangkat Desa, Tokoh Pemuda, Lainnya] | ✔ |
| `nama_sasaran` | Nama warga/tokoh | text | ✔ |
| `nik_sasaran` | NIK | nik | ✖ |
| `alamat` | Alamat / RT-RW | text | ✔ |
| `pesan_kamtibmas` | Pesan Kamtibmas yang disampaikan | multiselect[Pencurian, Penipuan, Narkoba, Karhutla, Judi Online, Kenakalan Remaja, Lainnya] | ✔ |
| `tanggapan` | Tanggapan masyarakat | textarea(1000) | ✔ |
| `foto_bersama` | Foto bersama warga | photo (1–3) | ✔ |

### 3.2 DETEKSI_DINI — Deteksi Dini

| Key | Label | Tipe | Wajib |
|---|---|---|---|
| `kategori_kerawanan` | Kategori kerawanan | select[Sengketa Lahan, Gesekan Antarkelompok, Radikalisme, Bencana Alam, Kriminalitas, Lainnya] | ✔ |
| `urgensi` | Tingkat urgensi | select[Rendah, Sedang, Tinggi] | ✔ |
| `uraian` | Uraian singkat kejadian | textarea(500) | ✔ |
| `perkiraan_massa` | Perkiraan jumlah orang terlibat | number | ✖ |
| `tindakan_awal` | Tindakan awal yang dilakukan | textarea(500) | ✖ |
| `foto_lapangan` | Foto kondisi lapangan | photo (1–5) | ✔ |

Aturan: `urgensi = Tinggi` → notifikasi prioritas ke pimpinan Polsek/Polres, dan sinkron didahulukan di perangkat.

### 3.3 PROBLEM_SOLVING — Mediasi

| Key | Label | Tipe | Wajib |
|---|---|---|---|
| `pihak_1_nama` | Nama Pihak 1 | text | ✔ |
| `pihak_1_nik` | NIK Pihak 1 | nik | ✖ |
| `pihak_2_nama` | Nama Pihak 2 | text | ✔ |
| `pihak_2_nik` | NIK Pihak 2 | nik | ✖ |
| `pokok_masalah` | Pokok permasalahan | select[Batas Tanah, Perkelahian, Utang-Piutang Ringan, KDRT Non-Fisik, Lainnya] | ✔ |
| `uraian` | Uraian permasalahan | textarea(1000) | ✔ |
| `hasil` | Hasil mediasi | select[Tercapai Kesepakatan, Lanjut Proses Hukum, Mediasi Lanjutan] | ✔ |
| `dokumen_kesepakatan` | Surat kesepakatan damai | file (foto/PDF) | ✔ jika `hasil = Tercapai Kesepakatan` |
| `foto_kegiatan` | Foto kegiatan | photo (0–3) | ✖ |

### 3.4 PENYULUHAN — Penyuluhan & Pembinaan *(ditunda)*

> Modul ini ditunda sejak 22 Okt 2026. Untuk mengaktifkan kembali: ubah `status` di `packages/form-schemas/penyuluhan.v1.json` menjadi `ACTIVE` lalu jalankan `npx prisma db seed`.

| Key | Label | Tipe | Wajib |
|---|---|---|---|
| `jenis` | Jenis kegiatan | select[Pembinaan Siskamling, Penyuluhan Tematik] | ✔ |
| `tema` | Tema | select[Antinarkoba, Kenakalan Remaja, Bijak Bermedsos, Karhutla, Lainnya] | ✔ jika Penyuluhan Tematik |
| `lokasi` | Lokasi (poskamling/balai desa) | text | ✔ |
| `jumlah_peserta` | Jumlah peserta | number | ✔ |
| `foto_stiker` | Foto bukti penempelan stiker verifikasi | photo (1–3) | ✔ |
| `foto_kegiatan` | Foto kegiatan | photo (0–3) | ✖ |

### 3.5 HARGA_PANGAN — Harga Pangan & Kios Pasar

Bagian kepala:

| Key | Label | Tipe | Wajib |
|---|---|---|---|
| `jenis_lokasi` | Jenis lokasi | select[Pasar Tradisional, Kios/Agen Sembako, Sentra Distribusi] | ✔ |
| `nama_pasar` | Nama pasar / lokasi | text | ✔ |
| `nama_kios` | Nama kios | text | ✖ |
| `nama_pemilik` | Nama pemilik kios | text | ✖ |
| `items` | Daftar harga komoditas | repeater (min. 1) | ✔ |
| `catatan` | Catatan kondisi | textarea(500) | ✖ |
| `foto_etalase` | Foto etalase/kios | photo (1–3) | ✔ |

Baris `items` (disimpan ke tabel `report_items`):

| Key | Label | Tipe | Wajib |
|---|---|---|---|
| `commodity_id` | Komoditas | select dari master komoditas | ✔ |
| `harga` | Harga (Rp) | currency, 100–10.000.000 | ✔ |
| `satuan` | Satuan | select[kg, liter, butir, ikat] (default dari master) | ✔ |
| `stok` | Status stok | select[Aman, Menipis, Kosong] | ✔ |

UI mobile: daftar komoditas default ditampilkan sekaligus. Bhabin cukup mengetik harga dengan numpad Rupiah dan memilih status stok. Komoditas yang tidak tersedia dapat dilewati.

Validasi lunak: jika harga menyimpang > 50% dari median 7 hari di kabupaten yang sama, tampilkan peringatan "Periksa kembali harga" (tidak memblokir).

Master komoditas awal:

| Komoditas | Satuan |
|---|---|
| Beras Medium | kg |
| Beras Premium | kg |
| Minyak Goreng Curah | liter |
| Minyak Goreng Kemasan | liter |
| Gula Pasir | kg |
| Cabai Merah | kg |
| Cabai Rawit | kg |
| Bawang Merah | kg |
| Bawang Putih | kg |
| Telur Ayam | kg |
| Daging Sapi | kg |
| Daging Ayam | kg |

### 3.6 MAPPING_KK — Mapping Data Keluarga (v2, bertahap)

Formulir 5 langkah (`steps` di skema). Versi 1 (tanpa langkah) tidak dipakai untuk laporan baru; laporan lama tetap tampil dengan versi 1.

| Langkah | Isian |
|---|---|
| 1. Nomor KK & alamat | No. KK (16 digit, **terenkripsi**), alamat lengkap, satuan wilayah terkecil (RT/RW · Dusun/Dukuh · Banjar · Jorong · Lingkungan · Kampung · Lainnya) → RT & RW **atau** nama wilayah |
| 2. Kondisi hunian | Status kepemilikan, jenis bangunan, kondisi hunian (Layak/Perlu Perhatian/Tidak Layak), foto hunian 1–3 |
| 3. Kepala keluarga | Nama, NIK (terenkripsi), jenis kelamin, tanggal lahir, pendidikan (daftar KTP), pekerjaan (daftar KTP) + keterangan untuk pekerjaan tertentu, no. HP |
| 4. Anggota keluarga | Kartu per anggota (+ tambah, maks. 20): nama, NIK (terenkripsi per baris), hubungan, jenis kelamin, tanggal lahir, pendidikan, pekerjaan + keterangan |
| 5. Catatan lapangan | Teks bebas |

Keterangan pekerjaan wajib untuk sebagian besar pekerjaan (mis. PNS → instansi, guru → sekolah & mapel, pelajar → sekolah/kelas, petani → komoditas, perangkat desa → jabatan); tidak diminta untuk belum/tidak bekerja, mengurus rumah tangga, nelayan, buruh (harian lepas/tani/nelayan), sopir, pembantu rumah tangga, seniman, dan wartawan. Skema memakai `requiredIf: { field, in: [...] }` (berlaku juga di dalam baris repeater) dan `placeholders` untuk petunjuk per pilihan.

### 3.7 KETAHANAN_PANGAN — Ketahanan Pangan

| Key | Label | Tipe | Wajib |
|---|---|---|---|
| `jenis_usaha` | Komoditas / usaha pangan | select[Padi, Jagung, Kedelai, Hortikultura, Peternakan, Perikanan, Pekarangan Pangan, Lainnya] | ✔ |
| `nama_pengelola` | Nama pengelola/kelompok tani | text | ✖ |
| `luas_lahan_ha` | Luas lahan (ha) | number (desimal) | ✔ |
| `estimasi_produksi_ton` | Estimasi produksi (ton) | number (desimal) | ✔ |
| `kondisi` | Kondisi kegiatan | select[Berjalan, Perlu Pendampingan, Terhambat] | ✔ |
| `kendala` | Kendala | multiselect[Pupuk, Air/Irigasi, Hama, Cuaca, Modal, Pemasaran, Lainnya] | ✖ |
| `temuan` | Temuan lapangan | textarea(1000) | ✖ |
| `foto_lahan` | Foto lahan/kegiatan | photo (1–3) | ✔ |

## 4. Format skema form (JSON)

Disimpan di tabel `form_schemas` dan di `packages/form-schemas/*.json`. Contoh ringkas:

```json
{
  "category": "DETEKSI_DINI",
  "version": 1,
  "title": "Deteksi Dini",
  "fields": [
    { "key": "kategori_kerawanan", "label": "Kategori kerawanan", "type": "select",
      "required": true,
      "options": ["Sengketa Lahan", "Gesekan Antarkelompok", "Radikalisme", "Bencana Alam", "Kriminalitas", "Lainnya"] },
    { "key": "urgensi", "label": "Tingkat urgensi", "type": "select", "required": true,
      "options": ["Rendah", "Sedang", "Tinggi"] },
    { "key": "uraian", "label": "Uraian singkat kejadian", "type": "textarea",
      "required": true, "maxLength": 500 },
    { "key": "foto_lapangan", "label": "Foto kondisi lapangan", "type": "photo",
      "required": true, "min": 1, "max": 5 }
  ],
  "rules": [
    { "when": { "field": "urgensi", "equals": "Tinggi" }, "then": { "flag": "PRIORITY" } }
  ]
}
```

Tipe field yang didukung renderer: `text`, `textarea`, `number`, `currency`, `date`, `select`, `multiselect`, `nik`, `photo`, `file`, `repeater`. Properti umum: `key`, `label`, `type`, `required`, `requiredIf`, `options`, `min`, `max`, `maxLength`, `help`.

Aturan versi:
- Skema bersifat **immutable** setelah dipublikasikan. Perubahan dilakukan dengan membuat versi baru.
- Laporan menyimpan `schema_version`. Backend memvalidasi terhadap versi tersebut.
- Perangkat dengan skema lama tetap bisa mengirim selama versi tersebut belum ditandai `retired`.

## 5. Absensi lapangan

| Field | Keterangan |
|---|---|
| `type` | `CHECK_IN` / `CHECK_OUT` |
| `client_time` | Waktu perangkat |
| `server_time` | Waktu terima server |
| `location`, `gps_accuracy_m`, `is_mock_location` | GPS |
| `selfie` | Foto kamera depan, watermark |
| `inside_village` | Dihitung server: titik berada dalam poligon salah satu desa binaan (toleransi 200 m) |

Aturan: maks. satu `CHECK_IN` & satu `CHECK_OUT` per hari. Absensi offline diterima jika `client_time` dalam 24 jam terakhir dan tetap ditandai `late_sync`.

## 6. Alur status laporan

**Tanpa verifikasi** (keputusan 22 Oktober 2026): laporan yang dikirim langsung final. Pengaman kualitas data adalah validasi skema & lampiran saat kirim, cek lokasi otomatis (desa binaan ±200 m, deteksi lokasi palsu), dan audit log.

```
   (perangkat)
      DRAFT ───────kirim──────► SUBMITTED (final)
                                   │  ▲
                                   └──┘ ralat oleh pelapor ≤ 3×24 jam sejak dikirim
```

| Dari | Ke | Oleh | Syarat |
|---|---|---|---|
| — | DRAFT | Bhabin | — |
| DRAFT | SUBMITTED | Bhabin | Validasi skema lolos, lampiran wajib terunggah |
| SUBMITTED | SUBMITTED (ralat) | Bhabin pelapor | ≤ `REPORT_RALAT_HOURS` (72 jam) sejak dikirim; isian tetap harus lengkap |

- Ralat menghitung ulang prioritas, item harga, dan cek lokasi; tercatat di `audit_logs` (`REPORT_UPDATE`, `ralat: true`). Lampiran boleh ditambah selama jendela ralat.
- Setelah jendela ralat, laporan tidak dapat diubah (`409 RALAT_CLOSED`).
- Status lama (`IN_REVIEW`, `APPROVED`, `NEEDS_REVISION`, `REJECTED`) tidak dipakai lagi; data lama dimigrasikan menjadi `SUBMITTED` (riwayat status tetap tersimpan). Peran Verifikator diubah menjadi Pimpinan.

## 7. Penomoran laporan

Format: `{KAT}-{KODE_POLRES}-{YYMM}-{URUT5}`, contoh `DD-POLRESBGR-2610-00042`.

| Kategori | Prefiks |
|---|---|
| SAMBANG | SB |
| DETEKSI_DINI | DD |
| PROBLEM_SOLVING | PS |
| PENYULUHAN | PY |
| HARGA_PANGAN | HP |
| MAPPING_KK | KK |
| KETAHANAN_PANGAN | KP |

- Nomor diterbitkan server saat laporan pertama kali diterima (tabel `report_counters` dengan `SELECT ... FOR UPDATE`).
- Sebelum sinkron, aplikasi menampilkan nomor sementara `LOKAL-xxxxxx` (6 karakter awal UUID).

## 8. Lampiran

| Jenis | Format | Batas |
|---|---|---|
| Foto | JPEG (dikompres di perangkat, sisi terpanjang 1600 px, kualitas 80; server mengompres ulang ke maks. 1920 px JPEG q78 bila hemat ≥ 10%) | 3 MB |
| Dokumen | PDF | 10 MB |
| Video (opsional, hanya Deteksi Dini) | MP4 H.264, maks. 30 detik | 25 MB |

Untuk tiap lampiran disimpan metadata `sha256`, `captured_at`, lokasi, `source` (`CAMERA` / `FILE`), dan status watermark.
