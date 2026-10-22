# Uji beban

Simulasi Bhabin mengirim laporan Sambang berfoto (buat → unggah foto → kirim → daftar laporan → notifikasi, jeda 2–5 detik)
bersama pimpinan membuka dashboard (ringkasan, peta, daftar laporan). Kata sandi akun uji: sandi seed demo.

**Jangan jalankan di produksi** — laporan sungguhan dibuat. Pakai server/database cadangan.

```bash
cd backend
node ../infra/loadtest/siapkan.mjs                          # akun & foto contoh
API=http://SERVER:3000/api/v1 node ../infra/loadtest/uji-beban.mjs 300 30 60   # 300 Bhabin, 30 pimpinan, 60 detik
```

ID laporan yang dibuat dicatat di `infra/loadtest/lt-created.txt` untuk dibersihkan sesudahnya
(hapus `notifications`, `report_status_history`, `attachments` + berkas, `report_items`, lalu `reports`; kemudian `npm run aggregates:rebuild`).

## Hasil (23 Okt 2026, satu laptop 10 inti: generator + API + PostgreSQL bersamaan, data nasional ±135 ribu laporan)

| Beban | Laporan berfoto terkirim | p95 unggah foto | p95 peta | Galat |
|---|---|---|---|---|
| 100 Bhabin + 10 pimpinan | ±13/detik | 71 ms | 206 ms | 0 |
| 300 Bhabin + 30 pimpinan | ±36/detik | 757 ms | 719 ms | 0 |
| 500 Bhabin + 50 pimpinan | ±31/detik (jenuh) | 7,7 s | 8,3 s | 0 (pool 40) |

Skenario ini jauh lebih rapat dari pemakaian nyata (tiap Bhabin mengirim laporan ±tiap 10 detik). Sebagai pembanding,
40.000 Bhabin yang masing-masing mengirim 2 laporan dalam satu jam sibuk = ±22 laporan/detik.

Pengaturan yang dibutuhkan (sudah di `install-ubuntu.sh` / `lapor-api.service`):
- `UV_THREADPOOL_SIZE` = jumlah inti CPU (kompresi foto & argon2 memakai thread pool libuv, default 4).
- `DATABASE_URL=...?connection_limit=40&pool_timeout=20` (default Prisma ±2×inti+1 habis saat beban tinggi).
- `PHOTO_MOZJPEG` mati (default): mozjpeg ±15× lebih lambat demi berkas ±10% lebih kecil.
- Pembatas laju per akun (bukan per IP) — Bhabin sering berbagi IP (CGNAT/NAT kantor).
