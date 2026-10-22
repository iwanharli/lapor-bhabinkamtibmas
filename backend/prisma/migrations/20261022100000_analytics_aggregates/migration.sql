-- CreateTable
CREATE TABLE "agg_unit_daily" (
    "hari" DATE NOT NULL,
    "unit_id" UUID NOT NULL,
    "category" "report_category" NOT NULL,
    "status" "report_status" NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "prioritas" INTEGER NOT NULL,
    "lokasi_janggal" INTEGER NOT NULL,
    CONSTRAINT "agg_unit_daily_pkey" PRIMARY KEY ("hari","unit_id","category","status")
);
-- CreateTable
CREATE TABLE "agg_user_daily" (
    "hari" DATE NOT NULL,
    "user_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "total" INTEGER NOT NULL,
    "disetujui" INTEGER NOT NULL,
    "menunggu" INTEGER NOT NULL,
    "revisi" INTEGER NOT NULL,
    "ditolak" INTEGER NOT NULL,
    "lokasi_janggal" INTEGER NOT NULL,
    "sambang" INTEGER NOT NULL,
    "deteksi_dini" INTEGER NOT NULL,
    "problem_solving" INTEGER NOT NULL,
    "penyuluhan" INTEGER NOT NULL,
    "harga_pangan" INTEGER NOT NULL,
    "mapping_kk" INTEGER NOT NULL,
    "ketahanan_pangan" INTEGER NOT NULL,
    "last_at" TIMESTAMPTZ,
    CONSTRAINT "agg_user_daily_pkey" PRIMARY KEY ("hari","user_id")
);
-- CreateTable
CREATE TABLE "agg_price_daily" (
    "hari" DATE NOT NULL,
    "unit_id" UUID NOT NULL,
    "commodity_id" INTEGER NOT NULL,
    "kabupaten" TEXT NOT NULL,
    "jumlah_harga" BIGINT NOT NULL,
    "sampel" INTEGER NOT NULL,
    "minimum" INTEGER NOT NULL,
    "maksimum" INTEGER NOT NULL,
    "menipis" INTEGER NOT NULL,
    "kosong" INTEGER NOT NULL,
    CONSTRAINT "agg_price_daily_pkey" PRIMARY KEY ("hari","unit_id","commodity_id","kabupaten")
);
-- CreateTable
CREATE TABLE "agg_state" (
    "key" TEXT NOT NULL,
    "value" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "agg_state_pkey" PRIMARY KEY ("key")
);
-- CreateIndex
CREATE INDEX "agg_unit_daily_unit_id_hari_idx" ON "agg_unit_daily"("unit_id", "hari");
-- CreateIndex
CREATE INDEX "agg_user_daily_unit_id_hari_idx" ON "agg_user_daily"("unit_id", "hari");
-- CreateIndex
CREATE INDEX "agg_user_daily_user_id_hari_idx" ON "agg_user_daily"("user_id", "hari");
-- CreateIndex
CREATE INDEX "agg_price_daily_unit_id_hari_idx" ON "agg_price_daily"("unit_id", "hari");
-- Deteksi laporan yang berubah sejak penyegaran agregat terakhir.
CREATE INDEX "reports_updated_at_idx" ON "reports"("updated_at");
