import { Baby, ChevronRight, Droplets, HeartPulse, Home, Siren, Users } from 'lucide-react';
import Link from 'next/link';
import { Card, cn, EmptyState, PageHeader, StatCard } from '@/components/ui';
import { UrlUnitFilter } from '@/features/units/unit-combobox';
import { apiGet } from '@/lib/api/server';
import { withParams } from '@/lib/url';

type Counts = Record<'kk' | 'kk_sanitasi' | 'balita' | 'stunting' | 'berisiko' | 'belum_ditangani' | 'belum_diketahui' | 'ibu_hamil' | 'ibu_kek' | 'remaja_anemia' | 'catin' | 'jamban_tidak_layak' | 'bab_sembarangan' | 'air_tidak_layak' | 'perokok', number>;
type VillageRow = Counts & { id: string; desa: string; kecamatan: string; kabupaten: string };
type Rekap = { total: Counts; desa: number; laporan: number; villages: VillageRow[] };

const n = (x: number) => x.toLocaleString('id-ID');
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
const pctLabel = (a: number, b: number) => (b ? `${pct(a, b).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%` : '—');

export const metadata = { title: 'Keluarga & Stunting' };

export default async function KeluargaPage({ searchParams }: { searchParams: Promise<{ unitId?: string }> }) {
  const sp = await searchParams;
  const r = await apiGet<Rekap>(withParams('/analytics/stunting', { unitId: sp.unitId }));
  const t = r.total;
  const normal = Math.max(t.balita - t.stunting - t.berisiko - t.belum_diketahui, 0);
  const gizi = [
    { label: 'Normal', v: normal, cls: 'bg-success' },
    { label: 'Berisiko stunting', v: t.berisiko, cls: 'bg-warn' },
    { label: 'Stunting', v: t.stunting, cls: 'bg-danger' },
    { label: 'Belum diketahui', v: t.belum_diketahui, cls: 'bg-line' },
  ];
  const faktor = [
    { label: 'Jamban tidak layak', hint: 'tanpa septic tank / bersama / tidak ada', v: t.jamban_tidak_layak, icon: Home },
    { label: 'BAB sembarangan', hint: 'tidak ada jamban', v: t.bab_sembarangan, icon: Siren },
    { label: 'Air minum tidak layak', hint: 'sumur/mata air tak terlindung, sungai', v: t.air_tidak_layak, icon: Droplets },
    { label: 'Ada perokok di rumah', hint: 'merokok di dalam rumah', v: t.perokok, icon: Users },
  ];

  return (
    <>
      <PageHeader title="Keluarga & Stunting" subtitle="Rekap dari laporan Mapping Data Keluarga · umur dihitung dari tanggal lahir"
        actions={<UrlUnitFilter levels={['POLDA', 'POLRES', 'POLSEK']} emptyLabel="Semua wilayah" />} />

      {t.kk === 0 ? (
        <EmptyState icon={<HeartPulse size={22} />} tone="neutral" title="Belum ada data" className="py-16">Belum ada laporan Mapping Data Keluarga di wilayah ini.</EmptyState>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
            <StatCard title="Keluarga terdata" description={`${n(r.desa)} desa`} icon={<Home size={20} />} value={n(t.kk)} footer={r.laporan > t.kk ? `${n(r.laporan - t.kk)} laporan ulang KK yang sama dihitung sekali` : `${n(t.kk_sanitasi)} dengan data sanitasi`} />
            <StatCard title="Balita" description="Umur di bawah 5 tahun" icon={<Baby size={20} />} tone="info" value={n(t.balita)}
              footer={`${pctLabel(t.stunting + t.berisiko, t.balita)} stunting / berisiko`} />
            <StatCard alert={t.belum_ditangani > 0} title="Stunting belum ditangani" description="Stunting/berisiko, belum ke Posyandu/Puskesmas" icon={<Siren size={20} />} tone="danger"
              value={n(t.belum_ditangani)} footer={`${n(t.stunting)} stunting · ${n(t.berisiko)} berisiko`} />
            <StatCard title="Ibu hamil" description="Termasuk kepala keluarga perempuan" icon={<HeartPulse size={20} />} tone="warn" value={n(t.ibu_hamil)}
              footer={`${n(t.ibu_kek)} KEK/anemia · ${n(t.remaja_anemia)} remaja putri anemia · ${n(t.catin)} calon pengantin`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Status gizi balita" subtitle={`${n(t.balita)} balita · sesuai buku KIA/KMS atau Posyandu`} bodyClassName="p-5">
              <div className="flex h-4 overflow-hidden rounded-full bg-bg">
                {gizi.map((g) => g.v > 0 && <div key={g.label} className={g.cls} style={{ width: `${pct(g.v, t.balita)}%` }} title={`${g.label}: ${n(g.v)}`} />)}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-3">
                {gizi.map((g) => (
                  <li key={g.label} className="flex items-center gap-2.5 rounded-xl bg-bg/60 px-3 py-2.5">
                    <span className={cn('h-3 w-3 shrink-0 rounded-full', g.cls)} />
                    <span className="min-w-0 flex-1 truncate text-sm text-muted">{g.label}</span>
                    <span className="text-right"><strong className="tabular-nums">{n(g.v)}</strong><span className="ml-1 text-xs text-muted">{pctLabel(g.v, t.balita)}</span></span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Faktor risiko rumah tangga" subtitle={`Dari ${n(t.kk_sanitasi)} keluarga dengan data sanitasi`} bodyClassName="p-5">
              <ul className="space-y-3.5">
                {faktor.map((f) => (
                  <li key={f.label}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2"><f.icon size={15} className="shrink-0 text-muted" /><span className="font-medium">{f.label}</span><span className="truncate text-xs text-muted">{f.hint}</span></span>
                      <span className="shrink-0 tabular-nums"><strong>{pctLabel(f.v, t.kk_sanitasi)}</strong><span className="ml-1.5 text-xs text-muted">{n(f.v)} KK</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-bg">
                      <div className={cn('h-2 rounded-full', pct(f.v, t.kk_sanitasi) >= 30 ? 'bg-danger' : pct(f.v, t.kk_sanitasi) >= 15 ? 'bg-warn' : 'bg-primary')} style={{ width: `${pct(f.v, t.kk_sanitasi)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card title="Per desa" subtitle={`Diurutkan dari stunting belum ditangani terbanyak${r.desa > r.villages.length ? ` · ${n(r.villages.length)} dari ${n(r.desa)} desa` : ''}`} bodyClassName="p-0">
            <div className="scroll-thin max-h-[32rem] overflow-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="sticky top-0 z-10 bg-surface">
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-5 py-2.5 font-medium">Desa</th>
                    <th className="px-3 py-2.5 text-right font-medium">KK</th>
                    <th className="px-3 py-2.5 text-right font-medium">Balita</th>
                    <th className="px-3 py-2.5 text-right font-medium">Stunting</th>
                    <th className="px-3 py-2.5 text-right font-medium">Berisiko</th>
                    <th className="px-3 py-2.5 text-right font-medium">Belum ditangani</th>
                    <th className="px-3 py-2.5 text-right font-medium">Ibu hamil</th>
                    <th className="px-3 py-2.5 text-right font-medium">Jamban tak layak</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {r.villages.map((v) => (
                    <tr key={v.id} className="group hover:bg-bg/60">
                      <td className="px-5 py-2.5">
                        <Link href={withParams('/laporan', { category: 'MAPPING_KK', villageId: v.id, rentang: 'semua' })} className="font-medium hover:text-primary">{v.desa}</Link>
                        <span className="block text-xs text-muted">{v.kecamatan}, {v.kabupaten}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{n(v.kk)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{n(v.balita)}</td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums', v.stunting > 0 && 'font-semibold text-danger')}>{n(v.stunting)}</td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums', v.berisiko > 0 && 'text-warn')}>{n(v.berisiko)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {v.belum_ditangani > 0 ? <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white tabular-nums">{n(v.belum_ditangani)}</span> : <span className="text-muted/50">0</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{n(v.ibu_hamil)}{v.ibu_kek > 0 && <span className="ml-1 text-xs text-warn">({n(v.ibu_kek)} KEK)</span>}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">{pctLabel(v.jamban_tidak_layak, v.kk_sanitasi)}</td>
                      <td className="pr-4"><ChevronRight size={16} className="text-muted/40 group-hover:text-muted" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
