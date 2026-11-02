import { HeartPulse } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/components/ui';
import { METRICS, MetricKey } from '@/features/stunting-map/metrics';
import { StuntingMap } from '@/features/stunting-map/stunting-map';
import { UrlUnitFilter } from '@/features/units/unit-combobox';
import { withParams } from '@/lib/url';

export const metadata = { title: 'Peta Stunting' };

export default async function PetaStuntingPage({ searchParams }: { searchParams: Promise<{ metrik?: string; unitId?: string }> }) {
  const sp = await searchParams;
  const metric = (sp.metrik && sp.metrik in METRICS ? sp.metrik : 'rasio') as MetricKey;

  return (
    <main className="map-glass relative isolate h-[calc(100dvh-4rem)] min-h-[520px] overflow-hidden">
      <div className="map-glass-card absolute left-3 right-3 top-3 z-[600] flex flex-wrap items-center gap-2 px-3 py-2 lg:right-[23rem]">
        <span className="mr-1 inline-flex items-center gap-2 font-semibold"><HeartPulse size={18} className="text-danger" /> Peta Stunting</span>
        <nav aria-label="Ukuran yang diwarnai" className="flex flex-wrap gap-1 rounded-xl bg-bg p-1">
          {(Object.keys(METRICS) as MetricKey[]).map((k) => (
            <Link key={k} href={withParams('/peta-stunting', sp, { metrik: k === 'rasio' ? undefined : k })} aria-current={k === metric ? 'page' : undefined}
              className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition', k === metric ? 'bg-accent font-bold text-[#1a1405]' : 'text-muted hover:text-ink')}>
              {METRICS[k].short}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/keluarga" className="hidden text-xs font-medium text-primary hover:underline md:inline">Rekap tabel →</Link>
          <UrlUnitFilter levels={['POLDA', 'POLRES', 'POLSEK']} emptyLabel="Semua wilayah" className="sm:w-56" />
        </div>
      </div>
      <StuntingMap key={sp.unitId ?? ''} metric={metric} unitId={sp.unitId} />
    </main>
  );
}
