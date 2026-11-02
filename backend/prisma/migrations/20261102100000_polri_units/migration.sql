-- Referensi satuan Polri nasional (Posko PBM) dan wilayah Kemendagri yang dicakupnya. Terpisah dari tabel units,
-- yang menjadi acuan akun & laporan.
CREATE TABLE "polri_units" (
  "id" UUID PRIMARY KEY,
  "parent_id" UUID REFERENCES "polri_units"("id"),
  "kind" VARCHAR(16) NOT NULL,
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "name" VARCHAR(150) NOT NULL,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX "polri_units_parent_id_idx" ON "polri_units"("parent_id");

CREATE TABLE "polri_wilayah" (
  "unit_id" UUID NOT NULL REFERENCES "polri_units"("id") ON DELETE CASCADE,
  "kode" VARCHAR(13) NOT NULL REFERENCES "regions"("kode") ON DELETE CASCADE,
  "method" VARCHAR(20) NOT NULL,
  PRIMARY KEY ("unit_id", "kode")
);
CREATE INDEX "polri_wilayah_kode_idx" ON "polri_wilayah"("kode");
