import { Lock } from 'lucide-react';
import { displayValue } from '@/lib/format';
import type { ReportDetail } from '@/lib/types';

/** Isian laporan dari skema versinya sebagai grid label–nilai; media & item harga ditampilkan terpisah. */
export function ReportFields({ report }: { report: ReportDetail }) {
  const fields = (report.schema?.fields ?? []).filter((f) => !['photo', 'file', 'repeater'].includes(f.type));
  const isWide = (f: (typeof fields)[number]) => f.type === 'textarea' || String(report.data[f.key] ?? '').length > 60;
  // Field pendek yang tidak punya pasangan di barisnya dilebarkan agar grid tidak menyisakan sel kosong.
  const wide = new Set<string>();
  let col = 0;
  fields.forEach((f, i) => {
    if (isWide(f)) {
      wide.add(f.key);
      col = 0;
      return;
    }
    const next = fields[i + 1];
    if (col === 0 && (!next || isWide(next))) wide.add(f.key);
    else col = (col + 1) % 2;
  });

  return (
    <dl className="grid gap-px overflow-hidden bg-line sm:grid-cols-2">
      {fields.map((f) => {
        const v = report.data[f.key];
        const empty = v == null || v === '' || (Array.isArray(v) && !v.length);
        return (
          <div key={f.key} className={`bg-surface px-5 py-4 ${wide.has(f.key) ? 'sm:col-span-2' : ''}`}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">{f.label}</dt>
            <dd className="mt-1 break-words">
              {f.sensitive && !empty ? (
                <span className="inline-flex items-center gap-1.5 text-muted"><Lock size={14} /> Data sensitif disembunyikan</span>
              ) : empty ? (
                <span className="text-muted/70">Tidak diisi</span>
              ) : Array.isArray(v) ? (
                <span className="flex flex-wrap gap-1.5">
                  {v.map((x) => <span key={String(x)} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-sm text-primary">{String(x)}</span>)}
                </span>
              ) : (
                <span className="font-medium">{displayValue(v)}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
