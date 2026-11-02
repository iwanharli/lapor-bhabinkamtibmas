-- Alasan penonaktifan akun; dikosongkan saat akun diaktifkan kembali (riwayatnya ada di audit log).
ALTER TABLE "users" ADD COLUMN "deactivated_reason" VARCHAR(500);
ALTER TABLE "users" ADD COLUMN "deactivated_at" TIMESTAMPTZ;
