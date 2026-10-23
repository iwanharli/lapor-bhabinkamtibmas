import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { TrackingMonitor } from '@/features/tracking/tracking-monitor';
import { UrlUnitFilter } from '@/features/units/unit-combobox';
import { getSessionUser } from '@/lib/api/server';
import { localDateStr } from '@/lib/format';

const VIEWERS = ['PIMPINAN', 'ADMIN_UNIT', 'SUPERADMIN'];

export default async function PantauPage({ searchParams }: { searchParams: Promise<{ unitId?: string }> }) {
  const me = await getSessionUser();
  if (!me || !VIEWERS.includes(me.role)) redirect('/');
  const { unitId } = await searchParams;
  return (
    <>
      <PageHeader
        title="Pantau Personel"
        subtitle="Posisi terakhir Bhabinkamtibmas selama jam dinas dan rute hariannya"
        actions={<UrlUnitFilter emptyLabel="Semua wilayah" className="w-64" />}
      />
      <TrackingMonitor key={unitId ?? ''} unitId={unitId} today={localDateStr(0, me.unit.timezone)} />
    </>
  );
}
