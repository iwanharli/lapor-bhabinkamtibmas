-- Jejak lokasi Bhabin selama jam dinas; masa simpan 30 hari (dihapus terjadwal).
CREATE TABLE "location_pings" (
    "id" BIGSERIAL PRIMARY KEY,
    "user_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "client_time" TIMESTAMPTZ(3) NOT NULL,
    "server_time" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "gps_accuracy_m" REAL,
    "is_mock_location" BOOLEAN NOT NULL DEFAULT false,
    "battery" SMALLINT
);
CREATE UNIQUE INDEX "location_pings_user_id_client_time_key" ON "location_pings" ("user_id", "client_time");
CREATE INDEX "location_pings_user_id_work_date_client_time_idx" ON "location_pings" ("user_id", "work_date", "client_time");
CREATE INDEX "location_pings_unit_id_work_date_idx" ON "location_pings" ("unit_id", "work_date");
CREATE INDEX "location_pings_client_time_idx" ON "location_pings" ("client_time");
