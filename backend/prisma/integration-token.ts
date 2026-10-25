/**
 * Kelola token integrasi Command Center Pusat (/integration/*) dari server, cadangan bagi halaman
 * Admin › Token Integrasi (superadmin). Akun pemilik harus berperan INTEGRASI (dibuat superadmin di menu Pengguna).
 *
 *   npm run integrasi:token -- buat --nrp INTEGRASI-PUSAT --nama "Pusat produksi" [--ip 10.1.2.3,10.9.0.0/16]
 *   npm run integrasi:token -- daftar
 *   npm run integrasi:token -- cabut <id atau prefix lbi_xxxxxxxx>
 *
 * Rotasi: buat token baru, pasang di Pusat, lalu cabut token lama.
 * Tanpa --ip, token memakai INTEGRATION_ALLOWED_IPS; bila keduanya kosong semua permintaan ditolak.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IntegrationTokensService } from '../src/modules/integration/integration-tokens.service';
import { TOKEN_PREFIX } from '../src/modules/integration/integration.guard';
import { PrismaService } from '../src/prisma/prisma.service';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const tokens = app.get(IntegrationTokensService);
  const [cmd, target] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'));
  try {
    if (cmd === 'buat') {
      const nrp = arg('nrp');
      if (!nrp) throw new Error('--nrp wajib diisi');
      const user = await prisma.user.findUnique({ where: { nrp } });
      if (!user) throw new Error(`Akun ${nrp} tidak ada`);
      const ips = (arg('ip') ?? '').split(',');
      const t = await tokens.create(null, { userId: user.id, nama: arg('nama') ?? 'Command Center Pusat', allowedIps: ips });
      console.log(`Token dibuat (${t.id}). Bisa juga disalin lagi dari halaman Admin › Token Integrasi:\n\n${t.token}\n`);
      if (!ips.some((s) => s.trim()) && !process.env.INTEGRATION_ALLOWED_IPS) console.warn('Peringatan: tanpa --ip dan INTEGRATION_ALLOWED_IPS kosong, token ini akan selalu ditolak.');
    } else if (cmd === 'daftar') {
      const { tokens: rows } = await tokens.list();
      console.table(rows.map((t) => ({
        id: t.id, prefix: t.prefix, nama: t.nama, akun: t.user.nrp, ip: t.allowedIps.join(',') || '(INTEGRATION_ALLOWED_IPS)',
        dibuat: t.createdAt.toISOString(), terakhirDipakai: t.lastUsedAt?.toISOString() ?? '-', dicabut: t.revokedAt?.toISOString() ?? '-',
      })));
    } else if (cmd === 'cabut' && target) {
      const t = await prisma.integrationToken.findFirst({ where: target.startsWith(TOKEN_PREFIX) ? { prefix: target } : { id: target } });
      if (!t) throw new Error('Token tidak ditemukan');
      console.log((await tokens.revoke(null, t.id)) ? `Token ${t.prefix}… dicabut.` : 'Token sudah dicabut sebelumnya.');
    } else {
      console.log('Pemakaian: buat --nrp <NRP> [--nama <nama>] [--ip <ip,cidr>] | daftar | cabut <id|prefix>');
      process.exitCode = 1;
    }
  } catch (e) {
    console.error((e as { response?: { message?: string } }).response?.message ?? (e as Error).message);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main();
