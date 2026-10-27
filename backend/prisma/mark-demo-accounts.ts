/**
 * Tandai akun demo (login cepat di halaman masuk; web/src/lib/dev-accounts.ts) agar dikecualikan dari verifikasi wajah
 * dan kewajiban melengkapi profil. Hanya untuk server demo/dev.
 *   npm run akun:tandai-demo
 */
import { PrismaClient } from '@prisma/client';

const KK = ['01', '71', '72', '73', '74', '75'];
const NRP = ['00000001', '90000007', '31000001', '31000002', '31000003', ...KK.flatMap((k) => [1, 2, 3, 4, 5].map((p) => `31${k}000${p}`))];

async function main() {
  const prisma = new PrismaClient();
  const res = await prisma.user.updateMany({ where: { nrp: { in: NRP } }, data: { isDemo: true } });
  console.log(`${res.count} akun demo ditandai (dari ${NRP.length} NRP).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
