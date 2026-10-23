-- Hanya posisi terakhir (realtime) yang disimpan; jejak/riwayat lokasi tidak disimpan.
DROP TABLE IF EXISTS "location_pings";
CREATE TABLE "last_locations" (
    "user_id" UUID PRIMARY KEY,
    "unit_id" UUID NOT NULL,
    "client_time" TIMESTAMPTZ(3) NOT NULL,
    "server_time" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "gps_accuracy_m" REAL,
    "is_mock_location" BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX "last_locations_unit_id_idx" ON "last_locations" ("unit_id");
