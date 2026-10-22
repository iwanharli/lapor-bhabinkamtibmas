import { Boxes, CalendarDays, PackageX, Percent, TrendingUp } from 'lucide-react';
import { Card, EmptyState, ExportButton, PageHeader, SectionLabel, SegmentedLinks, Stack, StatCard } from '@/components/ui';
import { CommodityFocus } from '@/features/prices/commodity-focus';
import { CommodityPicker } from '@/features/prices/commodity-picker';
import { LatestPriceTable } from '@/features/prices/latest-price-table';
import { PriceAreaTable } from '@/features/prices/price-area-table';
import { UrlUnitFilter } from '@/features/units/unit-combobox';
import { isSpike } from '@/features/prices/price-change';
import { PriceTrendChart } from '@/features/prices/price-trend-chart';
import { apiGet, getSessionUser } from '@/lib/api/server';
import { persen } from '@/lib/format';
import type { LatestPrice, PriceAreaRow, PriceTrendRow } from '@/lib/types';

const RANGES = [7, 30, 90];

export default async function HargaPanganPage({ searchParams }: { searchParams: Promise<{ c?: string; hari?: string; unitId?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.hari)) ? Number(sp.hari) : 30;
  const from = new Date(Date.now() - days * 86_400_000).toISOString();

  // Satu panggilan tren untuk semua komoditas: dipakai sparkline & grafik komoditas terpilih.
  const me = await getSessionUser();
  const [latest, trend] = await Promise.all([
    apiGet<LatestPrice[]>('/analytics/prices/latest'),
    apiGet<PriceTrendRow[]>(`/analytics/prices/trend?from=${from}`),
  ]);

  const withData = latest.filter((p) => p.sampel > 0);
  const spikes = latest.filter(isSpike);
  // Default: komoditas dengan kenaikan terbesar, agar yang paling perlu perhatian langsung tampil.
  const byChange = [...withData].sort((a, b) => (persen(b.rata2, b.rata2_sebelumnya) ?? -999) - (persen(a.rata2, a.rata2_sebelumnya) ?? -999));
  const selected = latest.find((p) => p.commodity_id === Number(sp.c)) ?? byChange[0];

  const area = selected ? await apiGet<PriceAreaRow[]>(`/analytics/prices/by-area?commodityId=${selected.commodity_id}${sp.unitId ? `&unitId=${sp.unitId}` : ''}`) : [];

  const days_ = [...new Set(trend.map((t) => t.hari))].sort();
  const series = new Map<number, (number | null)[]>();
  for (const p of latest) {
    const byDay = new Map(trend.filter((t) => t.commodity_id === p.commodity_id).map((t) => [t.hari, t.rata2]));
    series.set(p.commodity_id, days_.map((d) => byDay.get(d) ?? null));
  }
  const selectedTrend = selected ? trend.filter((t) => t.commodity_id === selected.commodity_id) : [];

  const changes = withData.map((p) => persen(p.rata2, p.rata2_sebelumnya)).filter((x): x is number => x != null);
  const avgChange = changes.length ? changes.reduce((s, x) => s + x, 0) / changes.length : null;
  const emptyStock = latest.filter((p) => p.stok_kosong > 0);
  const samples = latest.reduce((s, p) => s + p.sampel, 0);

  const href = (p: { c?: number; hari?: number }) => {
    const q = new URLSearchParams();
    const c = p.c ?? selected?.commodity_id;
    if (c) q.set('c', String(c));
    if ((p.hari ?? days) !== 30) q.set('hari', String(p.hari ?? days));
    if (sp.unitId) q.set('unitId', sp.unitId);
    const s = q.toString();
    return s ? `/harga-pangan?${s}` : '/harga-pangan';
  };

  return (
    <>
      <PageHeader
        title="Pemantauan Harga Pangan"
        subtitle="Dari laporan Bhabinkamtibmas di pasar & kios"
        actions={
          <SegmentedLinks
            active={String(days)}
            items={RANGES.map((d) => ({ key: String(d), label: `Tren ${d} hari`, href: href({ hari: d }), icon: d === days ? <CalendarDays size={15} /> : undefined }))}
          />
        }
      />

      <Stack className="gap-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
          <StatCard title="Komoditas dipantau" description="Bahan pokok dalam daftar" icon={<Boxes size={20} />} value={latest.length}
            footer={`${samples.toLocaleString('id-ID')} sampel harga, 7 hari`} />
          <StatCard alert={spikes.length > 0} title="Naik ≥10%" description="Dibanding 7 hari sebelumnya" icon={<TrendingUp size={20} />} tone="success"
            value={spikes.length} footer={spikes.length ? <span className="font-medium text-danger">{spikes.map((p) => p.nama).join(', ')}</span> : 'harga relatif stabil'} />
          <StatCard title="Ada stok kosong" description="Komoditas dengan laporan stok kosong" icon={<PackageX size={20} />} tone="warn"
            value={emptyStock.length} footer={emptyStock.length ? emptyStock.map((p) => p.nama).join(', ') : 'tidak ada'} />
          <StatCard title="Rata-rata perubahan" description="Seluruh komoditas, 7 hari" icon={<Percent size={20} />} tone="accent"
            value={avgChange == null ? '—' : `${avgChange > 0 ? '+' : ''}${avgChange.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`}
            footer={avgChange == null ? 'belum ada pembanding' : avgChange > 0 ? 'cenderung naik' : 'cenderung turun'} />
        </div>

        <Stack>
          <SectionLabel title="Pilih komoditas" hint={`sparkline: tren ${days} hari`} />
          <CommodityPicker prices={latest} series={series} selectedId={selected?.commodity_id} hrefFor={(c) => href({ c })} />
        </Stack>

        {selected && (
          <Stack>
            <SectionLabel title={selected.nama} hint="detail komoditas terpilih" />
            <Card>
              <CommodityFocus p={selected} />
            </Card>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Card title={`Tren harga ${selected.nama}`} subtitle={`Rata-rata harian, ${days} hari terakhir`} bodyClassName="p-4">
                {selectedTrend.length > 1 ? (
                  <PriceTrendChart rows={selectedTrend} nama={selected.nama} />
                ) : (
                  <EmptyState tone="neutral" title="Data tren belum cukup">Butuh laporan harga minimal di 2 hari berbeda.</EmptyState>
                )}
              </Card>
              <Card title="Sebaran per desa" subtitle="Rata-rata 7 hari · % dibanding rata-rata wilayah" bodyClassName="p-0">
                <PriceAreaTable key={`${selected.commodity_id}-${sp.unitId ?? ''}`} rows={area} average={selected.rata2} tz={me?.unit.timezone}
                  filter={<UrlUnitFilter levels={['POLDA', 'POLRES', 'POLSEK']} emptyLabel="Semua wilayah" className="sm:w-full" />} />
              </Card>
            </div>
          </Stack>
        )}

        <Stack>
          <SectionLabel title="Semua komoditas" hint="tabel lengkap 7 hari terakhir" />
          <Card actions={<ExportButton path="/exports/prices.csv" />} title="Rata-rata 7 hari" subtitle="Dibanding 7 hari sebelumnya">
            <LatestPriceTable prices={latest} selectedId={selected?.commodity_id} hrefFor={(c) => href({ c })} />
          </Card>
        </Stack>
      </Stack>
    </>
  );
}
