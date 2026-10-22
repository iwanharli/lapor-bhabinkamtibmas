import { CalendarDays, ClipboardCheck, ClipboardList, Gauge, MapPinOff, ShieldAlert, UserX } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Card, Delta, PageHeader, SectionLabel, SegmentedLinks, Stack, StatCard } from '@/components/ui';
import { DailyByCategoryChart } from '@/features/dashboard/charts';
import { TotalReportsHero } from '@/features/dashboard/hero';
import { CategoryBars, PriorityList } from '@/features/dashboard/lists';
import { ParticipationCard } from '@/features/dashboard/participation';
import { isSpike } from '@/features/prices/price-change';
import { PriceTiles } from '@/features/prices/price-tiles';
import { wibDate } from '@/features/reports/report-search';
import { apiGet, getSessionUser } from '@/lib/api/server';
import { rupiah, tanggal } from '@/lib/format';
import type { LatestPrice, Overview } from '@/lib/types';

const PERIODS = [7, 30, 90];

/** Baris kartu: hero/partisipasi 2 kolom + 2 kartu metrik, semua sama tinggi. */
function MetricRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">{children}</div>;
}

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
  const reportsHref = (q: string) => `/laporan?${q}&from=${wibDate(-(days - 1))}&to=${wibDate()}`;

  return (
    <>
      <PageHeader
        title="Ringkasan"
        subtitle={`${tanggal(ov.range.from)} – ${tanggal(ov.range.to)} · ${days} hari · ${user?.unit.nama}`}
        actions={
          <SegmentedLinks
            active={String(days)}
            items={PERIODS.map((d) => ({ key: String(d), label: `${d} hari`, href: `/?hari=${d}`, icon: d === days ? <CalendarDays size={15} /> : undefined }))}
          />
        }
      />

      <Stack className="gap-8">
        {spikes.length > 0 && (
          <Alert tone="danger" title="Lonjakan harga pangan ≥10% dalam 7 hari">
            <span className="text-ink">{spikes.map((p) => `${p.nama} (${rupiah(p.rata2)}/${p.satuan})`).join(', ')}. </span>
            <Link href="/harga-pangan" className="font-semibold text-primary hover:underline">Lihat detail →</Link>
          </Alert>
        )}

        <Stack>
          <SectionLabel title="Aktivitas laporan" hint="periode terpilih" />
          <MetricRow>
            <div className="md:col-span-2"><TotalReportsHero ov={ov} /></div>
            <StatCard
              title="Menunggu verifikasi"
              description="Terkirim & sedang ditinjau"
              icon={<ClipboardList size={20} />}
              tone="warn"
              value={t.menunggu}
              footer={`dari ${t.total.toLocaleString('id-ID')} laporan`}
              href={reportsHref('status=MENUNGGU')}
            />
            <StatCard
              title="Disetujui"
              description="Lolos verifikasi & masuk rekap"
              icon={<ClipboardCheck size={20} />}
              tone="success"
              value={t.disetujui}
              footer={<Delta now={t.disetujui} prev={ov.previous.disetujui} />}
              href={reportsHref('status=APPROVED')}
            />
          </MetricRow>
        </Stack>

        <Stack>
          <SectionLabel title="Partisipasi Bhabinkamtibmas" hint="dari Bhabin aktif dalam cakupan" />
          <MetricRow>
            <div className="md:col-span-2"><ParticipationCard ov={ov} /></div>
            <StatCard
              alert={t.tidakAktif7 > 0}
              title="Tidak melapor 7 hari"
              description="Bhabin tanpa laporan 7 hari terakhir"
              icon={<UserX size={20} />}
              tone="success"
              value={t.tidakAktif7}
              footer={t.tidakAktif7 > 0 ? <span className="font-medium text-danger">perlu ditindaklanjuti</span> : 'semua Bhabin aktif'}
              href="/admin/pengguna?role=BHABIN"
            />
            <StatCard
              title="Rata-rata / Bhabin"
              description="Laporan per Bhabin aktif"
              icon={<Gauge size={20} />}
              tone="accent"
              value={avgPerBhabin.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
              footer="laporan per Bhabin aktif"
            />
          </MetricRow>
        </Stack>

        <Stack>
          <SectionLabel title="Kewaspadaan" hint="perlu perhatian verifikator" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 [&>*]:h-full">
            <StatCard
              alert={t.prioritas_terbuka > 0}
              title="Deteksi dini urgensi tinggi"
              description="Belum diputuskan verifikator"
              icon={<ShieldAlert size={20} />}
              tone="danger"
              value={t.prioritas_terbuka}
              footer={t.prioritas_terbuka ? <span className="font-medium text-danger">segera tinjau</span> : 'tidak ada yang terbuka'}
              href={reportsHref('priority=true')}
            />
            <StatCard
              title="Lokasi perlu dicek"
              description="Di luar desa binaan / lokasi palsu"
              icon={<MapPinOff size={20} />}
              tone="warn"
              value={t.lokasi_janggal}
              footer={`${(t.total ? (t.lokasi_janggal / t.total) * 100 : 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% dari laporan`}
            />
            <Card title="Deteksi dini prioritas" subtitle="Urgensi tinggi yang belum diputuskan" className="flex flex-col md:col-span-2 xl:col-span-1" bodyClassName="flex-1">
              <PriorityList rows={ov.priority} />
            </Card>
          </div>
        </Stack>

        <Stack>
          <SectionLabel title="Tren & kategori" hint={`${days} hari`} />
          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="Laporan per hari" subtitle="Menurut kategori" className="xl:col-span-2" bodyClassName="p-4">
              <DailyByCategoryChart rows={ov.daily} />
            </Card>
            <Card title="Laporan per kategori" subtitle="Klik untuk melihat daftar">
              <CategoryBars rows={ov.byCategory} hrefFor={(c) => reportsHref(`category=${c}`)} />
            </Card>
          </div>
        </Stack>

        <Stack>
          <SectionLabel title="Harga pangan" hint="rata-rata 7 hari, dibanding 7 hari sebelumnya" />
          <PriceTiles prices={prices} />
        </Stack>
      </Stack>
    </>
  );
}
