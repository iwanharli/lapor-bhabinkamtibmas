import { CalendarDays, Gauge } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, Delta, PageHeader, SectionLabel, SegmentedLinks, Stack, StatCard } from '@/components/ui';
import { DailyByCategoryChart } from '@/features/dashboard/charts';
import { TotalReportsHero } from '@/features/dashboard/hero';
import { CategoryBars } from '@/features/dashboard/lists';
import { PriorityList } from '@/features/dashboard/priority-list';
import { ParticipationCard } from '@/features/dashboard/participation';
import { isSpike } from '@/features/prices/price-change';
import { PriceTiles } from '@/features/prices/price-tiles';
import { apiGet, getSessionUser } from '@/lib/api/server';
import { localDateStr, rupiah, tanggal, tzLabel } from '@/lib/format';
import type { LatestPrice, Overview } from '@/lib/types';

const PERIODS = [7, 30, 90];

export default async function RingkasanPage({ searchParams }: { searchParams: Promise<{ hari?: string }> }) {
  const user = await getSessionUser();
  if (user?.role === 'BHABIN') redirect('/laporan');

  const { hari } = await searchParams;
  const days = PERIODS.includes(Number(hari)) ? Number(hari) : 30;
  const from = new Date(Date.now() - days * 86_400_000).toISOString();

  const [ov, prices] = await Promise.all([
    apiGet<Overview>(`/analytics/overview?from=${from}`),
    apiGet<LatestPrice[]>('/analytics/prices/latest'),
  ]);
  const t = ov.totals;
  const spikes = prices.filter(isSpike);
  const avgPerBhabin = t.bhabinAktif ? t.total / t.bhabinAktif : 0;
  const prevAvg = ov.previous.bhabinAktif ? ov.previous.total / ov.previous.bhabinAktif : 0;
  // Tautan ke daftar laporan membawa rentang yang sama dengan periode ringkasan.
  const tz = user?.unit.timezone;
  const reportsHref = (q: string) => `/laporan?${q}&from=${localDateStr(-(days - 1), tz)}&to=${localDateStr(0, tz)}`;

  return (
    <>
      <PageHeader
        title="Ringkasan"
        subtitle={`${tanggal(ov.range.from, tz)} – ${tanggal(ov.range.to, tz)} · ${days} hari · ${user?.unit.nama} (${tzLabel(tz)})`}
        actions={
          <SegmentedLinks
            active={String(days)}
            items={PERIODS.map((d) => ({ key: String(d), label: `${d} hari`, href: `/?hari=${d}`, icon: d === days ? <CalendarDays size={15} /> : undefined }))}
          />
        }
      />

      {/* Layar lebar: setinggi layar, baris tengah mengisi sisa ruang (tanpa ruang kosong di bawah). */}
      <Stack className="gap-4 xl:h-[calc(100dvh-13.75rem)] xl:min-h-[660px]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-h-[132px] [&>:first-child]:sm:col-span-2 [&>:first-child]:xl:col-span-1">
          <TotalReportsHero ov={ov} />
          <ParticipationCard ov={ov} />
          <StatCard
            className="min-h-0"
            title="Rata-rata / Bhabin aktif"
            icon={<Gauge size={18} />}
            tone="accent"
            value={avgPerBhabin.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
            footer={<><Delta now={avgPerBhabin} prev={prevAvg} minBase={1} label="vs periode sebelumnya" className="text-xs" /><span className="w-full text-xs">≈ {(avgPerBhabin / days * 7).toLocaleString('id-ID', { maximumFractionDigits: 1 })} laporan per Bhabin per minggu</span></>}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Card title="Laporan per hari" subtitle={`Menurut kategori · ${days} hari`} className="flex flex-col lg:col-span-2 xl:col-span-1" bodyClassName="h-[240px] min-h-0 flex-1 px-3 py-2 xl:h-auto">
            <DailyByCategoryChart rows={ov.daily} height="100%" />
          </Card>
          <Card title="Laporan per kategori" subtitle="Klik untuk melihat daftar" className="flex flex-col" bodyClassName="min-h-0 flex-1">
            <CategoryBars rows={ov.byCategory} hrefFor={(c) => reportsHref(`category=${c}`)} />
          </Card>
          <PriorityList rows={ov.priority} moreHref={reportsHref('priority=true')} />
        </div>

        <Stack className="gap-2">
          <div className="flex items-center gap-3">
            <SectionLabel title="Harga pangan" hint="rata-rata 7 hari, dibanding 7 hari sebelumnya" className="flex-1" />
            {spikes.length > 0 && (
              <Link href="/harga-pangan" className="shrink-0 rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger hover:underline" title={spikes.map((p) => `${p.nama} ${rupiah(p.rata2)}/${p.satuan}`).join(', ')}>
                {spikes.length} lonjakan ≥10% →
              </Link>
            )}
          </div>
          <PriceTiles prices={prices} />
        </Stack>
      </Stack>
    </>
  );
}
