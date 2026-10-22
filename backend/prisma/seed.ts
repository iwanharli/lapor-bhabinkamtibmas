/**
 * Seed awal: master komoditas, skema form v1, unit Mabes, akun superadmin.
 * Untuk dev (NODE_ENV != production) juga dibuat contoh Polda/Polres/Polsek, desa, dan akun uji.
 * Aman dijalankan berulang (idempoten).
 */
import { PrismaClient, ReportCategory, UnitLevel, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const SCHEMA_DIR = join(__dirname, '../../packages/form-schemas');
const hash = (p: string) => argon2.hash(p, { type: argon2.argon2id });

async function seedMaster() {
  const commodities = JSON.parse(readFileSync(join(SCHEMA_DIR, 'commodities.json'), 'utf8'));
  for (const c of commodities) {
    await prisma.commodity.upsert({
      where: { kode: c.kode },
      create: { kode: c.kode, nama: c.nama, satuanDefault: c.satuan, urutan: c.urutan },
      update: {},
    });
  }

  for (const file of readdirSync(SCHEMA_DIR).filter((f) => /\.v\d+\.json$/.test(f))) {
    const s = JSON.parse(readFileSync(join(SCHEMA_DIR, file), 'utf8'));
    // Skema yang sudah dipublikasikan tidak ditimpa (immutable).
    const where = { category_version: { category: s.category as ReportCategory, version: s.version } };
    await prisma.formSchema.upsert({
      where,
      create: { category: s.category, version: s.version, schema: s, autoApprove: !!s.autoApprove, status: s.status ?? 'ACTIVE' },
      // Field skema immutable; hanya status aktif/ditunda yang mengikuti file.
      update: { status: s.status ?? 'ACTIVE' },
    });
    // Judul (nama kategori) boleh mengikuti file tanpa mengubah field.
    const row = await prisma.formSchema.findUniqueOrThrow({ where });
    const cur = row.schema as { title?: string };
    if (s.title && cur.title !== s.title) await prisma.formSchema.update({ where, data: { schema: { ...cur, title: s.title } } });
  }
}

async function unit(kode: string, nama: string, level: UnitLevel, parentId?: string) {
  return prisma.unit.upsert({ where: { kode }, create: { kode, nama, level, parentId }, update: {} });
}

async function user(nrp: string, nama: string, role: UserRole, unitId: string, password: string, pangkat?: string) {
  return prisma.user.upsert({
    where: { nrp },
    create: { nrp, nama, role, unitId, pangkat, passwordHash: await hash(password), mustChangePassword: false },
    update: {},
  });
}

async function seedDevSample(mabesId: string) {
  const polda = await unit('POLDA-CONTOH', 'Polda Contoh', UnitLevel.POLDA, mabesId);
  const polres = await unit('POLRES-CONTOH', 'Polres Contoh', UnitLevel.POLRES, polda.id);
  const polsek = await unit('POLSEK-CONTOH', 'Polsek Contoh', UnitLevel.POLSEK, polres.id);

  const villages = await Promise.all(
    [
      ['99.01.01.2001', 'Sukamaju'],
      ['99.01.01.2002', 'Harapan'],
    ].map(([kodeWilayah, nama]) =>
      prisma.village.upsert({
        where: { kodeWilayah },
        create: { kodeWilayah, nama, kecamatan: 'Kecamatan Contoh', kabupaten: 'Kabupaten Contoh', provinsi: 'Provinsi Contoh', polsekId: polsek.id },
        update: {},
      }),
    ),
  );

  const pw = 'Demo#12345';
  const bhabin = await user('90000001', 'Contoh Bhabin', UserRole.BHABIN, polsek.id, pw, 'Bripka');
  await user('90000002', 'Contoh Pimpinan Polsek', UserRole.PIMPINAN, polsek.id, pw, 'AKP');
  await user('90000003', 'Contoh Pimpinan', UserRole.PIMPINAN, polres.id, pw, 'AKBP');
  await user('90000004', 'Admin Polres Contoh', UserRole.ADMIN_UNIT, polres.id, pw);
  await user('90000005', 'Auditor Polda Contoh', UserRole.AUDITOR, polda.id, pw);
  // Pemantau tingkat Mabes: melihat seluruh Indonesia (data contoh nasional) tanpa hak admin.
  await user('90000007', 'Pimpinan Mabes', UserRole.PIMPINAN, mabesId, pw, 'Irjen Pol');

  await prisma.userVillage.createMany({
    // 1 Bhabin membina 1 desa; desa kedua dibina Bhabin lain (seed:demo).
    data: [{ userId: bhabin.id, villageId: villages[0].id, since: new Date('2026-01-01') }],
    skipDuplicates: true,
  });
  console.log(`Akun uji dev (sandi ${pw}): 90000001 Bhabin, 90000002 Pimpinan Polsek, 90000003 Pimpinan Polres, 90000004 Admin, 90000005 Auditor, 90000007 Pimpinan Mabes (nasional)`);
}

async function main() {
  await seedMaster();
  const mabes = await unit('MABES', 'Baharkam Polri', UnitLevel.MABES);

  const nrp = process.env.SEED_SUPERADMIN_NRP ?? '00000001';
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (!password) throw new Error('SEED_SUPERADMIN_PASSWORD wajib diisi');
  await prisma.user.upsert({
    where: { nrp },
    create: { nrp, nama: 'Superadmin', role: UserRole.SUPERADMIN, unitId: mabes.id, passwordHash: await hash(password), mustChangePassword: true },
    update: {},
  });

  if (process.env.NODE_ENV !== 'production') await seedDevSample(mabes.id);
  console.log('Seed selesai.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
