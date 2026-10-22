import { CalendarRange, FileSpreadsheet, FileText, Flame, Info, UserCheck, Users } from 'lucide-react';
import { Card, cn, PageHeader, StatCard } from '@/components/ui';
import { MonthSelect } from '@/features/monthly/month-select';
import { UrlUnitFilter } from '@/features/units/unit-combobox';
import { apiGet, getSessionUser } from '@/lib/api/server';
import { localDateStr } from '@/lib/format';
import { withParams } from '@/lib/url';

type Preview = {
  unit: { nama: string; levelLabel: string };
  bulanLabel: string; dari: string; sampai: string; hariKerja: number; berjalan: boolean;
  ringkasan: { laporan: number; laporanSebelumnya: number; prioritas: number; lokasiJanggal: number; bhabin: number; bhabinAktif: number; kehadiranPersen: number | null; terlambat: number };
  perKategori: { label: string; jumlah: number; sebelumnya: number; prioritas: number }[];
  perSatuan: { nama: string; bhabin: number; bhabinAktif: number; laporan: number; prioritas: number; kehadiranPersen: number | null }[];
  keluarga: { kk: number; balita: number; stunting: number; berisiko: number; belumDitangani: number };
  bhabinPerhatian: number;
};

const n = (x: number) => x.toLocaleString('id-ID');
const pct = (x: number | null) => (x == null ? '—' : `${x.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`);
const change = (a: number, b: number) => (b ? `${a >= b ? '+' : ''}${(((a - b) / b) * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% dari bulan lalu` : 'bulan lalu belum ada data');

export const metadata = { title: 'Laporan Bulanan' };

export default async function LaporanBulananPage({ searchParams }: { searchParams: Promise<{ bulan?: string; unitId?: string }> }) {
  const sp = await searchParams;
  const me = await getSessionUser();
  const thisMonth = localDateStr(0, me?.unit.timezone).slice(0, 7);
  const bulan = /^\d{4}-\d{2}$/.test(sp.bulan ?? '') && sp.bulan! <= thisMonth ? sp.bulan! : thisMonth;
  const params = { bulan, unitId: sp.unitId };
  const p = await apiGet<Preview>(withParams('/exports/bulanan', { ...params, format: 'json' }));
  const s = p.ringkasan;
  const file = (format: 'pdf' | 'xlsx') => `/api/proxy${withParams('/exports/bulanan', { ...params, format })}`;

  return (
    <>
      <PageHeader title="Laporan Bulanan" subtitle="Rekap satu bulan untuk pimpinan — unduh sebagai PDF (siap cetak) atau Excel (data lengkap)"
        actions={<div className="flex flex-col gap-2 sm:flex-row"><MonthSelect value={bulan} max={thisMonth} /><UrlUnitFilter levels={['MABES', 'POLDA', 'POLRES', 'POLSEK']} emptyLabel="Satuan saya" /></div>} />

      <div className="space-y-5">
        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm lg:flex-row lg:items-center">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary"><CalendarRange size={24} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold leading-tight">{p.unit.levelLabel} · {p.unit.nama} — {p.bulanLabel}</p>
            <p className="text-sm text-muted">
              {p.dari} s.d. {p.sampai}{p.berjalan ? ' (bulan berjalan)' : ''} · {p.hariKerja} hari kerja (Senin–Jumat). Tidak memuat NIK/No. KK maupun data kesehatan per orang.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <a href={file('pdf')} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110">
              <FileText size={18} /> Unduh PDF
            </a>
            <a href={file('xlsx')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110">
              <FileSpreadsheet size={18} /> Unduh Excel
            </a>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
          <StatCard title="Laporan terkirim" icon={<FileText size={20} />} value={n(s.laporan)} footer={change(s.laporan, s.laporanSebelumnya)} />
          <StatCard alert={s.prioritas > 0} title="Laporan prioritas" icon={<Flame size={20} />} tone="danger" value={n(s.prioritas)} footer={`${n(s.lokasiJanggal)} lokasi perlu dicek`} />
          <StatCard title="Bhabin melapor" icon={<Users size={20} />} tone="info" value={`${n(s.bhabinAktif)} / ${n(s.bhabin)}`}
            footer={p.bhabinPerhatian ? `${n(p.bhabinPerhatian)} perlu perhatian (rincian di PDF/Excel)` : 'semua aktif'} />
          <StatCard title="Kehadiran" icon={<UserCheck size={20} />} tone="success" value={pct(s.kehadiranPersen)} footer={`${n(s.terlambat)} absen terlambat`} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="Laporan per kategori" subtitle="Dibanding bulan sebelumnya" bodyClassName="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line/60">
                {p.perKategori.map((c) => (
                  <tr key={c.label}>
                    <td className="px-5 py-2.5">{c.label}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{n(c.jumlah)}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-muted tabular-nums">lalu {n(c.sebelumnya)}</td>
                    <td className={cn('px-5 py-2.5 text-right text-xs tabular-nums', c.prioritas ? 'font-semibold text-danger' : 'text-muted/60')}>{c.prioritas ? `${n(c.prioritas)} prioritas` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Keluarga & stunting" subtitle="Dari Mapping Data Keluarga bulan ini" bodyClassName="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
            {[['Keluarga', p.keluarga.kk], ['Balita', p.keluarga.balita], ['Stunting', p.keluarga.stunting], ['Berisiko', p.keluarga.berisiko], ['Belum ditangani', p.keluarga.belumDitangani]].map(([label, v]) => (
              <div key={label} className="rounded-xl bg-bg/60 px-3.5 py-3">
                <p className="text-xs text-muted">{label}</p>
                <p className={cn('text-xl font-bold tabular-nums', label === 'Belum ditangani' && Number(v) > 0 && 'text-danger')}>{n(Number(v))}</p>
              </div>
            ))}
          </Card>
        </div>

        {p.perSatuan.length > 0 && (
          <Card title="Per satuan" subtitle="15 satuan teratas — lengkap di PDF/Excel" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-5 py-2.5 font-medium">Satuan</th>
                    <th className="px-3 py-2.5 text-right font-medium">Bhabin</th>
                    <th className="px-3 py-2.5 text-right font-medium">Melapor</th>
                    <th className="px-3 py-2.5 text-right font-medium">Laporan</th>
                    <th className="px-3 py-2.5 text-right font-medium">Prioritas</th>
                    <th className="px-5 py-2.5 text-right font-medium">Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {p.perSatuan.map((u) => (
                    <tr key={u.nama}>
                      <td className="px-5 py-2.5 font-medium">{u.nama}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{n(u.bhabin)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{n(u.bhabinAktif)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{n(u.laporan)}</td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums', u.prioritas && 'font-semibold text-danger')}>{n(u.prioritas)}</td>
                      <td className={cn('px-5 py-2.5 text-right tabular-nums', u.kehadiranPersen != null && u.kehadiranPersen < 50 && 'text-danger')}>{pct(u.kehadiranPersen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted"><Info size={13} /> Angka diambil dari agregat dashboard (diperbarui tiap menit) dan absensi; unduhan tercatat di audit log.</p>
      </div>
    </>
  );
}
