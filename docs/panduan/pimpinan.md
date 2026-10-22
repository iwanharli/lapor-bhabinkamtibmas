# Panduan Pimpinan

Dashboard web untuk memantau laporan dan kinerja Bhabinkamtibmas di wilayah satuan Anda. Data yang tampil otomatis
dibatasi pada satuan Anda dan satuan di bawahnya (Polsek → Polres → Polda → Mabes).

## 1. Masuk

Masuk dengan NRP dan kata sandi, lalu ganti kata sandi awal. Dashboard hanya bisa dibuka dari jaringan internal.

## 2. Menu

| Menu | Kegunaan |
|---|---|
| **Ringkasan** | Jumlah laporan, laporan prioritas, dan tren periode terpilih |
| **Notifikasi** | Laporan **prioritas** (Deteksi Dini urgensi tinggi, stunting belum ditangani) dan **lokasi perlu dicek** |
| **Laporan** | Semua laporan: cari (nomor, nama Bhabin, desa, kepala keluarga), saring kategori/periode/prioritas, **Ekspor CSV** |
| **Peta Sebaran** | Titik/gugus laporan; saring wilayah, kategori, prioritas; strip laporan prioritas di bawah peta |
| **Harga Pangan** | Rata-rata, perubahan 7 hari, tren, dan **sebaran per desa** (saring wilayah, cari desa) |
| **Keluarga & Stunting** | Balita, status gizi, **stunting belum ditangani**, ibu hamil/KEK, faktor risiko rumah tangga per desa |
| **Kinerja Bhabin** | Aktivitas pelaporan per personel, **Ekspor CSV** |
| **Absensi** | Kehadiran harian, terlambat, belum hadir, lokasi dicek, swafoto |

## 3. Menindaklanjuti

- **Prioritas:** buka dari Notifikasi atau strip prioritas di Peta. Untuk stunting yang belum ditangani, koordinasikan
  dengan Puskesmas/Posyandu setempat.
- **Lokasi perlu dicek:** label *"Di luar desa · 33,8 km"* berarti titik GPS laporan berada di luar batas desa binaan
  (toleransi 200 m); *"Lokasi palsu"* berarti terdeteksi aplikasi pemalsu lokasi. Konfirmasi ke Bhabin yang bersangkutan.
- **Keluarga & Stunting:** klik nama desa untuk melihat laporan Mapping desa tersebut. Satu KK yang dilaporkan ulang
  dihitung sekali (laporan terbaru).

## 4. Data sensitif (NIK, No. KK, data kesehatan)

1. Di detail laporan, tekan **Tampilkan data sensitif**.
2. Tuliskan **alasan** yang jelas (mis. *"Koordinasi Puskesmas untuk balita stunting"*).
3. Data tampil di jendela itu saja; menutup jendela = harus membuka ulang dengan alasan baru.

Setiap pembukaan **tercatat** (nama Anda, waktu, alasan, IP, perangkat) dan dapat diperiksa auditor.
**Jangan** menyalin, memotret, atau meneruskan data ini di luar keperluan tugas.

## 5. Ekspor

Tombol **Ekspor CSV** mengikuti filter yang sedang aktif. File ekspor **tidak** memuat NIK/No. KK maupun data
kesehatan per orang. Simpan file ekspor di perangkat dinas dan hapus bila sudah tidak diperlukan.

## 6. Profil

Menu **Profil saya** (klik nama di kanan atas): ubah pangkat, jabatan, No. HP; lihat aktivitas terakhir akun Anda
(waktu, perangkat, IP). Ada aktivitas mencurigakan? Ganti kata sandi dan laporkan ke admin.
