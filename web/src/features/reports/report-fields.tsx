import { FileText, UserRound } from 'lucide-react';
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

/** Daftar label–nilai dua kolom; isian kosong disembunyikan (jumlahnya disebut di bawah). */
function FieldGrid({ fields, report }: { fields: SchemaField[]; report: ReportDetail }) {
  const rows = fields.map((f) => {
    const v = report.data[f.key];
    const empty = (v == null || (typeof v === 'string' && ['', '-'].includes(v.trim())) || (Array.isArray(v) && !v.length));
    return { f, v, empty };
  });
  const shown = rows.filter((r) => !r.empty);
  const skipped = rows.length - shown.length;
  return (
    <div className="px-5 pb-4 pt-1">
      <dl className="grid gap-x-8 sm:grid-cols-2 2xl:grid-cols-3">
        {shown.map(({ f, v }) => {
          const wide = f.type === 'textarea' || String(v ?? '').length > 60;
          const span = wide ? 'sm:col-span-2 2xl:col-span-3' : '';
          return (
            <div key={f.key} className={`flex flex-col gap-1 py-3 ${wide ? '' : 'border-b border-line/60'} ${span}`}>
              <dt className="text-xs font-medium text-muted">{f.label}</dt>
              <dd className={wide ? 'break-words rounded-xl border-l-[3px] border-primary bg-bg/70 px-4 py-3 text-[15px] leading-relaxed' : 'break-words text-[15px]'}>
                <Value v={v} />
              </dd>
            </div>
          );
        })}
      </dl>
      {skipped > 0 && <p className="pt-2.5 text-xs text-muted/80">{skipped} isian tidak diisi: {rows.filter((r) => r.empty).map((r) => r.f.label.toLowerCase()).join(', ')}.</p>}
    </div>
  );
}

/** Repeater non-harga (mis. anggota keluarga) sebagai kartu per baris. */
function RowCards({ f, report }: { f: SchemaField; report: ReportDetail }) {
  const rows = (Array.isArray(report.data[f.key]) ? report.data[f.key] : []) as Record<string, unknown>[];
  if (!rows.length) return <p className="px-5 py-4 text-sm text-muted/80">Tidak ada {f.label.toLowerCase()}.</p>;
  const single = rows.length === 1;
  return (
    <ul className={`grid gap-3 px-5 py-4 ${single ? '' : 'xl:grid-cols-2'}`}>
      {rows.map((row, i) => {
        const subs = (f.fields ?? []).filter((s) => !['nama', 'hubungan'].includes(s.key) && applies(s, row));
        return (
          <li key={i} className="overflow-hidden rounded-xl border border-line">
            <p className="flex items-center gap-2.5 border-b border-line bg-bg/60 px-3.5 py-2.5 text-sm font-semibold">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><UserRound size={15} /></span>
              <span className="min-w-0 flex-1 truncate">{String(row.nama ?? `${f.label} ${i + 1}`)}</span>
              {row.hubungan != null && <span className="shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-muted ring-1 ring-line">{String(row.hubungan)}</span>}
            </p>
            <dl className={`grid grid-cols-2 gap-x-4 gap-y-2.5 p-3.5 text-sm ${single ? 'sm:grid-cols-3' : ''}`}>
              {subs.map((s) => {
                const v = row[s.key];
                if (v == null || v === '') return null;
                return (
                  <div key={s.key} className={!single && String(v).length > 22 ? 'col-span-2' : ''}>
                    <dt className="text-xs text-muted">{s.label}</dt>
                    <dd className="break-words font-medium">{displayValue(v)}</dd>
                  </div>
                );
              })}
            </dl>
          </li>
        );
      })}
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

  return (
    <div className="space-y-4">
      {groups.map((g, gi) => {
        const plain = g.fields.filter((f) => f.type !== 'repeater');
        const reps = g.fields.filter((f) => f.type === 'repeater');
        return (
          <section key={g.title || gi} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            {g.title ? (
              <h3 className="flex items-center gap-2.5 border-b border-line px-5 py-3.5 text-sm font-semibold">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--brand)] text-[11px] font-bold text-white">{gi + 1}</span>{g.title}
              </h3>
            ) : (
              <h3 className="flex items-center gap-2.5 border-b border-line px-5 py-3.5 text-sm font-semibold">
                <FileText size={16} className="text-primary" /> Isi laporan
              </h3>
            )}
            {plain.length > 0 && <FieldGrid fields={plain} report={report} />}
            {reps.map((f) => <RowCards key={f.key} f={f} report={report} />)}
          </section>
        );
      })}
    </div>
  );
}
