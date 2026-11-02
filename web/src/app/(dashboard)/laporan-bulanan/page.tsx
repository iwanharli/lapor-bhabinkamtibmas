import { Baby, CalendarDays, FileSpreadsheet, FileText, Flame, HeartPulse, Home, Info, ShieldAlert, Siren, UserCheck, Users } from 'lucide-react';
import { Card, cn, StatCard, UrlSelect, EmptyState } from '@/components/ui';
import { MapRegionFilter } from '@/features/map/map-region-filter';
import { MonthSelect } from '@/features/monthly/month-select';
import { MonthlyUnitTree, type MonthlyUnit } from '@/features/monthly/unit-tree';
import { UrlUnitFilter } from '@/features/units/unit-combobox';
import { apiGet, getSessionUser } from '@/lib/api/server';
import { CATEGORY_LABEL, localDateStr } from '@/lib/format';
import { withParams } from '@/lib/url';

type Preview = {
  filterLabel: string | null;
  unit: { nama: string; levelLabel: string };
  bulanLabel: string; dari: string; sampai: string; hariKerja: number; berjalan: boolean; pembanding: { label: string };
  ringkasan: { laporan: number; laporanSebelumnya: number; prioritas: number; lokasiJanggal: number; bhabin: number; bhabinAktif: number; kehadiranPersen: number | null; terlambat: number };
  perKategori: { label: string; jumlah: number; sebelumnya: number; prioritas: number }[];
  perSatuan: MonthlyUnit[];
  keluarga: { kk: number; balita: number; stunting: number; berisiko: number; belumDitangani: number };
  bhabinPerhatian: number;
};

const n = (x: number) => x.toLocaleString('id-ID');
const pct = (x: number | null) => (x == null ? '—' : `${x.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`);
/** Perubahan dibanding periode setara (bulan berjalan: tanggal yang sama di bulan lalu); pembanding < 5 tidak dihitung persennya. */
const change = (a: number, b: number, label: string) => (b >= 5 ? `${a >= b ? '+' : ''}${(((a - b) / b) * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% vs ${label}` : `${label}: ${n(b)}`);

const tgl = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Selisih terhadap pembanding sebagai lencana kecil. */
function Delta({ now, prev }: { now: number; prev: number }) {
  const d = now - prev;
  if (!d) return <span className="text-xs text-muted">tetap</span>;
  return <span className={cn('rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', d > 0 ? 'bg-success-soft text-success' : 'bg-bg text-muted')}>{d > 0 ? '+' : ''}{n(d)}</span>;
}

export const metadata = { title: 'Laporan Bulanan' };

export default async function LaporanBulananPage({ searchParams }: { searchParams: Promise<{ bulan?: string; unitId?: string; kategori?: string; pembanding?: string; provinsiKode?: string; kabupatenKode?: string; kecamatanKode?: string; desaKode?: string }> }) {
  const sp = await searchParams;
  const me = await getSessionUser();
  const thisMonth = localDateStr(0, me?.unit.timezone).slice(0, 7);
  const bulan = /^\d{4}-\d{2}$/.test(sp.bulan ?? '') && sp.bulan! <= thisMonth ? sp.bulan! : thisMonth;
  const wilayah = sp.desaKode || sp.kecamatanKode || sp.kabupatenKode || sp.provinsiKode;
  const params = { bulan, unitId: sp.unitId, kategori: sp.kategori, wilayah, pembanding: sp.pembanding };
  const p = await apiGet<Preview>(withParams('/exports/bulanan', { ...params, format: 'json' }));
  const s = p.ringkasan;
  const treeQuery = withParams('/x', { ...params, format: 'json' }).split('?')[1] ?? '';
  const file = (format: 'pdf' | 'xlsx') => `/api/proxy${withParams('/exports/bulanan', { ...params, format })}`;

  // Kehadiran & keluarga tidak bergantung pada kategori laporan yang dipilih.
  const showFamily = !sp.kategori || sp.kategori === 'MAPPING_KK';
  const maxKat = Math.max(1, ...p.perKategori.map((c) => Math.max(c.jumlah, c.sebelumnya)));
  const family = [
    { label: 'Keluarga', v: p.keluarga.kk, icon: Home, tone: 'bg-primary-soft text-primary' },
    { label: 'Balita', v: p.keluarga.balita, icon: Baby, tone: 'bg-info-soft text-info' },
    { label: 'Stunting', v: p.keluarga.stunting, icon: HeartPulse, tone: 'bg-danger-soft text-danger' },
    { label: 'Berisiko', v: p.keluarga.berisiko, icon: ShieldAlert, tone: 'bg-warn-soft text-warn' },
    { label: 'Belum ditangani', v: p.keluarga.belumDitangani, icon: Siren, tone: 'bg-danger-soft text-danger' },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--brand-deep)] via-[#16397c] to-[var(--brand)] text-white shadow-lg">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">{p.unit.levelLabel} · {p.unit.nama}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Laporan Bulanan</h1>
            <p className="mt-1 text-lg font-medium text-white/90">{p.bulanLabel}</p>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} /> {tgl(p.dari)} – {tgl(p.sampai)}{p.berjalan ? ' (berjalan)' : ''}</span>
                  <span>{p.hariKerja} hari kerja</span>
              {p.filterLabel && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-[#1a1405]">Disaring: {p.filterLabel}</span>}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <a href={file('pdf')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-deep)] shadow-sm transition hover:bg-white/90">
              <FileText size={18} className="text-red-600" /> Unduh PDF
            </a>
            <a href={file('xlsx')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-deep)] shadow-sm transition hover:bg-white/90">
              <FileSpreadsheet size={18} className="text-emerald-600" /> Unduh Excel
            </a>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-white/15 bg-black/15 px-6 py-3 text-ink">
          <MonthSelect value={bulan} max={thisMonth} />
          <UrlUnitFilter levels={['MABES', 'POLDA', 'POLRES', 'POLSEK']} emptyLabel="Satuan saya" />
          <UrlSelect param="kategori" label="Kategori" options={[{ value: '', label: 'Semua kategori' }, ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))]} />
          <UrlSelect param="pembanding" label="Pembanding" options={[{ value: '', label: 'Banding bulan lalu' }, { value: 'tahun', label: 'Banding tahun lalu' }]} />
          <div className="max-w-full overflow-x-auto rounded-xl bg-surface [scrollbar-width:none]"><MapRegionFilter /></div>
        </div>
      </section>

      <div className={cn('grid gap-4 sm:grid-cols-2 [&>*]:h-full', sp.kategori ? 'xl:grid-cols-3' : 'xl:grid-cols-4')}>
        <StatCard title="Laporan terkirim" icon={<FileText size={20} />} value={n(s.laporan)} footer={change(s.laporan, s.laporanSebelumnya, p.pembanding.label)} />
        <StatCard alert={s.prioritas > 0} title="Laporan prioritas" icon={<Flame size={20} />} tone="danger" value={n(s.prioritas)} footer={`${n(s.lokasiJanggal)} lokasi perlu dicek`} />
        <StatCard title="Bhabin melapor" icon={<Users size={20} />} tone="info" value={`${n(s.bhabinAktif)} / ${n(s.bhabin)}`}
          footer={!s.bhabin ? 'belum ada Bhabin aktif di cakupan ini' : p.bhabinPerhatian ? `${n(p.bhabinPerhatian)} perlu perhatian (rincian di PDF/Excel)` : 'semua aktif'} />
        {!sp.kategori && <StatCard title="Kehadiran" icon={<UserCheck size={20} />} tone="success" value={pct(s.kehadiranPersen)} footer={`${n(s.terlambat)} absen terlambat`} />}
      </div>

      <div className={cn('grid gap-4', showFamily && 'xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]')}>
        <Card title="Laporan per kategori" subtitle={`Batang tipis: ${p.pembanding.label}`}>
          {p.perKategori.length === 0 ? <EmptyState icon={<FileText size={24} />} tone="neutral" title="Belum ada laporan">Tidak ada laporan pada periode dan penyaring ini.</EmptyState> : <ul className="space-y-3.5 p-5">
            {p.perKategori.map((c) => (
              <li key={c.label}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {c.prioritas > 0 && <span className="text-xs font-semibold text-danger">{n(c.prioritas)} prioritas</span>}
                  <Delta now={c.jumlah} prev={c.sebelumnya} />
                  <strong className="w-8 text-right tabular-nums">{n(c.jumlah)}</strong>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${(c.jumlah / maxKat) * 100}%` }} /></div>
                <div className="mt-0.5 h-1 overflow-hidden rounded-full"><div className="h-full rounded-full bg-muted/35" style={{ width: `${(c.sebelumnya / maxKat) * 100}%` }} /></div>
              </li>
            ))}
          </ul>}
        </Card>

        {showFamily && <Card title="Keluarga & stunting" subtitle="Dari Mapping Data Keluarga bulan ini">
          {p.keluarga.kk === 0 ? (
            <EmptyState icon={<HeartPulse size={24} />} tone="neutral" title="Belum ada data keluarga">Tidak ada laporan Mapping Data Keluarga pada periode ini.</EmptyState>
          ) : (
            <ul className="divide-y divide-line/60">
              {family.map((f) => (
                <li key={f.label} className="flex items-center gap-3 px-5 py-3">
                  <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', f.tone)}><f.icon size={17} /></span>
                  <span className="flex-1 text-sm">{f.label}</span>
                  <strong className={cn('text-lg tabular-nums', f.label === 'Belum ditangani' && f.v > 0 && 'text-danger')}>{n(f.v)}</strong>
                </li>
              ))}
            </ul>
          )}
        </Card>}
      </div>

      {p.perSatuan.length > 0 && (
        <Card title="Per satuan" subtitle="Klik panah untuk membuka satuan di bawahnya" bodyClassName="p-0">
          <MonthlyUnitTree key={JSON.stringify(params)} rows={p.perSatuan} query={treeQuery} showAttendance={!sp.kategori} />
        </Card>
      )}
      <p className="flex items-start gap-1.5 text-xs text-muted"><Info size={13} className="mt-0.5 shrink-0" /> Angka diambil dari agregat dashboard (diperbarui tiap menit) dan absensi. Tidak memuat NIK/No. KK maupun data kesehatan per orang. Unduhan tercatat di audit log.</p>
    </div>
  );
}
