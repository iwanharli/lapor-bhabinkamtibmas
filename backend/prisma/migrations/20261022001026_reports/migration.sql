-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NEEDS_REVISION', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "stock_status" AS ENUM ('AMAN', 'MENIPIS', 'KOSONG');

-- CreateEnum
CREATE TYPE "attachment_src" AS ENUM ('CAMERA', 'FILE');

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_uuid" UUID NOT NULL,
    "nomor" VARCHAR(40),
    "category" "report_category" NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "village_id" UUID NOT NULL,
    "status" "report_status" NOT NULL DEFAULT 'DRAFT',
    "priority" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB NOT NULL,
    "sensitive" BYTEA,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "location" geography(Point, 4326) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "gps_accuracy_m" REAL,
    "is_mock_location" BOOLEAN NOT NULL DEFAULT false,
    "inside_village" BOOLEAN,
    "submitted_at" TIMESTAMPTZ,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "review_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_items" (
    "id" BIGSERIAL NOT NULL,
    "report_id" UUID NOT NULL,
    "commodity_id" INTEGER NOT NULL,
    "harga" INTEGER NOT NULL,
    "satuan" VARCHAR(10) NOT NULL,
    "stok" "stock_status" NOT NULL,

    CONSTRAINT "report_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_id" UUID,
    "field_key" VARCHAR(64) NOT NULL,
    "client_uuid" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "thumb_key" TEXT,
    "mime" VARCHAR(60) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "source" "attachment_src" NOT NULL,
    "captured_at" TIMESTAMPTZ,
    "watermarked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_status_history" (
    "id" BIGSERIAL NOT NULL,
    "report_id" UUID NOT NULL,
    "from_status" "report_status",
    "to_status" "report_status" NOT NULL,
    "actor_id" UUID NOT NULL,
    "note" TEXT,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_counters" (
    "unit_id" UUID NOT NULL,
    "category" "report_category" NOT NULL,
    "period" CHAR(4) NOT NULL,
    "last_no" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "report_counters_pkey" PRIMARY KEY ("unit_id","category","period")
);

-- CreateIndex
CREATE UNIQUE INDEX "reports_client_uuid_key" ON "reports"("client_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "reports_nomor_key" ON "reports"("nomor");

-- CreateIndex
CREATE INDEX "reports_unit_id_status_occurred_at_idx" ON "reports"("unit_id", "status", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "reports_user_id_occurred_at_idx" ON "reports"("user_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "reports_category_occurred_at_idx" ON "reports"("category", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "reports_village_id_idx" ON "reports"("village_id");

-- CreateIndex
CREATE INDEX "report_items_commodity_id_idx" ON "report_items"("commodity_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_items_report_id_commodity_id_key" ON "report_items"("report_id", "commodity_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_client_uuid_key" ON "attachments"("client_uuid");

-- CreateIndex
CREATE INDEX "attachments_report_id_idx" ON "attachments"("report_id");

-- CreateIndex
CREATE INDEX "report_status_history_report_id_at_idx" ON "report_status_history"("report_id", "at");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_village_id_fkey" FOREIGN KEY ("village_id") REFERENCES "villages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_items" ADD CONSTRAINT "report_items_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_items" ADD CONSTRAINT "report_items_commodity_id_fkey" FOREIGN KEY ("commodity_id") REFERENCES "commodities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_status_history" ADD CONSTRAINT "report_status_history_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_status_history" ADD CONSTRAINT "report_status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
