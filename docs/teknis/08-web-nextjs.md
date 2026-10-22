# 08 — Dashboard Web (Next.js)

## 1. Stack

| Kebutuhan | Pilihan |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling & komponen | Tailwind CSS + shadcn/ui (Radix) |
| Data fetching | TanStack Query (klien) + fetch di Server Component |
| Tabel | TanStack Table (server-side pagination/filter) |
| Form | React Hook Form + Zod |
| Peta | MapLibre GL JS + tile server internal (OpenStreetMap offline / tile vektor) |
| Grafik | Apache ECharts (`echarts-for-react`) |
| Tanggal | `date-fns` (locale `id`) |
| Auth | Sesi cookie `httpOnly` di server Next.js (BFF), meneruskan token ke API |
| Test | Vitest + Testing Library, Playwright (E2E) |

**Pola BFF:** browser hanya berbicara ke server Next.js. Token API disimpan di cookie `httpOnly; Secure; SameSite=Strict`, dan Route Handler `/api/proxy/*` meneruskan permintaan ke NestJS. Dengan pola ini token tidak pernah terekspos ke JavaScript browser.

## 2. Struktur

```
web/src/
├── app/                        # routing saja: ambil data lalu susun komponen
│   ├── (dashboard)/            # halaman ber-sidebar: /, /laporan, /harga-pangan, /admin/*
│   ├── login/
│   └── api/                    # BFF: /api/auth/*, /api/proxy/* (token di cookie httpOnly)
├── components/
│   ├── ui/                     # komponen dasar tanpa logika domain (impor dari '@/components/ui')
│   │   ├── button.tsx          # Button, ButtonLink (varian primary/secondary/ghost/danger/warn/outline-*)
│   │   ├── form.tsx            # Field, Input, Select, Textarea, Checkbox, FormGrid
│   │   ├── card.tsx, table.tsx # Card; Table/THead/Th/Tr/Td/CellStack
│   │   ├── badge.tsx, alert.tsx
│   │   ├── modal.tsx           # Modal (<dialog>), ModalBody, ConfirmDialog
│   │   ├── page.tsx            # PageHeader, BackLink, Stat, EmptyState, DescriptionList, Pagination
│   │   └── layout.tsx          # Stack, Grid, SplitLayout (konten + kolom samping)
│   ├── layout/                 # AppShell, Sidebar, konfigurasi menu per peran (nav.ts)
│   └── charts/                 # pembungkus ECharts bertema terang/gelap
├── features/                   # komponen per domain, dipakai oleh halaman
│   ├── reports/                # tabel, filter, isian, timeline, panel verifikasi
│   ├── prices/                 # tabel harga, perubahan %, grafik tren
│   ├── dashboard/              # grafik & daftar ringkasan
│   └── admin/                  # form pengguna, desa binaan, akun & perangkat, unit
├── lib/
│   ├── api/server.ts           # apiGet/apiFetch untuk Server Component (refresh token otomatis)
│   ├── api/client.ts           # callApi untuk komponen klien (lewat /api/proxy)
│   ├── types.ts                # bentuk respons API
│   ├── format.ts               # label, Rupiah, tanggal WIB
│   └── units.ts                # pohon unit
└── middleware.ts               # redirect ke /login bila belum masuk
```

Aturan:
- Halaman (`app/`) tidak berisi kelas Tailwind panjang; tampilan disusun dari `components/ui` dan `features/*`.
- `components/ui` tidak mengenal domain (laporan, pengguna); `features/*` boleh memakai `lib/types` dan `lib/format`.
- Form ringan memakai `Modal`/`ConfirmDialog`; form panjang tetap di halaman.
- Build verifikasi saat `next dev` berjalan: `NEXT_DIST_DIR=.next-build npx next build` agar folder `.next` milik server dev tidak tertimpa.

## 3. Halaman

### 3.1 Ringkasan (`/`)
- Pemilih cakupan: Polda → Polres → Polsek (dibatasi unit pengguna) + rentang tanggal.
- Kartu statistik: total laporan, menunggu verifikasi, Deteksi Dini urgensi tinggi terbuka, tingkat kehadiran hari ini.
- Grafik batang laporan per kategori per hari, donut status.
- Daftar 10 laporan prioritas terbaru.
- Tabel harga: komoditas, harga rata-rata hari ini, dan perubahan vs 7 hari lalu (▲/▼ %).

### 3.2 Laporan (`/laporan`)
- Tabel: nomor, kategori, Bhabin, desa, waktu kegiatan, status, ikon prioritas/lokasi mencurigakan.
- Filter: kategori, status, unit, desa, rentang tanggal, prioritas, pencarian teks.
- Aksi massal: ekspor hasil filter (XLSX/CSV).
- Filter tersimpan di URL agar tautan bisa dibagikan.

### 3.3 Detail & verifikasi (`/laporan/[id]`)
- Kiri: isian form (dirender dari skema versi laporan), galeri lampiran (lightbox), dan untuk harga pangan tabel item + perbandingan dengan median wilayah.
- Kanan: peta mini (titik laporan + batas desa binaan), metadata (akurasi GPS, mock location, selisih waktu perangkat-server, perangkat), linimasa status.
- Tombol verifikator: **Setujui**, **Minta Revisi**, **Tolak** (dua yang terakhir wajib catatan).
- Field sensitif tersamar. Tombol "Tampilkan" meminta alasan lalu memanggil `reveal-sensitive`.

### 3.4 Peta (`/peta`)
- Layer: laporan per kategori (cluster), Deteksi Dini (warna urgensi), absensi hari ini, batas desa.
- Heatmap kerawanan per kecamatan.
- Klik titik → ringkasan + tautan detail.

### 3.5 Harga pangan (`/harga-pangan`)
- Grafik garis tren per komoditas (pilih kabupaten/kecamatan, 7/30/90 hari).
- Tabel perbandingan antarwilayah, dengan sorotan lonjakan > 10% dalam 7 hari.
- Status stok: proporsi Aman/Menipis/Kosong per komoditas.
- Panel korelasi (fase 5): tren harga vs jumlah laporan kerawanan pada wilayah yang sama.

### 3.6 Kinerja (`/kinerja`)
- Tabel per Bhabin: jumlah laporan per kategori, hari hadir, absensi di luar desa, laporan direvisi/ditolak.
- Indikator kepatuhan Penyuluhan triwulanan (sudah/belum).

### 3.7 Administrasi
- **Pengguna:** CRUD, impor CSV (NRP, nama, pangkat, peran, kode unit, kode desa), reset sandi, nonaktifkan, lihat & cabut perangkat.
- **Unit & desa:** pohon unit, unggah GeoJSON batas desa, penugasan desa ke Polsek.
- **Komoditas:** urutan, satuan, aktif/nonaktif.
- **Skema form:** lihat versi, editor JSON dengan pratinjau form, publikasi versi baru, retire versi lama.

### 3.8 Audit (`/audit`)
Filter aktor/aksi/entitas/waktu dan ekspor. Hanya untuk peran yang berhak.

## 4. Desain antarmuka

- Mengikuti gaya demo SIMPEL: sidebar navy (`#0b233a`), aksen teal (`#0caa9a`), latar `#f3f6fa`, font Inter.
- Mendukung mode gelap melalui token warna CSS.
- Responsif hingga lebar tablet. Pimpinan sering membuka di tablet/HP, jadi halaman Ringkasan & Peta harus nyaman di layar kecil.
- Format angka & tanggal Indonesia: `Rp 13.500`, `22 Okt 2026 07.42 WIB`.
- Aksesibilitas: kontras AA, navigasi keyboard, label form.

## 5. Kinerja

- Semua tabel menggunakan paginasi server.
- Peta memuat titik berdasarkan `bbox` + zoom. Titik di atas 5.000 di-cluster di server.
- Grafik memakai endpoint agregat, bukan data mentah.
- Gambar lampiran memakai thumbnail. Ukuran penuh hanya di lightbox.
