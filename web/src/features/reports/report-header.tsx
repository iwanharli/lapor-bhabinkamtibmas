import { Building2, CalendarClock, MapPin, Send } from 'lucide-react';
import { personName, tzLabel, tzOf } from '@/lib/format';
import { CATEGORY_LABEL } from '@/lib/format';
import type { ReportDetail } from '@/lib/types';
import { CategoryIcon } from './category-icon';
import { PriorityBadge, StatusBadge } from './status-badge';

const initials = (nama: string) => nama.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const waktu = (d: string, tz: string) =>
  new Date(d).toLocaleString('id-ID', { timeZone: tzOf(tz), weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' ' + tzLabel(tz);

function Meta({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 px-3.5 py-3.5 sm:px-4">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</span>
        <span className="mt-0.5 block break-words text-sm font-medium leading-5">{children}</span>
      </span>
    </div>
  );
}

/** Kepala halaman detail: identitas laporan, pelapor, lokasi, dan waktu. Laporan terkirim langsung final (tanpa verifikasi). */
export function ReportHeader({ report: r }: { report: ReportDetail }) {
  const ralat = r.editableUntil && new Date(r.editableUntil) > new Date() ? r.editableUntil : null;
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgb(var(--shadow-tint)/0.05),0_8px_24px_-12px_rgb(var(--shadow-tint)/0.16)]">
      <div className="h-1.5 bg-gradient-to-r from-primary via-primary-2 to-accent" />
      <div className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3 sm:gap-4">
            <CategoryIcon category={r.category} size="md" />
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-primary">{CATEGORY_LABEL[r.category]}</span>
                <StatusBadge status={r.status} />
                {r.priority && <PriorityBadge />}
              </div>
              <h1 className="break-words font-mono text-xl font-bold tracking-tight sm:text-2xl">{r.nomor}</h1>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-[10px] font-bold text-white">{initials(r.user.nama)}</span>
                <span className="min-w-0 truncate font-semibold">{personName(r.user)}</span>
                <span className="shrink-0 text-xs text-muted">NRP {r.user.nrp}</span>
              </div>
            </div>
          </div>
          {r.submittedAt && (
            <div className="flex shrink-0 items-start gap-2.5 rounded-xl border border-line bg-bg/60 px-3.5 py-3 text-sm lg:max-w-[22rem]">
              <Send size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>
                Dikirim {waktu(r.submittedAt, r.unit.timezone)}
                <span className="block text-xs text-muted">
                  {ralat ? `Pelapor masih dapat meralat hingga ${waktu(ralat, r.unit.timezone)}` : 'Laporan final'}
                </span>
              </span>
            </div>
          )}
        </div>
        <div className="mt-5 grid divide-y divide-line overflow-hidden rounded-xl border border-line bg-bg/45 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Meta icon={<MapPin size={16} />} label="Lokasi">{r.village.nama}, {r.village.kecamatan}</Meta>
          <Meta icon={<Building2 size={16} />} label="Unit">{r.unit.nama}</Meta>
          <Meta icon={<CalendarClock size={16} />} label="Waktu kegiatan">{waktu(r.occurredAt, r.unit.timezone)}</Meta>
        </div>
      </div>
    </section>
  );
}
