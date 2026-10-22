import { Lock, UserRound } from 'lucide-react';
import { SensitiveReveal } from './sensitive-reveal';
import { displayValue } from '@/lib/format';
import type { ReportDetail, SchemaField } from '@/lib/types';

const SKIP = ['photo', 'file'];
/** Field bersyarat yang tidak berlaku (mis. RT/RW untuk wilayah banjar) tidak ditampilkan. */
const applies = (f: SchemaField, data: Record<string, unknown>) =>
  !f.requiredIf || (f.requiredIf.in ? f.requiredIf.in.includes(data[f.requiredIf.field]) : data[f.requiredIf.field] === f.requiredIf.equals);
const isPriceRepeater = (f: SchemaField) => f.type === 'repeater' && !!f.fields?.some((x) => x.source === 'commodities');

function Value({ v }: { v: unknown }) {
  if (Array.isArray(v)) {
    return (
      <span className="flex flex-wrap gap-1.5">
        {v.map((x) => <span key={String(x)} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-sm text-primary">{String(x)}</span>)}
      </span>
    );
  }
  return <span className="font-medium">{displayValue(v)}</span>;
}

/** Grid label–nilai untuk sekelompok field biasa. */
function FieldGrid({ fields, report }: { fields: SchemaField[]; report: ReportDetail }) {
  const isWide = (f: SchemaField) => f.type === 'textarea' || String(report.data[f.key] ?? '').length > 60;
  // Field pendek tanpa pasangan di barisnya dilebarkan agar grid tidak menyisakan sel kosong.
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
        // Field sensitif terenkripsi tidak ada di data; penandanya ada di sensitiveFilled.
        const hidden = f.sensitive && (report.sensitiveFilled?.includes(f.key) || (v != null && v !== ''));
        const empty = !hidden && (v == null || v === '' || (Array.isArray(v) && !v.length));
        return (
          <div key={f.key} className={`bg-surface px-5 py-4 ${wide.has(f.key) ? 'sm:col-span-2' : ''}`}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">{f.label}</dt>
            <dd className="mt-1 break-words">
              {hidden ? <span className="inline-flex items-center gap-1.5 text-muted"><Lock size={14} /> Data sensitif disembunyikan</span>
                : empty ? <span className="text-muted/70">Tidak diisi</span>
                : <Value v={v} />}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Repeater non-harga (mis. anggota keluarga) sebagai kartu per baris. */
function RowCards({ f, report }: { f: SchemaField; report: ReportDetail }) {
  const rows = (Array.isArray(report.data[f.key]) ? report.data[f.key] : []) as Record<string, unknown>[];
  const secretFilled = report.sensitiveFilled?.includes(f.key);
  if (!rows.length) return <p className="bg-surface px-5 py-4 text-sm text-muted/70">Tidak ada {f.label.toLowerCase()}.</p>;
  return (
    <ul className="grid gap-3 bg-surface p-4 sm:grid-cols-2">
      {rows.map((row, i) => (
        <li key={i} className="rounded-xl border border-line bg-bg/40 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-primary"><UserRound size={14} /></span>
            {String(row.nama ?? `${f.label} ${i + 1}`)}
            {row.hubungan != null && <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-normal text-muted ring-1 ring-line">{String(row.hubungan)}</span>}
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            {(f.fields ?? []).filter((s) => !['nama', 'hubungan'].includes(s.key) && applies(s, row)).map((s) => {
              const v = row[s.key];
              if (s.sensitive) {
                return secretFilled ? (
                  <div key={s.key} className="col-span-2"><dt className="text-[11px] uppercase text-muted">{s.label}</dt><dd className="inline-flex items-center gap-1 text-muted"><Lock size={12} /> disembunyikan</dd></div>
                ) : null;
              }
              if (v == null || v === '') return null;
              return (
                <div key={s.key} className={String(v).length > 22 ? 'col-span-2' : ''}>
                  <dt className="text-[11px] uppercase text-muted">{s.label}</dt>
                  <dd className="break-words font-medium">{displayValue(v)}</dd>
                </div>
              );
            })}
          </dl>
        </li>
      ))}
    </ul>
  );
}

/** Isian laporan dari skema versinya; dikelompokkan per langkah bila formulir bertahap. Media & item harga ditampilkan terpisah. */
export function ReportFields({ report }: { report: ReportDetail }) {
  const all = (report.schema?.fields ?? []).filter((f) => !SKIP.includes(f.type) && !isPriceRepeater(f) && applies(f, report.data));
  const byKey = new Map(all.map((f) => [f.key, f]));
  const groups = report.schema?.steps?.length
    ? report.schema.steps.map((s) => ({ title: s.title, fields: s.fields.map((k) => byKey.get(k)).filter(Boolean) as SchemaField[] })).filter((g) => g.fields.length)
    : [{ title: '', fields: all }];

  // Field sensitif yang terisi (termasuk sub-field repeater, mis. NIK anggota keluarga).
  const revealable = (report.schema?.fields ?? []).flatMap((f) => {
    if (!report.sensitiveFilled?.includes(f.key)) return [];
    if (f.sensitive) return [{ key: f.key, label: f.label }];
    const subs = f.fields?.filter((x) => x.sensitive) ?? [];
    return subs.length ? [{ key: f.key, label: `${subs.map((x) => x.label).join(', ')} (${f.label.toLowerCase()})` }] : [];
  });

  return (
    <>
      {report.canRevealSensitive && revealable.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-line bg-bg/60 px-5 py-2.5 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5"><Lock size={14} /> Laporan ini memuat data sensitif terenkripsi</span>
          <SensitiveReveal reportId={report.id} fields={revealable} />
        </div>
      )}
      {groups.map((g, gi) => {
        const plain = g.fields.filter((f) => f.type !== 'repeater');
        const reps = g.fields.filter((f) => f.type === 'repeater');
        return (
          <section key={g.title || gi} className={gi > 0 ? 'border-t border-line' : ''}>
            {g.title && <h3 className="bg-bg/60 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-muted">{gi + 1}. {g.title}</h3>}
            {plain.length > 0 && <FieldGrid fields={plain} report={report} />}
            {reps.map((f) => <RowCards key={f.key} f={f} report={report} />)}
          </section>
        );
      })}
    </>
  );
}
