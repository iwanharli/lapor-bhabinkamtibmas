-- Daftar referensi pasar (titik koordinat); laporan harga masih memakai nama isian Bhabin.
CREATE TABLE "markets" (
  "id" VARCHAR(64) PRIMARY KEY,
  "kategori" VARCHAR(24) NOT NULL,
  "nama" VARCHAR(200) NOT NULL,
  "alamat" VARCHAR(300),
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "village_kode" VARCHAR(13) NOT NULL
);
CREATE INDEX "markets_village_kode_idx" ON "markets"("village_kode" varchar_pattern_ops);
