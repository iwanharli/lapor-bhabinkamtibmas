-- Ringkasan kesehatan keluarga (jumlah balita, stunting, ibu hamil, dst.) agar rekap tidak perlu membuka data terenkripsi.
ALTER TABLE "reports" ADD COLUMN "health" JSONB;
