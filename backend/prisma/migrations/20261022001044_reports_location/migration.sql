-- AlterTable
ALTER TABLE "reports" ALTER COLUMN "location" DROP NOT NULL;

-- location selalu diturunkan dari lat/lng agar aplikasi cukup menulis angka koordinat.
CREATE OR REPLACE FUNCTION reports_set_location() RETURNS trigger AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reports_location_trg
  BEFORE INSERT OR UPDATE OF lat, lng ON reports
  FOR EACH ROW EXECUTE FUNCTION reports_set_location();

CREATE INDEX reports_location_gist ON reports USING gist (location);
CREATE INDEX reports_data_gin ON reports USING gin (data jsonb_path_ops);
CREATE INDEX villages_geom_gist ON villages USING gist (geom);

-- Audit log append-only: role aplikasi tidak boleh mengubah/menghapus baris.
CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs bersifat append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
