import { ArrowLeft, Building2, CalendarClock, Clock, Flame, Hash, MapPin, Send } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/components/ui';
import { CATEGORY_LABEL, personName, tzLabel, tzOf } from '@/lib/format';
import type { ReportDetail } from '@/lib/types';
import { categoryGlyph } from './category-icon';

const initials = (nama: string) => nama.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const hari = (d: string, tz: string) => new Date(d).toLocaleDateString('id-ID', { timeZone: tzOf(tz), weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const jam = (d: string, tz: string) => `${new Date(d).toLocaleTimeString('id-ID', { timeZone: tzOf(tz), hour: '2-digit', minute: '2-digit' })} ${tzLabel(tz)}`;

function Meta({ icon: Icon, label, value, sub }: { icon: typeof MapPin; label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 px-5 py-3.5">
      <Icon size={17} className="mt-0.5 shrink-0 text-white/60" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/55">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
        {sub && <p className="truncate text-xs text-white/65">{sub}</p>}
      </div>
    </div>
  );
}

/** Kepala halaman detail: identitas laporan, pelapor, lokasi, dan waktu. Laporan terkirim langsung final (tanpa verifikasi). */
export function ReportHeader({ report: r, backHref = '/laporan' }: { report: ReportDetail; backHref?: string }) {
  const tz = r.unit.timezone;
  const ralat = r.editableUntil && new Date(r.editableUntil) > new Date() ? r.editableUntil : null;
  const Glyph = categoryGlyph(r.category);
  const draft = r.status === 'DRAFT';
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--brand-deep)] via-[var(--brand)] to-[var(--brand-2)] text-white shadow-lg">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-sky-300/10 blur-3xl" />

      <div className="relative flex items-center justify-between gap-3 px-5 pt-4">
        <Link href={backHref} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 py-1.5 pl-2 pr-3.5 text-xs font-medium ring-1 ring-white/20 transition hover:bg-white/20">
          <ArrowLeft size={15} /> Daftar laporan
        </Link>
        <div className="flex flex-wrap justify-end gap-1.5">
          {r.priority && <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide shadow"><Flame size={12} /> Prioritas</span>}
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', draft ? 'bg-white/15' : 'bg-white text-emerald-700')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', draft ? 'bg-white/70' : 'bg-emerald-500')} /> {draft ? 'Draft' : 'Terkirim'}
          </span>
        </div>
      </div>

      <div className="relative flex items-center gap-4 px-5 pb-5 pt-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur"><Glyph size={30} /></span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/80">{CATEGORY_LABEL[r.category]}</p>
          <h1 className="flex items-center gap-1.5 break-all font-mono text-xl font-bold tracking-tight sm:text-2xl"><Hash size={20} className="shrink-0 text-white/50" />{r.nomor}</h1>
          <p className="mt-1.5 flex items-center gap-2 text-sm">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20 text-[10px] font-bold">{initials(r.user.nama)}</span>
            <span className="truncate font-semibold">{personName(r.user)}</span>
            <span className="shrink-0 text-xs text-white/60">NRP {r.user.nrp}</span>
          </p>
        </div>
      </div>

      <div className="relative grid divide-y divide-white/10 border-t border-white/15 bg-black/15 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x">
        <Meta icon={MapPin} label="Desa" value={r.village.nama} sub={/^kec/i.test(r.village.kecamatan) ? r.village.kecamatan : `Kec. ${r.village.kecamatan}`} />
        <Meta icon={Building2} label="Unit" value={r.unit.nama} sub={tzLabel(tz)} />
        <Meta icon={CalendarClock} label="Waktu kegiatan" value={hari(r.occurredAt, tz)} sub={jam(r.occurredAt, tz)} />
        {r.submittedAt
          ? <Meta icon={Send} label="Dikirim" value={hari(r.submittedAt, tz)} sub={<span className="inline-flex items-center gap-1">{jam(r.submittedAt, tz)}{ralat && <><span className="text-white/40">·</span><Clock size={11} /> ralat s.d. {new Date(ralat).toLocaleDateString('id-ID', { timeZone: tzOf(tz), day: 'numeric', month: 'short' })}</>}</span>} />
          : <Meta icon={Send} label="Dikirim" value="Belum dikirim" />}
      </div>
    </section>
  );
}
