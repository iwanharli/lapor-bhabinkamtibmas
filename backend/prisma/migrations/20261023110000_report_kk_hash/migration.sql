-- Sidik No. KK (HMAC, bukan nomor asli) agar rekap keluarga menghitung satu KK sekali.
ALTER TABLE "reports" ADD COLUMN "kk_hash" CHAR(64);
CREATE INDEX "reports_kk_hash_idx" ON "reports" ("kk_hash") WHERE "kk_hash" IS NOT NULL;
