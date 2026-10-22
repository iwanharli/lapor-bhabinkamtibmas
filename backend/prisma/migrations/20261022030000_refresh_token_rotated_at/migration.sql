-- Waktu rotasi refresh token (untuk masa toleransi request paralel).
ALTER TABLE "refresh_tokens" ADD COLUMN "rotated_at" TIMESTAMPTZ;
