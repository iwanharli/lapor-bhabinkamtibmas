import { ReportMap } from '@/features/map/report-map';
import { MapOverlays } from '@/features/map/map-overlays';
import type { MapSummary } from '@/features/map/categories';
import { apiGet } from '@/lib/api/server';
import { withParams } from '@/lib/url';

type Search = { hari?: string; category?: string; priority?: string; unitId?: string; regionCode?: string; regionLevel?: string; provinsiKode?: string; kabupatenKode?: string; kecamatanKode?: string };
const RANGES = [7, 30, 90];

export default async function PetaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.hari)) ? Number(sp.hari) : 7;
  const from = new Date(Date.now() - days * 86_400_000).toISOString();
  const regionCode = sp.kecamatanKode || sp.kabupatenKode || sp.provinsiKode;
  const regionLevel = sp.kecamatanKode ? '3' : sp.kabupatenKode ? '2' : sp.provinsiKode ? '1' : undefined;
  const [summary, { bbox }] = await Promise.all([apiGet<MapSummary>(withParams('/analytics/map/summary', { from, category: sp.category, priority: sp.priority, unitId: sp.unitId, regionCode, regionLevel })),
    apiGet<{ bbox: [number, number, number, number] | null }>(withParams('/units/bounds', { unitId: sp.unitId }))]);

  return (
    <main className="relative isolate h-[calc(100dvh-4rem)] min-h-[520px] overflow-hidden bg-[#e8edf3]">
      <ReportMap home={bbox} filters={{ from, category: sp.category, priority: sp.priority, unitId: sp.unitId, regionCode, regionLevel: regionLevel ? Number(regionLevel) : undefined }} />
      <MapOverlays summary={summary} days={days} search={sp} />
    </main>
  );
}
