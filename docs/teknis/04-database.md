# 04 — Database (PostgreSQL 16 + PostGIS)

## 1. Konvensi

- Nama tabel & kolom `snake_case`, tabel jamak.
- Primary key `uuid` (`gen_random_uuid()`), kecuali tabel referensi kecil.
- Semua waktu `timestamptz` (disimpan UTC, ditampilkan WIB/WITA/WIT sesuai unit).
- Koordinat `geography(Point, 4326)`. Batas desa `geometry(MultiPolygon, 4326)`.
- Soft delete dengan `deleted_at` untuk tabel master. Laporan tidak pernah dihapus fisik.
- Migrasi dikelola Prisma. Fitur khusus PostGIS/trigger ditulis sebagai migrasi SQL mentah.

## 2. Diagram relasi

```
units ─┬─< users ─┬─< reports ─┬─< attachments
       │          │            ├─< report_items >── commodities
       │          │            └─< report_status_history
       │          ├─< user_villages >── villages
       │          ├─< attendances
       │          ├─< devices
       │          └─< refresh_tokens
       └─< units (parent)

form_schemas ── (category, version) ──< reports
audit_logs (actor → users)
report_counters (unit, category, period)
```

## 3. DDL

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== Enum =====
CREATE TYPE unit_level      AS ENUM ('MABES','POLDA','POLRES','POLSEK');
CREATE TYPE user_role       AS ENUM ('BHABIN','VERIFIKATOR','PIMPINAN','ADMIN_UNIT','SUPERADMIN','AUDITOR','INTEGRASI');
CREATE TYPE report_category AS ENUM ('SAMBANG','DETEKSI_DINI','PROBLEM_SOLVING','PENYULUHAN','HARGA_PANGAN','MAPPING_KK','KETAHANAN_PANGAN');
CREATE TYPE report_status   AS ENUM ('DRAFT','SUBMITTED','IN_REVIEW','NEEDS_REVISION','APPROVED','REJECTED');
CREATE TYPE stock_status    AS ENUM ('AMAN','MENIPIS','KOSONG');
CREATE TYPE attendance_type AS ENUM ('CHECK_IN','CHECK_OUT');
CREATE TYPE attachment_src  AS ENUM ('CAMERA','FILE');

-- ===== Organisasi & wilayah =====
CREATE TABLE units (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid REFERENCES units(id),
  level       unit_level NOT NULL,
  kode        varchar(32) NOT NULL UNIQUE,
  nama        varchar(150) NOT NULL,
  timezone    varchar(32) NOT NULL DEFAULT 'Asia/Jakarta',
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX ON units(parent_id);

CREATE TABLE villages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_wilayah varchar(13) NOT NULL UNIQUE,     -- kode Kemendagri, mis. 32.01.01.2001
  nama        varchar(120) NOT NULL,
  kecamatan   varchar(120) NOT NULL,
  kabupaten   varchar(120) NOT NULL,
  provinsi    varchar(120) NOT NULL,
  polsek_id   uuid REFERENCES units(id),        -- unit yang membawahi
  geom        geometry(MultiPolygon, 4326),
  centroid    geography(Point, 4326)
);
CREATE INDEX ON villages USING gist(geom);
CREATE INDEX ON villages(polsek_id);

-- ===== Pengguna =====
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nrp           varchar(20) NOT NULL UNIQUE,
  nama          varchar(150) NOT NULL,
  pangkat       varchar(40),
  jabatan       varchar(120),
  role          user_role NOT NULL,
  unit_id       uuid NOT NULL REFERENCES units(id),
  phone         varchar(20),
  password_hash text NOT NULL,                  -- argon2id
  must_change_password boolean NOT NULL DEFAULT true,
  active        boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON users(unit_id);

CREATE TABLE user_villages (
  user_id    uuid REFERENCES users(id),
  village_id uuid REFERENCES villages(id),
  since      date NOT NULL DEFAULT current_date,
  until      date,
  PRIMARY KEY (user_id, village_id, since)
);

CREATE TABLE devices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id),
  device_id    varchar(128) NOT NULL,           -- ID instalasi aplikasi
  platform     varchar(10) NOT NULL,            -- android / ios
  model        varchar(100),
  app_version  varchar(20),
  push_token   text,
  revoked_at   timestamptz,
  last_seen_at timestamptz,
  UNIQUE (user_id, device_id)
);

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  device_id   uuid REFERENCES devices(id),
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ===== Master data =====
CREATE TABLE commodities (
  id             serial PRIMARY KEY,
  kode           varchar(32) NOT NULL UNIQUE,
  nama           varchar(80) NOT NULL,
  satuan_default varchar(10) NOT NULL,
  urutan         int NOT NULL DEFAULT 0,
  active         boolean NOT NULL DEFAULT true
);

CREATE TABLE form_schemas (
  id           serial PRIMARY KEY,
  category     report_category NOT NULL,
  version      int NOT NULL,
  schema       jsonb NOT NULL,
  auto_approve boolean NOT NULL DEFAULT false,
  status       varchar(10) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE / RETIRED
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, version)
);

-- ===== Laporan =====
CREATE TABLE reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_uuid     uuid NOT NULL UNIQUE,
  nomor           varchar(40) UNIQUE,
  category        report_category NOT NULL,
  schema_version  int NOT NULL,
  user_id         uuid NOT NULL REFERENCES users(id),
  unit_id         uuid NOT NULL REFERENCES units(id),   -- unit pelapor saat dibuat (snapshot)
  village_id      uuid NOT NULL REFERENCES villages(id),
  status          report_status NOT NULL DEFAULT 'DRAFT',
  priority        boolean NOT NULL DEFAULT false,
  data            jsonb NOT NULL,                       -- isian form (tanpa field sensitif)
  sensitive       bytea,                                -- field sensitif terenkripsi (AES-256-GCM)
  occurred_at     timestamptz NOT NULL,
  location        geography(Point, 4326) NOT NULL,
  gps_accuracy_m  real,
  is_mock_location boolean NOT NULL DEFAULT false,
  inside_village  boolean,
  device_id       uuid REFERENCES devices(id),
  submitted_at    timestamptz,
  received_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_by     uuid REFERENCES users(id),
  reviewed_at     timestamptz,
  review_note     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (category, schema_version) REFERENCES form_schemas(category, version)
);
CREATE INDEX ON reports(unit_id, status, occurred_at DESC);
CREATE INDEX ON reports(user_id, occurred_at DESC);
CREATE INDEX ON reports(category, occurred_at DESC);
CREATE INDEX ON reports(village_id);
CREATE INDEX ON reports USING gist(location);
CREATE INDEX ON reports USING gin(data jsonb_path_ops);

CREATE TABLE report_items (               -- baris harga pangan
  id           bigserial PRIMARY KEY,
  report_id    uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  commodity_id int NOT NULL REFERENCES commodities(id),
  harga        integer NOT NULL CHECK (harga BETWEEN 100 AND 10000000),
  satuan       varchar(10) NOT NULL,
  stok         stock_status NOT NULL,
  UNIQUE (report_id, commodity_id)
);
CREATE INDEX ON report_items(commodity_id);

CREATE TABLE attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id    uuid REFERENCES reports(id),
  field_key    varchar(64) NOT NULL,        -- field skema, mis. foto_lapangan
  client_uuid  uuid NOT NULL UNIQUE,
  object_key   text NOT NULL,               -- path relatif di storage (disk atau S3)
  thumb_key    text,
  mime         varchar(60) NOT NULL,
  size_bytes   integer NOT NULL,
  sha256       char(64) NOT NULL,
  source       attachment_src NOT NULL,
  captured_at  timestamptz,
  location     geography(Point, 4326),
  watermarked  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON attachments(report_id);

CREATE TABLE report_status_history (
  id          bigserial PRIMARY KEY,
  report_id   uuid NOT NULL REFERENCES reports(id),
  from_status report_status,
  to_status   report_status NOT NULL,
  actor_id    uuid NOT NULL REFERENCES users(id),
  note        text,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON report_status_history(report_id, at);

CREATE TABLE report_counters (
  unit_id   uuid REFERENCES units(id),     -- Polres
  category  report_category,
  period    char(4),                       -- YYMM
  last_no   int NOT NULL DEFAULT 0,
  PRIMARY KEY (unit_id, category, period)
);

-- ===== Absensi =====
CREATE TABLE attendances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_uuid     uuid NOT NULL UNIQUE,
  user_id         uuid NOT NULL REFERENCES users(id),
  type            attendance_type NOT NULL,
  work_date       date NOT NULL,           -- tanggal lokal unit
  client_time     timestamptz NOT NULL,
  server_time     timestamptz NOT NULL DEFAULT now(),
  location        geography(Point, 4326) NOT NULL,
  gps_accuracy_m  real,
  is_mock_location boolean NOT NULL DEFAULT false,
  inside_village  boolean,
  village_id      uuid REFERENCES villages(id),
  selfie_id       uuid REFERENCES attachments(id),
  late_sync       boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, work_date, type)
);

-- ===== Audit =====
CREATE TABLE audit_logs (
  id         bigserial PRIMARY KEY,
  actor_id   uuid REFERENCES users(id),
  action     varchar(60) NOT NULL,         -- LOGIN, REPORT_SUBMIT, REPORT_APPROVE, SENSITIVE_READ, ...
  entity     varchar(40),
  entity_id  text,
  meta       jsonb,
  ip         inet,
  user_agent text,
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_logs(actor_id, at DESC);
CREATE INDEX ON audit_logs(entity, entity_id);
-- audit_logs bersifat append-only: user aplikasi hanya punya hak INSERT & SELECT.
```

## 4. Contoh query

**Cek titik di dalam desa binaan (toleransi 200 m):**
```sql
SELECT v.id
FROM user_villages uv JOIN villages v ON v.id = uv.village_id
WHERE uv.user_id = $1 AND uv.until IS NULL
  AND ST_DWithin(v.geom::geography, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography, 200)
LIMIT 1;
```

**Rata-rata harga harian per komoditas per kabupaten:**
```sql
SELECT date_trunc('day', r.occurred_at AT TIME ZONE 'Asia/Jakarta') AS hari,
       v.kabupaten, c.nama AS komoditas,
       round(avg(i.harga)) AS rata2, min(i.harga) AS minimum, max(i.harga) AS maksimum,
       count(*) AS sampel
FROM report_items i
JOIN reports r     ON r.id = i.report_id AND r.status IN ('SUBMITTED','IN_REVIEW','APPROVED')
JOIN villages v    ON v.id = r.village_id
JOIN commodities c ON c.id = i.commodity_id
WHERE r.occurred_at >= now() - interval '30 days'
GROUP BY 1, 2, 3
ORDER BY 1;
```

## 5. Materialized view untuk dashboard

```sql
CREATE MATERIALIZED VIEW mv_report_daily AS
SELECT date_trunc('day', occurred_at AT TIME ZONE 'Asia/Jakarta')::date AS hari,
       unit_id, village_id, category, status, count(*) AS jumlah
FROM reports
GROUP BY 1, 2, 3, 4, 5;
CREATE UNIQUE INDEX ON mv_report_daily(hari, unit_id, village_id, category, status);
-- Diperbarui worker tiap 15 menit: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_report_daily;
```

## 6. Data sensitif

- Field bertipe `nik` dan identitas pihak mediasi **tidak** disimpan di `data`. Field ini dienkripsi di aplikasi (AES-256-GCM, kunci dari env/secret file, rotasi via `key_id` di header ciphertext) lalu disimpan di `reports.sensitive`.
- Untuk pencarian NIK (jika diperlukan) gunakan kolom HMAC terpisah (`nik_hmac`), bukan NIK asli.

## 7. Partisi & retensi

- Saat volume > 50 juta baris, `reports` dan `audit_logs` dipartisi per bulan (`PARTITION BY RANGE (occurred_at)`).
- Retensi mengikuti kebijakan instansi. Usulan: laporan permanen, audit log 5 tahun, file lampiran 5 tahun (arsip ke storage dingin setelah 1 tahun).

## 8. Seed awal

1. Hierarki unit (Mabes → Polda → Polres → Polsek) dari data instansi.
2. Desa/kelurahan + poligon batas (sumber: Kemendagri / BIG / BPS).
3. Master komoditas.
4. Skema form versi 1 dari `packages/form-schemas/`.
5. Akun `SUPERADMIN` awal (sandi wajib diganti pada login pertama).
