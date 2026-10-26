import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** 1 provinsi, 2 kabupaten/kota, 3 kecamatan (tabel regions), 4 desa/kelurahan (tabel villages). */
export type RegionLevel = 1 | 2 | 3 | 4;

const MAX_FEATURES = 3000;
/** Toleransi penyederhanaan desa saat disajikan (derajat, ±10 m). */
const VILLAGE_SIMPLIFY = 0.0001;

@Injectable()
export class RegionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Batas wilayah sebagai GeoJSON FeatureCollection, dibatasi bbox (w,s,e,n) dan/atau induk.
   * Dipakai peta untuk menampilkan tingkat wilayah sesuai zoom.
   */
  async boundaries(level: RegionLevel, bbox?: [number, number, number, number], parent?: string) {
    const envelope = bbox ? Prisma.sql`ST_MakeEnvelope(${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}, 4326)` : null;
    let rows: { kode: string; nama: string; chain: string; geometry: string }[];

    if (level === 4) {
      if (!envelope && !parent) throw new BadRequestException({ code: 'BBOX_REQUIRED', message: 'Batas desa memerlukan bbox atau kode kecamatan' });
      rows = await this.prisma.$queryRaw`
        SELECT v.kode_wilayah AS kode, v.nama, concat_ws(' › ', v.provinsi, v.kabupaten, v.kecamatan) AS chain,
               ST_AsGeoJSON(ST_SimplifyPreserveTopology(v.geom, ${VILLAGE_SIMPLIFY}), 5) AS geometry
        FROM villages v
        WHERE v.geom IS NOT NULL
          ${envelope ? Prisma.sql`AND v.geom && ${envelope}` : Prisma.empty}
          ${parent ? Prisma.sql`AND v.kecamatan_kode = ${parent}` : Prisma.empty}
        LIMIT ${MAX_FEATURES + 1}`;
    } else {
      rows = await this.prisma.$queryRaw`
        SELECT r.kode, r.nama, r.chain, ST_AsGeoJSON(r.geom_s, 5) AS geometry
        FROM regions r
        WHERE r.level = ${level} AND r.geom_s IS NOT NULL
          ${envelope ? Prisma.sql`AND r.geom_s && ${envelope}` : Prisma.empty}
          ${parent ? Prisma.sql`AND r.parent_kode = ${parent}` : Prisma.empty}
        LIMIT ${MAX_FEATURES + 1}`;
    }

    return {
      type: 'FeatureCollection' as const,
      truncated: rows.length > MAX_FEATURES,
      features: rows.slice(0, MAX_FEATURES).map((r) => ({
        type: 'Feature' as const,
        properties: { kode: r.kode, nama: r.nama, chain: r.chain, level },
        geometry: JSON.parse(r.geometry),
      })),
    };
  }

  /** Bentuk satu wilayah (provinsi/kab/kota/kecamatan, atau desa) untuk sorotan filter peta: batas asli disederhanakan sesuai tingkat + kotak (w,s,e,n). */
  async shape(kode: string) {
    const [r] = await this.prisma.$queryRaw<{ kode: string; nama: string; level: number; geometry: string | null; w: number; s: number; e: number; n: number }[]>`
      SELECT kode, nama, level, ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, CASE level WHEN 1 THEN 0.002 WHEN 2 THEN 0.0005 ELSE 0.0002 END), 5) AS geometry,
             ST_XMin(geom) AS w, ST_YMin(geom) AS s, ST_XMax(geom) AS e, ST_YMax(geom) AS n
      FROM regions WHERE kode = ${kode} AND geom IS NOT NULL
      UNION ALL
      SELECT kode_wilayah, nama, 4, ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, ${VILLAGE_SIMPLIFY}), 5), ST_XMin(geom), ST_YMin(geom), ST_XMax(geom), ST_YMax(geom)
      FROM villages WHERE kode_wilayah = ${kode} AND geom IS NOT NULL
      LIMIT 1`;
    if (!r?.geometry) return null;
    return { kode: r.kode, nama: r.nama, level: r.level, bbox: [r.w, r.s, r.e, r.n] as [number, number, number, number], geometry: JSON.parse(r.geometry) };
  }

  /** Daftar wilayah (tanpa geometri) untuk pemilih bertingkat: tanpa induk = provinsi. */
  async list(parent?: string) {
    return this.prisma.$queryRaw<{ kode: string; nama: string; level: number; desa: number; lat: number | null; lng: number | null }[]>`
      SELECT r.kode, r.nama, r.level,
             coalesce(r.lat, ST_Y(ST_PointOnSurface(r.geom)))::float AS lat,
             coalesce(r.lng, ST_X(ST_PointOnSurface(r.geom)))::float AS lng,
             CASE WHEN r.level = 3 THEN (SELECT count(*) FROM villages v WHERE v.kecamatan_kode = r.kode)::int ELSE 0 END AS desa
      FROM regions r
      WHERE ${parent ? Prisma.sql`r.parent_kode = ${parent}` : Prisma.sql`r.level = 1`}
      ORDER BY r.nama`;
  }

  /** Rantai wilayah (provinsi → desa) yang memuat satu titik. */
  async at(lat: number, lng: number) {
    const pt = Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
    const [regions, villages] = await Promise.all([
      this.prisma.$queryRaw<{ kode: string; nama: string; level: number }[]>`
        SELECT kode, nama, level FROM regions WHERE geom && ${pt} AND ST_Intersects(geom, ${pt}) ORDER BY level`,
      this.prisma.$queryRaw<{ kode: string; nama: string }[]>`
        SELECT kode_wilayah AS kode, nama FROM villages WHERE geom && ${pt} AND ST_Intersects(geom, ${pt}) LIMIT 1`,
    ]);
    return [...regions, ...villages.map((v) => ({ ...v, level: 4 }))];
  }
}
