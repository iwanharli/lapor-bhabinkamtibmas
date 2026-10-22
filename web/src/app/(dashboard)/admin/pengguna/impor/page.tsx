import { BackLink, PageHeader } from '@/components/ui';
import { UserImport } from '@/features/admin/user-import';
import { apiGet } from '@/lib/api/server';
import type { UnitOption, VillageOption } from '@/lib/types';

export default async function ImporPenggunaPage() {
  const [units, villages] = await Promise.all([apiGet<UnitOption[]>('/units'), apiGet<(VillageOption & { kodeWilayah: string })[]>('/villages')]);
  // Contoh di templat memakai kode nyata dari cakupan admin.
  const polsek = units.find((u) => u.level === 'POLSEK') ?? units[0];
  const desa = villages.filter((v) => v.polsekId === polsek?.id).slice(0, 2).map((v) => v.kodeWilayah).join('|');
  return (
    <>
      <BackLink href="/admin/pengguna" />
      <PageHeader title="Impor pengguna" subtitle="Tambahkan banyak akun sekaligus dari file CSV. Data divalidasi lebih dulu; tidak ada yang tersimpan bila masih ada baris bermasalah." />
      <UserImport unitExample={polsek?.kode ?? 'KODE-UNIT'} villageExample={desa || '32.01.01.2001'} />
    </>
  );
}
