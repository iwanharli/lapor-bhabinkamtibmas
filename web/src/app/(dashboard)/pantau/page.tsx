import { redirect } from 'next/navigation';
import { TrackingMonitor } from '@/features/tracking/tracking-monitor';
import { UrlUnitFilter } from '@/features/units/unit-combobox';
import { apiGet, getSessionUser } from '@/lib/api/server';
import { withParams } from '@/lib/url';

const VIEWERS = ['PIMPINAN', 'ADMIN_UNIT', 'SUPERADMIN'];

export default async function PantauPage({ searchParams }: { searchParams: Promise<{ unitId?: string }> }) {
  const me = await getSessionUser();
  if (!me || !VIEWERS.includes(me.role)) redirect('/');
  const { unitId } = await searchParams;
  const { bbox } = await apiGet<{ bbox: [number, number, number, number] | null }>(withParams('/units/bounds', { unitId }));
  return (
    <main className="map-glass relative isolate h-[calc(100dvh-4rem)] min-h-[520px] overflow-hidden">
      <TrackingMonitor key={unitId ?? ''} unitId={unitId} home={bbox} />
      <div className="map-glass-card absolute left-3 top-3 z-[600] flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div>
          <h1 className="text-sm font-bold">Monitoring Personel</h1>
          <p className="text-[11px] text-muted">Posisi terkini Bhabinkamtibmas selama jam dinas</p>
        </div>
        <UrlUnitFilter emptyLabel="Semua wilayah" className="w-56" />
      </div>
    </main>
  );
}
