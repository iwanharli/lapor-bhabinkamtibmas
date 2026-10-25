-- Token integrasi juga disimpan terenkripsi (AES-GCM, DATA_ENCRYPTION_KEYS) agar superadmin bisa menyalinnya lagi dari halaman admin.
ALTER TABLE "integration_tokens" ADD COLUMN "token_enc" BYTEA;
