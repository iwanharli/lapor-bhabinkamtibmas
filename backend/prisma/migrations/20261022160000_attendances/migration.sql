-- Absensi lapangan Bhabin (docs/teknis/03 §5): check-in/check-out harian dengan GPS & swafoto.
CREATE TYPE "AttendanceType" AS ENUM ('CHECK_IN', 'CHECK_OUT');

CREATE TABLE "attendances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_uuid" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "type" "AttendanceType" NOT NULL,
    "work_date" DATE NOT NULL,
    "client_time" TIMESTAMPTZ(3) NOT NULL,
    "server_time" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "location" geography(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography) STORED,
    "gps_accuracy_m" REAL,
    "is_mock_location" BOOLEAN NOT NULL DEFAULT false,
    "inside_village" BOOLEAN,
    "village_id" UUID,
    "distance_m" REAL,
    "selfie_id" UUID,
    "late_sync" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attendances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "attendances_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "attendances_village_id_fkey" FOREIGN KEY ("village_id") REFERENCES "villages"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "attendances_selfie_id_fkey" FOREIGN KEY ("selfie_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "attendances_client_uuid_key" ON "attendances"("client_uuid");
CREATE UNIQUE INDEX "attendances_user_id_work_date_type_key" ON "attendances"("user_id", "work_date", "type");
CREATE INDEX "attendances_unit_id_work_date_idx" ON "attendances"("unit_id", "work_date");
CREATE INDEX "attendances_location_gist" ON "attendances" USING GIST ("location");
