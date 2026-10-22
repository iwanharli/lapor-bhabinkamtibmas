-- Aturan: 1 Bhabin membina 1 desa, dan 1 desa dibina 1 Bhabin (kode wilayah desa = pengenal wilayah Bhabin).
-- Rapikan penugasan aktif lama: pertahankan penugasan paling awal per desa, lalu satu desa per Bhabin;
-- sisanya ditutup (until = hari ini) sehingga riwayat tetap tersimpan.
WITH active AS (
  SELECT uv.user_id, uv.village_id, uv.since,
         row_number() OVER (PARTITION BY uv.village_id ORDER BY u.active DESC, uv.since, u.nrp) AS rn_village
  FROM user_villages uv JOIN users u ON u.id = uv.user_id
  WHERE uv.until IS NULL
), keep_village AS (
  SELECT user_id, village_id, row_number() OVER (PARTITION BY user_id ORDER BY since, village_id) AS rn_user
  FROM active WHERE rn_village = 1
)
UPDATE user_villages uv SET until = CURRENT_DATE
WHERE uv.until IS NULL
  AND NOT EXISTS (SELECT 1 FROM keep_village k WHERE k.user_id = uv.user_id AND k.village_id = uv.village_id AND k.rn_user = 1);

CREATE UNIQUE INDEX "user_villages_one_active_per_user" ON "user_villages"("user_id") WHERE "until" IS NULL;
CREATE UNIQUE INDEX "user_villages_one_active_per_village" ON "user_villages"("village_id") WHERE "until" IS NULL;
