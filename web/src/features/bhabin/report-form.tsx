'use client';

import { Camera, Crosshair, ImagePlus, Loader2, MapPin, Plus, Save, Send, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, cn, Input, Select, Textarea } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import type { ReportDetail } from '@/lib/types';
import { newUuid, shrinkImage, uploadForm, useGeolocation } from './field-utils';

export interface FormField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  requiredIf?: { field: string; equals: unknown };
  options?: string[];
  source?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  decimal?: boolean;
  sensitive?: boolean;
  accept?: string[];
  fields?: FormField[];
}
export interface FormSchema { category: string; version: number; title: string; fields: FormField[] }
export interface Commodity { id: number; nama: string; satuanDefault: string }
export interface Village { id: string; nama: string; kecamatan: string }

type Values = Record<string, unknown>;
type Row = Record<string, string>;
const MEDIA = ['photo', 'file'];
const STOK_LABEL: Record<string, string> = { AMAN: 'Aman', MENIPIS: 'Menipis', KOSONG: 'Kosong' };
/** Batas mundur waktu kegiatan (selaras server: 3×24 jam). */
const MAX_BACKDATE_MS = 3 * 86_400_000;

const isRequired = (f: FormField, v: Values) => !!f.required || (!!f.requiredIf && v[f.requiredIf.field] === f.requiredIf.equals);
const empty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
/** "YYYY-MM-DDTHH:mm" waktu lokal perangkat untuk <input type="datetime-local">. */
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/** Siapkan isian untuk API: angka sebagai number, kosong dibuang, NIK kosong tidak dikirim (nilai lama tetap dipakai saat ralat). */
function cleanData(schema: FormSchema, values: Values) {
  const out: Values = {};
  for (const f of schema.fields) {
    if (MEDIA.includes(f.type)) continue;
    const v = values[f.key];
    if (empty(v)) continue;
    if (f.type === 'number' || f.type === 'currency') out[f.key] = Number(v);
    else if (f.type === 'repeater') {
      out[f.key] = (v as Row[])
        .filter((row) => Object.values(row).some((x) => x !== ''))
        .map((row) => Object.fromEntries((f.fields ?? []).filter((s) => row[s.key] !== '' && row[s.key] != null).map((s) => [
          s.key, s.type === 'number' || s.type === 'currency' || s.source === 'commodities' ? Number(row[s.key]) : row[s.key],
        ])));
    } else out[f.key] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

/** Formulir laporan Bhabin (web/HP) yang dibangun dari skema JSON kategori. */
export function ReportForm({
  schema, villages, commodities, report,
}: { schema: FormSchema; villages: Village[]; commodities: Commodity[]; report?: ReportDetail }) {
  const router = useRouter();
  const ralat = report?.status === 'SUBMITTED';
  const geo = useGeolocation();
  const [clientUuid] = useState(() => newUuid());
  const [villageId, setVillageId] = useState(report?.village.id ?? (villages.length === 1 ? villages[0].id : ''));
  const [occurredAt, setOccurredAt] = useState(() => toLocalInput(report ? new Date(report.occurredAt) : new Date()));
  const [values, setValues] = useState<Values>(() => {
    const init: Values = {};
    for (const f of schema.fields) {
      const v = report?.data?.[f.key];
      if (f.type === 'repeater') {
        const rows = (Array.isArray(v) ? v : []) as Values[];
        init[f.key] = rows.length ? rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, x]) => [k, String(x ?? '')]))) : [{}];
      } else if (f.type === 'multiselect') init[f.key] = Array.isArray(v) ? v : [];
      else if (!MEDIA.includes(f.type)) init[f.key] = v == null ? '' : String(v);
    }
    return init;
  });
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [busy, setBusy] = useState<'' | 'draft' | 'send'>('');
  const [progress, setProgress] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const existingCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of report?.attachments ?? []) m[a.fieldKey] = (m[a.fieldKey] ?? 0) + 1;
    return m;
  }, [report]);

  // Lokasi diambil otomatis untuk laporan baru/draft; ralat memakai titik lama kecuali diambil ulang.
  useEffect(() => {
    if (!ralat) void geo.locate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: string, v: unknown) => setValues((p) => ({ ...p, [key]: v }));
  const minTime = toLocalInput(new Date(Date.now() - MAX_BACKDATE_MS));
  const maxTime = toLocalInput(new Date());

  function validate(send: boolean) {
    const errs: string[] = [];
    if (!villageId) errs.push('Pilih desa binaan.');
    if (!geo.fix && !report) errs.push('Lokasi GPS belum didapat. Tekan "Ambil lokasi".');
    const t = new Date(occurredAt).getTime();
    if (Number.isNaN(t) || t > Date.now() + 10 * 60_000) errs.push('Waktu kegiatan tidak boleh di masa depan.');
    else if (Date.now() - t > MAX_BACKDATE_MS) errs.push('Waktu kegiatan paling lambat 3×24 jam yang lalu.');
    if (!send) return errs;
    for (const f of schema.fields) {
      const req = isRequired(f, values);
      if (MEDIA.includes(f.type)) {
        const n = (existingCount[f.key] ?? 0) + (files[f.key]?.length ?? 0);
        const min = Math.max(f.min ?? 0, req ? 1 : 0);
        if (n < min) errs.push(`${f.label}: minimal ${min} ${f.type === 'photo' ? 'foto' : 'berkas'}.`);
        continue;
      }
      if (f.type === 'nik' && ralat && empty(values[f.key])) continue; // NIK lama tetap tersimpan
      const v = f.type === 'repeater' ? cleanData({ ...schema, fields: [f] }, values)[f.key] : values[f.key];
      if (req && empty(v)) errs.push(`${f.label} wajib diisi.`);
      if (f.type === 'nik' && !empty(v) && !/^\d{16}$/.test(String(v))) errs.push('NIK harus 16 digit angka.');
    }
    return errs;
  }

  async function save(send: boolean) {
    const errs = validate(send);
    setErrors(errs);
    if (errs.length) return window.scrollTo({ top: 0, behavior: 'smooth' });
    setBusy(send ? 'send' : 'draft');
    try {
      const data = cleanData(schema, values);
      const location = geo.fix ? { location: { lat: geo.fix.lat, lng: geo.fix.lng }, gpsAccuracyM: geo.fix.accuracy } : {};
      const body = { villageId, occurredAt: new Date(occurredAt).toISOString(), data, ...location };
      setProgress('Menyimpan isian…');
      const saved = report
        ? await callApi<{ id: string }>(`/reports/${report.id}`, { method: 'PATCH', body })
        : await callApi<{ id: string }>('/reports', { method: 'POST', body: { clientUuid, category: schema.category, schemaVersion: schema.version, ...body } });

      const pending = Object.entries(files).flatMap(([fieldKey, list]) => list.map((file) => ({ fieldKey, file })));
      for (const [i, { fieldKey, file }] of pending.entries()) {
        setProgress(`Mengunggah foto ${i + 1} dari ${pending.length}…`);
        const form = new FormData();
        form.set('file', await shrinkImage(file));
        form.set('fieldKey', fieldKey);
        form.set('clientUuid', newUuid());
        form.set('source', 'CAMERA');
        form.set('capturedAt', new Date(file.lastModified || Date.now()).toISOString());
        await uploadForm(`/reports/${saved.id}/attachments`, form);
      }
      setFiles({});

      if (send && !ralat) {
        setProgress('Mengirim laporan…');
        await callApi(`/reports/${saved.id}/submit`, { method: 'POST' });
      }
      router.replace(`/bhabin/laporan/${saved.id}?${ralat ? 'diralat' : send ? 'terkirim' : 'tersimpan'}=1`);
      router.refresh();
    } catch (e) {
      setErrors([(e as Error).message]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy('');
      setProgress('');
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(true); }} className="space-y-4" noValidate>
      {errors.length > 0 && (
        <Alert tone="danger" title="Periksa kembali">
          <ul className="list-disc space-y-0.5 pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </Alert>
      )}
      {ralat && report?.editableUntil && (
        <Alert tone="info">Ralat laporan terkirim. Perubahan menggantikan isian lama; foto lama tetap tersimpan.</Alert>
      )}

      <Section title="Lokasi & waktu">
        <Labeled label="Desa binaan" required>
          <Select value={villageId} onChange={(e) => setVillageId(e.target.value)} className="h-11">
            <option value="">— Pilih desa —</option>
            {villages.map((v) => <option key={v.id} value={v.id}>{v.nama} · {v.kecamatan}</option>)}
          </Select>
        </Labeled>
        <Labeled label="Waktu kegiatan" required hint="Paling lambat 3×24 jam yang lalu">
          <Input type="datetime-local" value={occurredAt} min={minTime} max={maxTime} onChange={(e) => setOccurredAt(e.target.value)} className="h-11" />
        </Labeled>
        <div className={cn('flex items-center gap-3 rounded-xl border p-3', geo.fix ? 'border-success/30 bg-success-soft/50' : geo.error ? 'border-danger/30 bg-danger-soft/50' : 'border-line bg-bg')}>
          <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', geo.fix ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary')}>
            {geo.busy ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
          </span>
          <div className="min-w-0 flex-1 text-sm">
            {geo.busy ? <p>Mencari lokasi GPS…</p>
              : geo.fix ? <><p className="font-medium">Lokasi didapat</p><p className="text-xs text-muted">{geo.fix.lat.toFixed(5)}, {geo.fix.lng.toFixed(5)} · akurasi ±{geo.fix.accuracy} m</p></>
              : geo.error ? <p className="text-danger">{geo.error}</p>
              : report ? <><p className="font-medium">Memakai lokasi laporan</p><p className="text-xs text-muted">{report.lat.toFixed(5)}, {report.lng.toFixed(5)}</p></>
              : <p className="text-muted">Lokasi belum diambil</p>}
          </div>
          <button type="button" onClick={() => void geo.locate()} disabled={geo.busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold hover:border-primary/40 disabled:opacity-50">
            <Crosshair size={14} /> {geo.fix ? 'Ulangi' : 'Ambil lokasi'}
          </button>
        </div>
      </Section>

      <Section title={schema.title}>
        {schema.fields.map((f) => (
          <FieldInput key={f.key} f={f} value={values[f.key]} values={values} set={set} commodities={commodities}
            files={files[f.key] ?? []} existing={existingCount[f.key] ?? 0} ralat={ralat}
            setFiles={(list) => setFiles((p) => ({ ...p, [f.key]: list }))} />
        ))}
      </Section>

      <div className="sticky bottom-20 z-10 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
        {progress && <p className="mb-2 flex items-center gap-2 text-xs text-muted"><Loader2 size={13} className="animate-spin" /> {progress}</p>}
        <div className="flex gap-2">
          {!ralat && (
            <Button type="button" variant="secondary" className="h-12 flex-1 whitespace-nowrap px-3" disabled={!!busy} loading={busy === 'draft'} loadingText="Menyimpan…" icon={<Save size={16} />} onClick={() => void save(false)} aria-label="Simpan draft">
              Draft
            </Button>
          )}
          <Button type="submit" className="h-12 flex-[2]" disabled={!!busy} loading={busy === 'send'} icon={<Send size={17} />}>
            {ralat ? 'Simpan ralat' : 'Kirim laporan'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Labeled({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}{required && <span className="text-danger"> *</span>}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function FieldInput({
  f, value, values, set, commodities, files, setFiles, existing, ralat,
}: {
  f: FormField; value: unknown; values: Values; set: (k: string, v: unknown) => void; commodities: Commodity[];
  files: File[]; setFiles: (l: File[]) => void; existing: number; ralat: boolean;
}) {
  const req = isRequired(f, values);
  const str = (value ?? '') as string;

  if (MEDIA.includes(f.type)) return <MediaInput f={f} req={req} files={files} setFiles={setFiles} existing={existing} />;

  if (f.type === 'repeater') return <RepeaterInput f={f} rows={(value as Row[]) ?? [{}]} set={(rows) => set(f.key, rows)} commodities={commodities} req={req} />;

  if (f.type === 'multiselect') {
    const picked = (value as string[]) ?? [];
    return (
      <div>
        <span className="mb-1.5 block text-sm font-medium">{f.label}{req && <span className="text-danger"> *</span>}</span>
        <div className="flex flex-wrap gap-2">
          {f.options?.map((o) => {
            const on = picked.includes(o);
            return (
              <button key={o} type="button" aria-pressed={on} onClick={() => set(f.key, on ? picked.filter((x) => x !== o) : [...picked, o])}
                className={cn('rounded-full border px-3.5 py-2 text-sm transition', on ? 'border-primary bg-primary text-white' : 'border-line bg-surface hover:border-primary/40')}>
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (f.type === 'select') {
    return (
      <Labeled label={f.label} required={req}>
        <Select value={str} onChange={(e) => set(f.key, e.target.value)} className="h-11">
          <option value="">— Pilih —</option>
          {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      </Labeled>
    );
  }

  if (f.type === 'textarea') {
    return (
      <Labeled label={f.label} required={req} hint={f.maxLength ? `${str.length}/${f.maxLength} karakter` : undefined}>
        <Textarea rows={4} value={str} maxLength={f.maxLength} onChange={(e) => set(f.key, e.target.value)} />
      </Labeled>
    );
  }

  if (f.type === 'nik') {
    return (
      <Labeled label={f.label} required={req} hint={ralat ? 'Kosongkan bila tidak diubah — NIK lama tetap tersimpan (terenkripsi).' : 'Disimpan terenkripsi.'}>
        <Input inputMode="numeric" autoComplete="off" maxLength={16} value={str} placeholder="16 digit" onChange={(e) => set(f.key, e.target.value.replace(/\D/g, ''))} className="h-11 font-mono tracking-wider" />
      </Labeled>
    );
  }

  if (f.type === 'number' || f.type === 'currency') {
    return (
      <Labeled label={f.label} required={req}>
        <div className="relative">
          {f.type === 'currency' && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">Rp</span>}
          <Input inputMode={f.decimal ? 'decimal' : 'numeric'} value={str} onChange={(e) => set(f.key, e.target.value.replace(f.decimal ? /[^\d.]/g : /\D/g, ''))}
            className={cn('h-11', f.type === 'currency' && 'pl-10')} />
        </div>
      </Labeled>
    );
  }

  return (
    <Labeled label={f.label} required={req}>
      <Input value={str} maxLength={f.maxLength} onChange={(e) => set(f.key, e.target.value)} className="h-11" />
    </Labeled>
  );
}

function MediaInput({ f, req, files, setFiles, existing }: { f: FormField; req: boolean; files: File[]; setFiles: (l: File[]) => void; existing: number }) {
  const max = f.max ?? 3;
  const room = Math.max(max - existing - files.length, 0);
  const photo = f.type === 'photo';
  const previews = useMemo(() => files.map((file) => (file.type.startsWith('image/') ? URL.createObjectURL(file) : '')), [files]);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  const add = (list: FileList | null) => list && setFiles([...files, ...Array.from(list).slice(0, room)]);

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{f.label}{req && <span className="text-danger"> *</span>}</span>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: existing }).map((_, i) => (
          <div key={`e${i}`} className="grid aspect-square place-items-center rounded-xl border border-success/30 bg-success-soft/50 text-center text-[11px] text-success">Terunggah</div>
        ))}
        {files.map((file, i) => (
          <div key={`${file.name}-${i}`} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-bg">
            {previews[i]
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={previews[i]} alt="" className="h-full w-full object-cover" />
              : <span className="grid h-full place-items-center p-2 text-center text-[11px] text-muted">{file.name}</span>}
            <button type="button" aria-label="Hapus" onClick={() => setFiles(files.filter((_, j) => j !== i))}
              className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"><X size={14} /></button>
          </div>
        ))}
        {room > 0 && (
          <>
            {photo && (
              <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft/40 text-primary">
                <span className="flex flex-col items-center gap-1 text-[11px] font-semibold"><Camera size={22} /> Kamera</span>
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
              </label>
            )}
            <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line bg-bg text-muted">
              <span className="flex flex-col items-center gap-1 text-[11px] font-semibold"><ImagePlus size={22} /> {photo ? 'Galeri' : 'Pilih berkas'}</span>
              <input type="file" multiple accept={f.accept?.join(',') ?? (photo ? 'image/*' : 'image/*,application/pdf')} className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
            </label>
          </>
        )}
      </div>
      <span className="mt-1 block text-xs text-muted">Maksimal {max} {photo ? 'foto' : 'berkas'}{f.min ? `, minimal ${f.min}` : ''}. Foto diperkecil otomatis sebelum diunggah.</span>
    </div>
  );
}

function RepeaterInput({ f, rows, set, commodities, req }: { f: FormField; rows: Row[]; set: (rows: Row[]) => void; commodities: Commodity[]; req: boolean }) {
  const update = (i: number, key: string, v: string) => set(rows.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, [key]: v };
    // Pilih komoditas → satuan default otomatis.
    if (key === 'commodityId') {
      const c = commodities.find((x) => String(x.id) === v);
      if (c && !r.satuan) next.satuan = c.satuanDefault;
    }
    return next;
  }));

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{f.label}{req && <span className="text-danger"> *</span>}</span>
      <div className="space-y-2.5">
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl border border-line bg-bg/60 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
              <span>Baris {i + 1}</span>
              {rows.length > 1 && (
                <button type="button" onClick={() => set(rows.filter((_, j) => j !== i))} className="inline-flex items-center gap-1 text-danger"><Trash2 size={13} /> Hapus</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(f.fields ?? []).map((s) => (
                <label key={s.key} className={cn('block', s.source === 'commodities' && 'col-span-2')}>
                  <span className="mb-1 block text-xs text-muted">{s.label}</span>
                  {s.type === 'select' ? (
                    <Select value={row[s.key] ?? ''} onChange={(e) => update(i, s.key, e.target.value)} className="h-10 text-sm">
                      <option value="">—</option>
                      {s.source === 'commodities'
                        ? commodities.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)
                        : s.options?.map((o) => <option key={o} value={o}>{STOK_LABEL[o] ?? o}</option>)}
                    </Select>
                  ) : (
                    <Input inputMode="numeric" value={row[s.key] ?? ''} onChange={(e) => update(i, s.key, e.target.value.replace(/\D/g, ''))} className="h-10 text-sm" />
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => set([...rows, {}])} className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line py-2.5 text-sm font-medium text-primary hover:border-primary/40">
          <Plus size={16} /> Tambah {f.label.toLowerCase().includes('harga') ? 'komoditas' : 'baris'}
        </button>
      </div>
    </div>
  );
}
