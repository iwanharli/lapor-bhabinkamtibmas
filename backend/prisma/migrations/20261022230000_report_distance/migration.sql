-- Jarak (m) titik laporan ke batas desa binaan terdekat pelapor saat dikirim; 0 = di dalam desa. Dasar label "Di luar desa".
ALTER TABLE "reports" ADD COLUMN "distance_m" REAL;

UPDATE reports r SET distance_m = d.m
FROM (
  SELECT r2.id, round(ST_Distance(v.geom::geography, r2.location))::real AS m
  FROM reports r2 JOIN villages v ON v.id = r2.village_id
  WHERE r2.location IS NOT NULL AND v.geom IS NOT NULL AND r2.inside_village IS NOT NULL
) d
WHERE d.id = r.id;

-- Label selaras jarak (toleransi 200 m).
UPDATE reports SET inside_village = (distance_m <= 200) WHERE distance_m IS NOT NULL;
