import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UnitsService } from '../units/units.service';
import { ImportRowDto } from './dto/user.dto';

export const MAX_IMPORT_ROWS = 1000;

/** Peran boleh ditulis sebagai kode (BHABIN) atau label (Bhabinkamtibmas). */
const ROLE_ALIASES: Record<string, UserRole> = {
  bhabin: UserRole.BHABIN, bhabinkamtibmas: UserRole.BHABIN,
  // Peran Verifikator dihapus; templat lama dipetakan ke Pimpinan (pemantau).
  verifikator: UserRole.PIMPINAN,
  pimpinan: UserRole.PIMPINAN,
  admin_unit: UserRole.ADMIN_UNIT, 'admin unit': UserRole.ADMIN_UNIT, admin: UserRole.ADMIN_UNIT,
  auditor: UserRole.AUDITOR,
  superadmin: UserRole.SUPERADMIN,
};

export interface ImportResultRow {
  row: number;
  nrp: string;
  nama: string;
  role?: UserRole;
  unit?: string;
  villages: string[];
  errors: string[];
}

const tempPassword = () => 'Lapor-' + randomBytes(6).toString('base64url');

@Injectable()
export class UsersImportService {
  constructor(private prisma: PrismaService, private units: UnitsService, private audit: AuditService) {}

  async validate(me: AuthUser, rows: ImportRowDto[]) {
    if (!rows.length) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'File tidak berisi baris data' });
    if (rows.length > MAX_IMPORT_ROWS) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: `Maksimal ${MAX_IMPORT_ROWS} baris per impor` });

    const scope = await this.units.descendantIds(me.unitId);
    const nrps = rows.map((r) => r.nrp?.trim()).filter((n): n is string => !!n);
    const villageCodes = [...new Set(rows.flatMap((r) => splitList(r.desa)))];
    const [units, existing, villages] = await Promise.all([
      this.prisma.unit.findMany({ where: { id: { in: scope } }, select: { id: true, kode: true, nama: true, level: true } }),
      this.prisma.user.findMany({ where: { nrp: { in: nrps } }, select: { nrp: true } }),
      this.prisma.village.findMany({ where: { kodeWilayah: { in: villageCodes } }, select: { id: true, kodeWilayah: true, nama: true, polsekId: true } }),
    ]);
    const unitByCode = new Map(units.map((u) => [u.kode.toUpperCase(), u]));
    const taken = new Set(existing.map((e) => e.nrp));
    const villageByCode = new Map(villages.map((v) => [v.kodeWilayah, v]));
    const seen = new Map<string, number>();

    const results: (ImportResultRow & { unitId?: string; villageIds: string[] })[] = rows.map((r, i) => {
      const errors: string[] = [];
      const nrp = (r.nrp ?? '').trim();
      const nama = (r.nama ?? '').trim();
      if (!/^\d{4,20}$/.test(nrp)) errors.push('NRP harus angka 4–20 digit');
      else if (taken.has(nrp)) errors.push('NRP sudah terdaftar');
      else if (seen.has(nrp)) errors.push(`NRP ganda dengan baris ${seen.get(nrp)}`);
      else seen.set(nrp, i + 1);
      if (nama.length < 2) errors.push('Nama wajib diisi');

      const role = ROLE_ALIASES[(r.peran ?? '').trim().toLowerCase().replace(/\s+/g, ' ')];
      if (!role) errors.push(`Peran "${r.peran ?? ''}" tidak dikenal`);
      else if ((role === UserRole.SUPERADMIN || role === UserRole.INTEGRASI) && me.role !== UserRole.SUPERADMIN) errors.push('Peran ini hanya dapat diberikan superadmin');

      const unit = unitByCode.get((r.kode_unit ?? '').trim().toUpperCase());
      if (!unit) errors.push(`Kode unit "${r.kode_unit ?? ''}" tidak ditemukan dalam cakupan Anda`);

      const villageIds: string[] = [];
      const villageNames: string[] = [];
      for (const code of splitList(r.desa)) {
        const v = villageByCode.get(code);
        if (!v) errors.push(`Kode desa ${code} tidak ditemukan`);
        else if (role !== UserRole.BHABIN) errors.push('Desa binaan hanya untuk Bhabinkamtibmas');
        else if (unit && v.polsekId !== unit.id) errors.push(`Desa ${v.nama} bukan wilayah ${unit.nama}`);
        else {
          villageIds.push(v.id);
          villageNames.push(v.nama);
        }
      }
      if (role === UserRole.BHABIN && unit && unit.level !== 'POLSEK') errors.push('Bhabinkamtibmas harus ditempatkan di Polsek');

      return { row: i + 1, nrp, nama, role, unit: unit?.nama, unitId: unit?.id, villages: villageNames, villageIds, errors };
    });

    return { results, valid: results.every((r) => !r.errors.length) };
  }

  async preview(me: AuthUser, rows: ImportRowDto[]) {
    const { results, valid } = await this.validate(me, rows);
    return { valid, total: results.length, errorCount: results.filter((r) => r.errors.length).length, rows: results.map(({ unitId, villageIds, ...r }) => r) };
  }

  /** Simpan semua baris dalam satu transaksi; bila ada satu baris salah, tidak ada yang disimpan. */
  async commit(me: AuthUser, rows: ImportRowDto[]) {
    const { results, valid } = await this.validate(me, rows);
    if (!valid) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Masih ada baris yang belum valid; perbaiki lalu pratinjau ulang' });

    const today = new Date(new Date().toISOString().slice(0, 10));
    const prepared = await Promise.all(
      results.map(async (r, i) => {
        const password = tempPassword();
        return { r, src: rows[i], password, hash: await argon2.hash(password, { type: argon2.argon2id }) };
      }),
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const out: { nrp: string; nama: string; temporaryPassword: string }[] = [];
      for (const { r, src, password, hash } of prepared) {
        const user = await tx.user.create({
          data: {
            nrp: r.nrp, nama: r.nama, role: r.role!, unitId: r.unitId!, passwordHash: hash,
            pangkat: src.pangkat?.trim() || null, jabatan: src.jabatan?.trim() || null, phone: src.no_hp?.trim() || null,
          },
        });
        if (r.villageIds.length) {
          await tx.userVillage.createMany({ data: r.villageIds.map((villageId) => ({ userId: user.id, villageId, since: today })) });
        }
        out.push({ nrp: r.nrp, nama: r.nama, temporaryPassword: password });
      }
      await this.audit.log({ actorId: me.id, action: 'USER_IMPORT', entity: 'user', meta: { count: out.length } as Prisma.InputJsonValue }, tx);
      return out;
    }, { timeout: 60_000 });

    return { created: created.length, users: created };
  }
}

function splitList(v?: string) {
  return (v ?? '').split(/[|,;]/).map((s) => s.trim()).filter(Boolean);
}
