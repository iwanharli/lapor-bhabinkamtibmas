import { CalendarDays, Gauge, MapPinCheck, MapPinOff, ShieldAlert, UserCheck, UserX } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Card, PageHeader, SectionLabel, SegmentedLinks, Stack, StatCard } from '@/components/ui';
import { DailyByCategoryChart } from '@/features/dashboard/charts';
import { TotalReportsHero } from '@/features/dashboard/hero';
import { CategoryBars } from '@/features/dashboard/lists';
import { PriorityCarousel } from '@/features/dashboard/priority-carousel';
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

      <Stack className="gap-6">
        {spikes.length > 0 && (
          <Alert tone="danger" title="Lonjakan harga pangan ≥10% dalam 7 hari">
            <span className="text-ink">{spikes.map((p) => `${p.nama} (${rupiah(p.rata2)}/${p.satuan})`).join(', ')}. </span>
            <Link href="/harga-pangan" className="font-semibold text-primary hover:underline">Lihat detail →</Link>
          </Alert>
        )}

        <Stack className="gap-3">
          <SectionLabel title="Aktivitas laporan" hint="periode terpilih" />
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
            <TotalReportsHero ov={ov} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 [&>*]:h-full">
              <StatCard
                title="Sesuai desa binaan"
                description="Titik laporan di dalam desa binaan pelapor"
                icon={<MapPinCheck size={20} />}
                tone="success"
                value={t.total - t.lokasi_janggal}
                footer={`${(t.total ? ((t.total - t.lokasi_janggal) / t.total) * 100 : 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% dari ${t.total.toLocaleString('id-ID')} laporan`}
              />
              <StatCard
                title="Rata-rata per Bhabin"
                description="Laporan per Bhabin yang melapor"
                icon={<UserCheck size={20} />}
                tone="accent"
                value={(t.bhabinAktif ? t.total / t.bhabinAktif : 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                footer={`${t.bhabinAktif.toLocaleString('id-ID')} Bhabin melapor`}
              />
            </div>
          </div>
        </Stack>

        <Stack className="gap-3">
          <SectionLabel title="Perlu perhatian" hint="pantau dan tindak lanjuti" />
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.7fr)]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2 [&>*]:h-full">
              <StatCard
                alert={t.prioritas > 0}
                title="Deteksi dini urgensi tinggi"
                description="Laporan prioritas di periode ini"
                icon={<ShieldAlert size={20} />}
                tone="danger"
                value={t.prioritas}
                footer={t.prioritas ? <span className="font-medium text-danger">segera tindak lanjuti</span> : 'tidak ada laporan prioritas'}
                href={reportsHref('priority=true')}
              />
              <StatCard
                alert={t.lokasi_janggal > 0}
                title="Lokasi perlu dicek"
                description="Di luar desa binaan atau lokasi janggal"
                icon={<MapPinOff size={20} />}
                tone="warn"
                value={t.lokasi_janggal}
                footer={`${(t.total ? (t.lokasi_janggal / t.total) * 100 : 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% dari laporan`}
              />
            </div>
            <PriorityCarousel rows={ov.priority} />
          </div>
        </Stack>

        <Stack className="gap-3">
          <SectionLabel title="Partisipasi Bhabinkamtibmas" hint="dari Bhabin aktif dalam cakupan" />
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <ParticipationCard ov={ov} />
            <div className="grid gap-3 sm:grid-cols-2 [&>*]:h-full">
              <StatCard
                alert={t.tidakAktif7 > 0}
                title="Tidak melapor 7 hari"
                description="Bhabin tanpa laporan 7 hari terakhir"
                icon={<UserX size={20} />}
                tone="success"
                value={t.tidakAktif7}
                footer={t.tidakAktif7 > 0 ? <span className="font-medium text-danger">perlu ditindaklanjuti</span> : 'semua Bhabin aktif'}
                href="/kinerja"
              />
              <StatCard
                title="Rata-rata / Bhabin"
                description="Laporan per Bhabin aktif"
                icon={<Gauge size={20} />}
                tone="accent"
                value={avgPerBhabin.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                footer="laporan per Bhabin aktif"
              />
            </div>
          </div>
        </Stack>

        <Stack className="gap-3">
          <SectionLabel title="Tren & kategori" hint={`${days} hari`} />
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.9fr)]">
            <Card title="Laporan per hari" subtitle="Menurut kategori" bodyClassName="p-4">
              <DailyByCategoryChart rows={ov.daily} />
            </Card>
            <Card title="Laporan per kategori" subtitle="Klik untuk melihat daftar">
              <CategoryBars rows={ov.byCategory} hrefFor={(c) => reportsHref(`category=${c}`)} />
            </Card>
          </div>
        </Stack>

        <Stack className="gap-3">
          <SectionLabel title="Harga pangan" hint="rata-rata 7 hari, dibanding 7 hari sebelumnya" />
          <PriceTiles prices={prices} />
        </Stack>
      </Stack>
    </>
  );
}
