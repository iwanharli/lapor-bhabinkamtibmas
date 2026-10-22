import { Building2, CalendarClock, MapPin } from 'lucide-react';
import { personName, tzLabel, tzOf } from '@/lib/format';
import { CATEGORY_LABEL } from '@/lib/format';
import type { ReportDetail } from '@/lib/types';
import { CategoryIcon } from './category-icon';
import { ReviewPanel } from './review-panel';
import { PriorityBadge, StatusBadge } from './status-badge';

const initials = (nama: string) => nama.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const waktu = (d: string, tz: string) =>
  new Date(d).toLocaleString('id-ID', { timeZone: tzOf(tz), weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' ' + tzLabel(tz);

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="text-muted">{icon}</span>
      {children}
    </span>
  );
}

/** Kepala halaman detail: identitas laporan, pelapor, lokasi, waktu, dan aksi verifikasi. */
export function ReportHeader({ report: r, decidable }: { report: ReportDetail; decidable: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgb(var(--shadow-tint)/0.05),0_8px_24px_-12px_rgb(var(--shadow-tint)/0.16)]">
      <div className="h-1.5 bg-gradient-to-r from-primary via-primary-2 to-accent" />
      <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <span className="hidden sm:block"><CategoryIcon category={r.category} size="lg" /></span>
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-primary">{CATEGORY_LABEL[r.category]}</span>
              <StatusBadge status={r.status} />
              {r.priority && <PriorityBadge />}
            </div>
            <h1 className="break-all font-mono text-2xl font-bold tracking-tight sm:text-[1.75rem]">{r.nomor}</h1>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2.5">
              <span className="inline-flex items-center gap-2 text-sm">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-[11px] font-bold text-white">{initials(r.user.nama)}</span>
                <span>
                  <strong className="font-semibold">{personName(r.user)}</strong>
                  <span className="text-muted"> · NRP {r.user.nrp}</span>
                </span>
              </span>
              <Meta icon={<MapPin size={16} />}>{r.village.nama}, {r.village.kecamatan}</Meta>
              <Meta icon={<Building2 size={16} />}>{r.unit.nama}</Meta>
              <Meta icon={<CalendarClock size={16} />}>{waktu(r.occurredAt, r.unit.timezone)}</Meta>
            </div>
          </div>
        </div>
        {decidable && (
          <div className="shrink-0 lg:pt-1">
            <p className="mb-2 text-xs font-medium text-muted lg:text-right">Keputusan verifikator</p>
            <ReviewPanel reportId={r.id} nomor={r.nomor} inline />
          </div>
        )}
      </div>
    </section>
  );
}
