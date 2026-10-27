-- Verifikasi wajah saat login (sidik wajah terenkripsi) & penanda akun demo.
ALTER TABLE "users" ADD COLUMN "face_embedding" BYTEA;
ALTER TABLE "users" ADD COLUMN "face_enrolled_at" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;
