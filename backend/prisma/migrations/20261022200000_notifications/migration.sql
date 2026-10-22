-- Notifikasi dalam aplikasi per pengguna (lonceng di topbar & menu Notifikasi).
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(500),
    "link" VARCHAR(300),
    "entity_id" UUID,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);
-- Hitung belum dibaca cepat.
CREATE INDEX "notifications_unread_idx" ON "notifications"("user_id") WHERE "read_at" IS NULL;
-- Satu notifikasi per jenis per entitas per penerima (idempoten saat isi ulang).
CREATE UNIQUE INDEX "notifications_user_type_entity_key" ON "notifications"("user_id", "type", "entity_id");
