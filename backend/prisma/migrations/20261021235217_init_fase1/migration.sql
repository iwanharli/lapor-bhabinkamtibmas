-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "unit_level" AS ENUM ('MABES', 'POLDA', 'POLRES', 'POLSEK');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('BHABIN', 'VERIFIKATOR', 'PIMPINAN', 'ADMIN_UNIT', 'SUPERADMIN', 'AUDITOR', 'INTEGRASI');

-- CreateEnum
CREATE TYPE "report_category" AS ENUM ('SAMBANG', 'DETEKSI_DINI', 'PROBLEM_SOLVING', 'PENYULUHAN', 'HARGA_PANGAN', 'MAPPING_KK', 'KETAHANAN_PANGAN');

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_id" UUID,
    "level" "unit_level" NOT NULL,
    "kode" VARCHAR(32) NOT NULL,
    "nama" VARCHAR(150) NOT NULL,
    "timezone" VARCHAR(32) NOT NULL DEFAULT 'Asia/Jakarta',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "villages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kode_wilayah" VARCHAR(13) NOT NULL,
    "nama" VARCHAR(120) NOT NULL,
    "kecamatan" VARCHAR(120) NOT NULL,
    "kabupaten" VARCHAR(120) NOT NULL,
    "provinsi" VARCHAR(120) NOT NULL,
    "polsek_id" UUID,
    "geom" geometry(MultiPolygon, 4326),
    "centroid" geography(Point, 4326),

    CONSTRAINT "villages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nrp" VARCHAR(20) NOT NULL,
    "nama" VARCHAR(150) NOT NULL,
    "pangkat" VARCHAR(40),
    "jabatan" VARCHAR(120),
    "role" "user_role" NOT NULL,
    "unit_id" UUID NOT NULL,
    "phone" VARCHAR(20),
    "password_hash" TEXT NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_villages" (
    "user_id" UUID NOT NULL,
    "village_id" UUID NOT NULL,
    "since" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "until" DATE,

    CONSTRAINT "user_villages_pkey" PRIMARY KEY ("user_id","village_id","since")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_id" VARCHAR(128) NOT NULL,
    "platform" VARCHAR(10) NOT NULL,
    "model" VARCHAR(100),
    "app_version" VARCHAR(20),
    "push_token" TEXT,
    "revoked_at" TIMESTAMPTZ,
    "last_seen_at" TIMESTAMPTZ,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commodities" (
    "id" SERIAL NOT NULL,
    "kode" VARCHAR(32) NOT NULL,
    "nama" VARCHAR(80) NOT NULL,
    "satuan_default" VARCHAR(10) NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "commodities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_schemas" (
    "id" SERIAL NOT NULL,
    "category" "report_category" NOT NULL,
    "version" INTEGER NOT NULL,
    "schema" JSONB NOT NULL,
    "auto_approve" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    "published_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(60) NOT NULL,
    "entity" VARCHAR(40),
    "entity_id" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "units_kode_key" ON "units"("kode");

-- CreateIndex
CREATE INDEX "units_parent_id_idx" ON "units"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "villages_kode_wilayah_key" ON "villages"("kode_wilayah");

-- CreateIndex
CREATE INDEX "villages_polsek_id_idx" ON "villages"("polsek_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_nrp_key" ON "users"("nrp");

-- CreateIndex
CREATE INDEX "users_unit_id_idx" ON "users"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_user_id_device_id_key" ON "devices"("user_id", "device_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "commodities_kode_key" ON "commodities"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "form_schemas_category_version_key" ON "form_schemas"("category", "version");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_at_idx" ON "audit_logs"("actor_id", "at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "villages" ADD CONSTRAINT "villages_polsek_id_fkey" FOREIGN KEY ("polsek_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_villages" ADD CONSTRAINT "user_villages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_villages" ADD CONSTRAINT "user_villages_village_id_fkey" FOREIGN KEY ("village_id") REFERENCES "villages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
