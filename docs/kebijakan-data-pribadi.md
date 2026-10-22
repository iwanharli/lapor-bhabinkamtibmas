# Kebijakan Pelindungan Data Pribadi — Lapor Bhabinkamtibmas

> **DRAF untuk dibahas.** Disusun dari cara kerja aplikasi saat ini. Bagian bertanda **[KEPUTUSAN]** perlu ditetapkan
> pejabat berwenang, dan seluruh rujukan pasal perlu diperiksa ulang bagian hukum sebelum disahkan.
> Rujukan utama: UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).

## 1. Ruang lingkup

Berlaku untuk seluruh data yang dikumpulkan dan diolah aplikasi Lapor Bhabinkamtibmas (aplikasi HP/web Bhabin,
dashboard web, API, database, penyimpanan berkas, backup) di seluruh satuan yang memakainya.

## 2. Data yang diolah

| Kelompok | Contoh | Sifat menurut UU PDP | Perlakuan teknis |
|---|---|---|---|
| Identitas personel | NRP, nama, pangkat, jabatan, No. HP, satuan | Data pribadi umum | Tersimpan biasa; akses sesuai cakupan satuan |
| Jejak kerja personel | Absensi (jam, GPS, swafoto), titik GPS laporan, perangkat & IP | Data pribadi umum (lokasi) | Tersimpan biasa; tercatat di audit log |
| Identitas warga | Nama, tempat/tanggal lahir, alamat, pekerjaan, agama, No. HP | Data pribadi umum | Tersimpan biasa di laporan |
| **Nomor kependudukan** | NIK, No. KK | Data pribadi (berisiko tinggi bila bocor) | **Terenkripsi** AES-256-GCM; dibuka hanya dengan alasan |
| **Kesehatan & anak** | Status stunting balita, kelompok risiko ibu (hamil, KEK/anemia), remaja putri anemia | **Data pribadi spesifik** (kesehatan; data anak) | **Terenkripsi**; rekap hanya berupa angka tanpa nama |
| Foto | Foto kegiatan, foto hunian, swafoto absensi | Data pribadi umum | Metadata EXIF (termasuk GPS) dihapus saat unggah |

## 3. Dasar dan tujuan pemrosesan

- **Dasar:** pelaksanaan tugas dan kewenangan Polri di bidang pembinaan masyarakat (Bhabinkamtibmas), serta
  kepentingan umum/pelayanan publik sesuai peraturan perundang-undangan. **[KEPUTUSAN]** sebutkan dasar hukum internal
  (Perpol/Perkap/surat perintah) yang menugaskan pendataan ini.
- **Tujuan:** deteksi dini dan pemeliharaan kamtibmas, pemetaan keluarga binaan, dukungan program percepatan penurunan
  stunting (koordinasi dengan Puskesmas/Posyandu), pemantauan harga pangan, dan pengawasan kinerja personel.
- Data **tidak** dipakai untuk tujuan lain di luar tugas tersebut tanpa dasar hukum baru.

## 4. Siapa boleh mengakses apa

| Peran | Laporan & rekap | NIK/No. KK & data kesehatan | Catatan |
|---|---|---|---|
| Bhabinkamtibmas | Laporannya sendiri | Laporannya sendiri, dengan alasan | Ralat hanya 3×24 jam setelah kirim |
| Pimpinan | Cakupan satuannya (Polsek/Polres/Polda/Mabes) | Ya, **dengan alasan tertulis**, tercatat di audit log | |
| Auditor | Cakupan satuannya | Ya, dengan alasan, tercatat | Untuk pengawasan |
| Admin unit / Superadmin | Akun, satuan, desa | **Tidak** | Admin teknis tidak membuka data sensitif |

- Setiap pembukaan data sensitif dicatat: siapa, kapan, laporan mana, alasan, IP, dan perangkat.
- Rekap (dashboard, Keluarga & Stunting, ekspor CSV) tidak memuat NIK/No. KK maupun status kesehatan per orang.
- **[KEPUTUSAN]** siapa yang meninjau audit log pembukaan data sensitif dan seberapa sering (usul: auditor Polda, bulanan).

## 5. Masa simpan

| Data | Usulan masa simpan | Setelah masa simpan |
|---|---|---|
| Laporan & lampiran | **[KEPUTUSAN]** usul 5 tahun sejak dikirim | Dihapus, atau dianonimkan (NIK/No. KK, nama, data kesehatan dihapus; angka rekap tetap) |
| Data kesehatan per orang | **[KEPUTUSAN]** usul 2 tahun (balita melewati usia 5 tahun) | Dihapus dari bagian terenkripsi; angka rekap tetap |
| Swafoto & GPS absensi | **[KEPUTUSAN]** usul 1 tahun | Swafoto dihapus; jam absen tetap |
| Audit log | **[KEPUTUSAN]** usul 5 tahun | Dihapus |
| Backup | 14 hari (berputar otomatis) | Terhapus otomatis |
| Draft laporan tak terkirim | Dapat dibuang pelapor kapan saja | — |

> Catatan teknis: penghapusan/anonimisasi berkala belum otomatis; perlu dibuatkan setelah masa simpan ditetapkan.

## 6. Pengamanan teknis (sudah berjalan)

- Enkripsi NIK/No. KK dan data kesehatan (AES-256-GCM); pencocokan KK ganda memakai sidik HMAC, bukan nomor asli.
- Koneksi HTTPS; dashboard dan endpoint admin hanya dari jaringan internal.
- Kata sandi di-hash (argon2id), wajib diganti saat login pertama, akun terkunci setelah percobaan gagal berulang;
  batas laju per akun dan per IP + NRP untuk login.
- Hak akses per peran dan cakupan satuan, diperiksa di server.
- Audit log untuk masuk/keluar, laporan, unggahan, pembukaan data sensitif, ekspor, dan perubahan akun.
- Backup harian terverifikasi; kunci enkripsi **tidak** ikut backup.

## 7. Kunci enkripsi

- Kunci (`DATA_ENCRYPTION_KEYS`) disimpan hanya di server (`/etc/lapor/api.env`, hak baca terbatas) dan **minimal dua
  salinan cadangan offline** di tempat berbeda (mis. brankas satuan + pejabat TIK). Tanpa kunci, data sensitif di
  database maupun backup tidak dapat dibuka.
- **[KEPUTUSAN]** pemegang kunci (usul: 2 orang, pejabat TIK & pejabat PDP) dan jadwal rotasi (usul: tahunan, atau
  segera bila diduga bocor).
- Prosedur rotasi:
  1. Buat kunci baru, tambahkan di **depan** daftar (`k2:<baru>,k1:<lama>`), restart layanan — data baru memakai kunci baru.
  2. Jalankan `npm run crypto:rotasi` (backend) — seluruh data sensitif dienkripsi ulang dengan kunci baru.
  3. Hapus kunci lama dari server, restart. Simpan arsip kunci lama terpisah **selama backup lama masih ada** (14 hari),
     lalu musnahkan.

## 8. Hak warga sebagai subjek data

- Warga dapat meminta informasi, perbaikan, atau penghapusan data keluarganya melalui Bhabinkamtibmas desanya atau
  **[KEPUTUSAN]** saluran resmi satuan.
- Perbaikan dilakukan lewat ralat (≤ 3×24 jam oleh pelapor) atau oleh pejabat berwenang sesudahnya.
- **[KEPUTUSAN]** batas waktu menjawab permintaan dan pengecualian yang berlaku untuk kepentingan tugas kepolisian.

## 9. Insiden kebocoran

1. Siapa pun yang menduga kebocoran segera melapor ke **[KEPUTUSAN]** (pejabat PDP/TIK).
2. Batasi dampak: cabut sesi/akun terkait, ganti sandi, rotasi kunci enkripsi bila diduga ikut bocor.
3. Telusuri audit log (akses, ekspor, pembukaan data sensitif).
4. **Pemberitahuan tertulis** kepada subjek data dan lembaga terkait paling lambat **3×24 jam** sejak diketahui
   (UU PDP — periksa pasal pemberitahuan kegagalan pelindungan data).
5. Catat kronologi, dampak, dan perbaikan.

## 10. Kewajiban lain yang perlu dipenuhi

- **Penilaian dampak (DPIA):** wajib untuk data pribadi spesifik dan pemrosesan berskala besar — **belum dibuat**.
- **Pejabat pelindungan data pribadi:** **[KEPUTUSAN]** tunjuk pejabat yang bertanggung jawab.
- **Pemberitahuan kepada warga** saat pendataan (apa yang dicatat, untuk apa, siapa yang melihat): **[KEPUTUSAN]**
  teks singkat yang dibacakan/diberikan Bhabin.
- **Pelatihan** personel tentang kerahasiaan data sebelum aplikasi dipakai.
