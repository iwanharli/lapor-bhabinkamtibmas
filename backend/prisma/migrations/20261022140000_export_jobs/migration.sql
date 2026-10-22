-- Antrean ekspor CSV: diproses worker di proses API (FOR UPDATE SKIP LOCKED), berkas di storage/exports.
CREATE TYPE "ExportJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "status" "ExportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "file_key" TEXT,
    "file_name" VARCHAR(120),
    "rows" INTEGER,
    "size_bytes" INTEGER,
    "error" TEXT,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "export_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "export_jobs_user_id_created_at_idx" ON "export_jobs"("user_id", "created_at");
CREATE INDEX "export_jobs_status_created_at_idx" ON "export_jobs"("status", "created_at");
