-- Batas wilayah administrasi (provinsi, kabupaten/kota, kecamatan) berkode Kemendagri.
-- Desa/kelurahan tetap di tabel villages (kode_wilayah = kode Kemendagri).
CREATE TABLE "regions" (
    "kode" VARCHAR(13) NOT NULL,
    "nama" VARCHAR(120) NOT NULL,
    "level" SMALLINT NOT NULL,
    "parent_kode" VARCHAR(13),
    "chain" VARCHAR(400) NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "geom" geometry(MultiPolygon, 4326),
    "geom_s" geometry(MultiPolygon, 4326),
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    CONSTRAINT "regions_pkey" PRIMARY KEY ("kode"),
    CONSTRAINT "regions_level_check" CHECK ("level" BETWEEN 1 AND 3),
    CONSTRAINT "regions_parent_kode_fkey" FOREIGN KEY ("parent_kode") REFERENCES "regions"("kode") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "regions_parent_kode_idx" ON "regions"("parent_kode");
CREATE INDEX "regions_level_geom_s_idx" ON "regions" USING GIST ("geom_s");
CREATE INDEX "regions_level_idx" ON "regions"("level");

ALTER TABLE "villages" ADD COLUMN "kecamatan_kode" VARCHAR(13);
CREATE INDEX "villages_kecamatan_kode_idx" ON "villages"("kecamatan_kode");
