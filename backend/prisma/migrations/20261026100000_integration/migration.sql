-- Integrasi Command Center (docs/teknis/05-api.md §9): token baca-saja & penanda waktu untuk sinkron bertahap.
CREATE TABLE "integration_tokens" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "nama" VARCHAR(120) NOT NULL,
    "prefix" VARCHAR(16) NOT NULL,
    "token_hash" CHAR(64) NOT NULL UNIQUE,
    "allowed_ips" TEXT[] NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3)
);
CREATE INDEX "integration_tokens_user_id_idx" ON "integration_tokens" ("user_id");
ALTER TABLE "integration_tokens" ADD CONSTRAINT "integration_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Desa: diperbarui trigger (penulis desa memakai Prisma maupun SQL mentah, mis. batas wilayah).
ALTER TABLE "villages" ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "villages_updated_at_idx" ON "villages" ("updated_at");
CREATE INDEX "users_updated_at_idx" ON "users" ("updated_at");
CREATE INDEX "attendances_server_time_idx" ON "attendances" ("server_time");

CREATE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER villages_touch BEFORE UPDATE ON "villages" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Perubahan desa binaan mengubah villages.bhabinId dan bhabins.desaIds: tandai keduanya berubah.
CREATE FUNCTION touch_user_village() RETURNS trigger AS $$
DECLARE r RECORD;
BEGIN
  r := COALESCE(NEW, OLD);
  UPDATE "villages" SET "updated_at" = now() WHERE "id" = r.village_id;
  UPDATE "users" SET "updated_at" = now() WHERE "id" = r.user_id;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER user_villages_touch AFTER INSERT OR UPDATE OR DELETE ON "user_villages"
  FOR EACH ROW EXECUTE FUNCTION touch_user_village();
