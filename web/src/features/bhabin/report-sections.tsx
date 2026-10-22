import { ChevronDown, Lock, UserRound } from 'lucide-react';
import { cn } from '@/components/ui';
import { displayValue } from '@/lib/format';
import { revealableFields } from '@/features/reports/revealable';
import { SensitiveReveal } from '@/features/reports/sensitive-reveal';
import type { ReportDetail, SchemaField } from '@/lib/types';

const SKIP = ['photo', 'file'];
const isPrice = (f: SchemaField) => f.type === 'repeater' && !!f.fields?.some((x) => x.source === 'commodities');
const applies = (f: SchemaField, data: Record<string, unknown>) =>
  !f.requiredIf || (f.requiredIf.in ? f.requiredIf.in.includes(data[f.requiredIf.field]) : data[f.requiredIf.field] === f.requiredIf.equals);
const filled = (v: unknown) => !(v == null || v === '' || (Array.isArray(v) && !v.length));

/** Satu baris label–nilai ringkas; nilai panjang turun ke bawah label. */
function Row({ label, children, long }: { label: string; children: React.ReactNode; long?: boolean }) {
  return (
    <div className={cn('px-4 py-2.5', long ? 'space-y-0.5' : 'flex items-baseline justify-between gap-4')}>
      <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
      <dd className={cn('min-w-0 break-words text-sm font-medium', !long && 'text-right')}>{children}</dd>
    </div>
  );
}

function Value({ v, hidden }: { v: unknown; hidden: boolean }) {
  if (hidden) return <span className="inline-flex items-center gap-1 font-normal text-muted"><Lock size={13} /> Terenkripsi</span>;
  if (!filled(v)) return <span className="font-normal text-muted/60">—</span>;
  if (Array.isArray(v)) {
    return (
      <span className="flex flex-wrap justify-end gap-1">
        {v.map((x) => <span key={String(x)} className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">{String(x)}</span>)}
      </span>
    );
  }
  return <>{displayValue(v)}</>;
}

function Members({ f, report }: { f: SchemaField; report: ReportDetail }) {
  const rows = (Array.isArray(report.data[f.key]) ? report.data[f.key] : []) as Record<string, unknown>[];
  const secret = report.sensitiveFilled?.includes(f.key);
  if (!rows.length) return <p className="px-4 py-3 text-sm text-muted">Tidak ada {f.label.toLowerCase()}.</p>;
  return (
    <ul className="space-y-2.5 p-3">
      {rows.map((row, i) => (
        <li key={i} className="overflow-hidden rounded-xl border border-line">
          <p className="flex items-center gap-2 border-b border-line bg-bg/60 px-3 py-2 text-sm font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-primary"><UserRound size={14} /></span>
            <span className="min-w-0 flex-1 truncate">{String(row.nama ?? `${f.label} ${i + 1}`)}</span>
            {row.hubungan != null && <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-normal text-muted ring-1 ring-line">{String(row.hubungan)}</span>}
          </p>
          <dl className="divide-y divide-line/70">
            {(f.fields ?? []).filter((s) => !['nama', 'hubungan'].includes(s.key) && applies(s, row) && (s.sensitive ? secret : filled(row[s.key]))).map((s) => (
              <Row key={s.key} label={s.label}><Value v={row[s.key]} hidden={!!s.sensitive} /></Row>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

/**
 * Isian laporan untuk layar HP: per langkah formulir dalam kartu yang bisa dilipat, baris label–nilai ringkas,
 * hanya isian yang terisi (isian bersyarat yang tidak berlaku disembunyikan).
 */
export function ReportSections({ report }: { report: ReportDetail }) {
  const fields = (report.schema?.fields ?? []).filter((f) => !SKIP.includes(f.type) && !isPrice(f) && applies(f, report.data));
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const groups = report.schema?.steps?.length
    ? report.schema.steps.map((s) => ({ title: s.title, fields: s.fields.map((k) => byKey.get(k)).filter(Boolean) as SchemaField[] }))
    : [{ title: 'Isian laporan', fields }];

  const revealable = revealableFields(report);

  return (
    <div className="space-y-3">
      {report.canRevealSensitive && revealable.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-transparent p-3.5 shadow-sm">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300"><Lock size={18} /></span>
          <p className="min-w-0 flex-1 text-xs leading-snug text-muted">Data sensitif (mis. No. KK & NIK) disimpan terenkripsi. Membukanya dicatat di audit log.</p>
          <SensitiveReveal reportId={report.id} fields={revealable} />
        </div>
      )}
      {groups.filter((g) => g.fields.length).map((g, gi) => {
        const shown = g.fields.filter((f) => f.type === 'repeater' || (f.sensitive ? report.sensitiveFilled?.includes(f.key) : filled(report.data[f.key])));
        return (
          <details key={g.title} open className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              {groups.length > 1 && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--brand)] text-xs font-bold text-white">{gi + 1}</span>}
              <span className="flex-1 text-sm font-semibold">{g.title}</span>
              <ChevronDown size={17} className="text-muted transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-line">
              {shown.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">Tidak diisi.</p>
              ) : (
                <dl className="divide-y divide-line/70">
                  {shown.map((f) =>
                    f.type === 'repeater' ? (
                      <div key={f.key}><Members f={f} report={report} /></div>
                    ) : (
                      <Row key={f.key} label={f.label} long={f.type === 'textarea' || String(report.data[f.key] ?? '').length > 28}>
                        <Value v={report.data[f.key]} hidden={!!f.sensitive} />
                      </Row>
                    ),
                  )}
                </dl>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
