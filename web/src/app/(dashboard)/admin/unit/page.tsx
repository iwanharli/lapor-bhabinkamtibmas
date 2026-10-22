import { Building2, MapPinned, Shield, Users } from 'lucide-react';
import { Card, PageHeader, Stack, StatCard } from '@/components/ui';
import { AddUnitButton } from '@/features/admin/add-unit-button';
import { UnitTree } from '@/features/admin/unit-tree';
import { apiGet } from '@/lib/api/server';
import type { UnitOption } from '@/lib/types';

export default async function UnitPage() {
  const units = await apiGet<UnitOption[]>('/units');
  const count = (level: string) => units.filter((u) => u.level === level).length;
  const sum = (k: 'users' | 'bhabin' | 'villages') => units.reduce((s, u) => s + (u.counts?.[k] ?? 0), 0);
  const polsekTanpaBhabin = units.filter((u) => u.level === 'POLSEK' && !u.counts?.bhabin).length;

  return (
    <>
      <PageHeader title="Unit" subtitle="Struktur satuan kerja dalam cakupan Anda" actions={<AddUnitButton units={units} />} />
      <Stack>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
          <StatCard title="Polres" description="Dalam cakupan" icon={<Building2 size={20} />} value={count('POLRES')} footer={count('POLDA') ? `di bawah ${count('POLDA')} Polda` : `membawahi ${count('POLSEK')} Polsek`} />
          <StatCard title="Polsek" description="Unit tempat Bhabin bertugas" icon={<Building2 size={20} />} tone="accent" value={count('POLSEK')}
            footer={polsekTanpaBhabin ? <span className="text-warn">{polsekTanpaBhabin} belum punya Bhabin</span> : 'semua punya Bhabin'} />
          <StatCard title="Bhabinkamtibmas" description="Akun Bhabin aktif" icon={<Shield size={20} />} tone="info" value={sum('bhabin')} footer={`${sum('users')} personel aktif total`} />
          <StatCard title="Desa / kelurahan" description="Wilayah binaan terdaftar" icon={<MapPinned size={20} />} tone="success" value={sum('villages')}
            footer={count('POLSEK') ? `± ${(sum('villages') / count('POLSEK')).toLocaleString('id-ID', { maximumFractionDigits: 1 })} desa per Polsek` : undefined} />
        </div>
        <Card title="Struktur unit" subtitle="Arahkan kursor ke baris untuk menambah unit turunan" actions={<span className="inline-flex items-center gap-1.5 text-xs text-muted"><Users size={14} /> jumlah langsung per unit</span>}>
          <UnitTree units={units} />
        </Card>
      </Stack>
    </>
  );
}
