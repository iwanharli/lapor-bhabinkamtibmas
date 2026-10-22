-- Laporan tidak lagi diverifikasi: setiap laporan terkirim langsung final (SUBMITTED).
-- Nilai enum lama tetap ada (riwayat status & audit), tetapi tidak dipakai lagi.
UPDATE "reports"
SET "status" = 'SUBMITTED', "submitted_at" = coalesce("submitted_at", "received_at", "created_at")
WHERE "status" IN ('IN_REVIEW', 'NEEDS_REVISION', 'APPROVED', 'REJECTED');

-- Akun Verifikator menjadi Pimpinan (pemantau). Sesi lama dicabut agar token dengan peran lama tidak dipakai.
UPDATE "refresh_tokens" SET "revoked_at" = now()
WHERE "revoked_at" IS NULL AND "user_id" IN (SELECT "id" FROM "users" WHERE "role" = 'VERIFIKATOR');
UPDATE "users" SET "role" = 'PIMPINAN' WHERE "role" = 'VERIFIKATOR';
