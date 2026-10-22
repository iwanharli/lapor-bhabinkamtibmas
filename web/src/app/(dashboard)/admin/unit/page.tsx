import { Building2, MapPinned, Shield, Users } from 'lucide-react';
import { Card, PageHeader, Stack, StatCard } from '@/components/ui';
import { AddUnitButton } from '@/features/admin/add-unit-button';
import { UnitTree } from '@/features/admin/unit-tree';
import { apiGet } from '@/lib/api/server';
import type { UnitNode, UnitSummary } from '@/lib/types';

export default async function UnitPage() {
  const [roots, summary] = await Promise.all([apiGet<UnitNode[]>('/units/children'), apiGet<UnitSummary>('/units/summary')]);
  const count = (level: 'polda' | 'polres' | 'polsek') => summary[level];
  const sum = (k: 'users' | 'bhabin' | 'villages') => summary[k];
  const polsekTanpaBhabin = summary.polsek_tanpa_bhabin;
  const canAdd = roots.some((r) => r.level !== 'POLSEK');

  return (
    <>
      <PageHeader title="Unit" subtitle="Struktur satuan kerja dalam cakupan Anda" actions={canAdd ? <AddUnitButton /> : undefined} />
      <Stack>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
          <StatCard title="Polres" description="Dalam cakupan" icon={<Building2 size={20} />} value={count('polres')} footer={count('polda') ? `di bawah ${count('polda')} Polda` : `membawahi ${count('polsek')} Polsek`} />
          <StatCard title="Polsek" description="Unit tempat Bhabin bertugas" icon={<Building2 size={20} />} tone="accent" value={count('polsek')}
            footer={polsekTanpaBhabin ? <span className="text-warn">{polsekTanpaBhabin} belum punya Bhabin</span> : 'semua punya Bhabin'} />
          <StatCard title="Bhabinkamtibmas" description="Akun Bhabin aktif" icon={<Shield size={20} />} tone="info" value={sum('bhabin')} footer={`${sum('users')} personel aktif total`} />
          <StatCard title="Desa / kelurahan" description="Wilayah binaan terdaftar" icon={<MapPinned size={20} />} tone="success" value={sum('villages')}
            footer={count('polsek') ? `± ${(sum('villages') / count('polsek')).toLocaleString('id-ID', { maximumFractionDigits: 1 })} desa per Polsek` : undefined} />
        </div>
        <Card title="Struktur unit" subtitle="Klik panah untuk membuka cabang · arahkan kursor ke baris untuk menambah unit turunan" actions={<span className="inline-flex items-center gap-1.5 text-xs text-muted"><Users size={14} /> jumlah langsung per unit</span>}>
          <UnitTree roots={roots} />
        </Card>
      </Stack>
    </>
  );
}
