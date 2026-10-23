-- "Ingat saya" pada login web: refresh token berumur panjang, diwariskan saat rotasi.
ALTER TABLE "refresh_tokens" ADD COLUMN "remember" BOOLEAN NOT NULL DEFAULT false;
