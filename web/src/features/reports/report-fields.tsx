import { Lock, UserRound } from 'lucide-react';
import { revealableFields } from './revealable';
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

/** Daftar label–nilai dua kolom; isian kosong disembunyikan (jumlahnya disebut di bawah). */
function FieldGrid({ fields, report }: { fields: SchemaField[]; report: ReportDetail }) {
  const rows = fields.map((f) => {
    const v = report.data[f.key];
    // Field sensitif terenkripsi tidak ada di data; penandanya ada di sensitiveFilled.
    const hidden = !!f.sensitive && (report.sensitiveFilled?.includes(f.key) || (v != null && v !== ''));
    const empty = !hidden && (v == null || (typeof v === 'string' && ['', '-'].includes(v.trim())) || (Array.isArray(v) && !v.length));
    return { f, v, hidden, empty };
  });
  const shown = rows.filter((r) => !r.empty);
  const skipped = rows.length - shown.length;
  return (
    <div className="px-5 pb-4 pt-1">
      <dl className="grid gap-x-8 sm:grid-cols-2 2xl:grid-cols-3">
        {shown.map(({ f, v, hidden }) => {
          const wide = f.type === 'textarea' || String(v ?? '').length > 60;
          const span = wide ? 'sm:col-span-2 2xl:col-span-3' : '';
          return (
            <div key={f.key} className={`flex flex-col gap-0.5 border-b border-line/60 py-3 ${span}`}>
              <dt className="text-xs text-muted">{f.label}</dt>
              <dd className="break-words text-[15px]">
                {hidden ? <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-500/25 dark:text-violet-300"><Lock size={12} /> Terenkripsi</span> : <Value v={v} />}
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
  const secretFilled = report.sensitiveFilled?.includes(f.key);
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
                if (s.sensitive) {
                  return secretFilled ? (
                    <div key={s.key}><dt className="text-xs text-muted">{s.label}</dt><dd className="mt-0.5"><span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-500/25 dark:text-violet-300"><Lock size={11} /> Terenkripsi</span></dd></div>
                  ) : null;
                }
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

  const revealable = revealableFields(report);

  return (
    <div className="space-y-4">
      {report.canRevealSensitive && revealable.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-transparent p-3.5 shadow-sm">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300"><Lock size={18} /></span>
          <p className="min-w-0 flex-1 text-sm"><span className="block font-semibold">Data sensitif terenkripsi</span><span className="block text-xs text-muted">No. KK & NIK hanya dibuka dengan alasan; setiap akses dicatat di audit log.</span></p>
          <SensitiveReveal reportId={report.id} fields={revealable} />
        </div>
      )}
      {groups.map((g, gi) => {
        const plain = g.fields.filter((f) => f.type !== 'repeater');
        const reps = g.fields.filter((f) => f.type === 'repeater');
        return (
          <section key={g.title || gi} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            {g.title ? (
              <h3 className="flex items-center gap-2.5 border-b border-line px-5 py-3.5 text-sm font-semibold">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--brand)] text-[11px] font-bold text-white">{gi + 1}</span>{g.title}
              </h3>
            ) : <div className="h-2" />}
            {plain.length > 0 && <FieldGrid fields={plain} report={report} />}
            {reps.map((f) => <RowCards key={f.key} f={f} report={report} />)}
          </section>
        );
      })}
    </div>
  );
}
