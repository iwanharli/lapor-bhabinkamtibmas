import type { UnitOption } from './types';

/** Peran yang boleh diberikan oleh admin unit (superadmin & integrasi hanya oleh superadmin). */
export const ASSIGNABLE_ROLES = ['BHABIN', 'VERIFIKATOR', 'PIMPINAN', 'ADMIN_UNIT', 'AUDITOR'];

export const CHILD_LEVEL_LABEL: Record<string, string> = { MABES: 'Polda', POLDA: 'Polres', POLRES: 'Polsek' };

/** Induk unit yang berada di luar daftar (akar pohon dalam cakupan pengguna). */
export function rootParents(units: UnitOption[]) {
  const ids = new Set(units.map((u) => u.id));
  return [...new Set(units.filter((u) => !u.parentId || !ids.has(u.parentId)).map((u) => u.parentId))];
}

/** Unit diratakan dalam urutan pohon beserta kedalamannya. */
export function flattenTree(units: UnitOption[]) {
  const out: (UnitOption & { depth: number })[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const u of units.filter((x) => x.parentId === parentId).sort((a, b) => a.nama.localeCompare(b.nama))) {
      out.push({ ...u, depth });
      walk(u.id, depth + 1);
    }
  };
  for (const root of rootParents(units)) walk(root, 0);
  return out;
}

/** Pilihan <select> unit dengan indentasi pohon. */
export function unitOptions(units: UnitOption[]) {
  return flattenTree(units).map((u) => ({ id: u.id, level: u.level, label: `${'   '.repeat(u.depth)}${u.nama}` }));
}
