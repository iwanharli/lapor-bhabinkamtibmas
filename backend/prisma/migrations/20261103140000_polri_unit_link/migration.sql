-- Unit (akun & laporan) padanan satuan nasional; unit lama bisa ber-ID berbeda. Diisi seed:polri.
ALTER TABLE "polri_units" ADD COLUMN "unit_id" UUID REFERENCES "units"("id") ON DELETE SET NULL;
CREATE INDEX "polri_units_unit_id_idx" ON "polri_units"("unit_id");
