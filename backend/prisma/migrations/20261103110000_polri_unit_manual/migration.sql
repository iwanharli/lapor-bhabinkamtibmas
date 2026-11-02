-- Satuan yang dibuat atau koordinatnya diubah admin: dipertahankan saat seed:polri memuat ulang CSV.
ALTER TABLE "polri_units" ADD COLUMN "manual" BOOLEAN NOT NULL DEFAULT false;
