'use client';

import { Camera, Check, Clock, History, Lock, TriangleAlert, ChevronLeft, ChevronRight, Crosshair, ImagePlus, Loader2, MapPin, Plus, Save, Send, Trash2, UserRound, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, cn, Input, Select, Textarea } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import type { ReportDetail } from '@/lib/types';
import { newUuid, shrinkImage, uploadForm, useGeolocation } from './field-utils';

export interface FormField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  /** Tampil & wajib hanya bila field acuan bernilai equals / salah satu `in` (di repeater: field di baris yang sama). */
  requiredIf?: { field: string; equals?: unknown; in?: unknown[] };
  /** Petunjuk isian per nilai field acuan. */
  placeholders?: Record<string, string>;
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
export interface FormStep { title: string; description?: string; fields: string[] }
export interface FormSchema { category: string; version: number; title: string; fields: FormField[]; steps?: FormStep[] }
export interface Commodity { id: number; nama: string; satuanDefault: string }
export interface Village { id: string; nama: string; kecamatan: string }

type Values = Record<string, unknown>;
type Row = Record<string, string>;
const MEDIA = ['photo', 'file'];
const STOK_LABEL: Record<string, string> = { AMAN: 'Aman', MENIPIS: 'Menipis', KOSONG: 'Kosong' };

/** Field bersyarat aktif (ditampilkan) untuk konteks nilai ini? */
const active = (f: FormField, v: Values) => {
  if (!f.requiredIf) return true;
  const x = v[f.requiredIf.field];
  return f.requiredIf.in ? f.requiredIf.in.includes(x) : x === f.requiredIf.equals;
};
const isRequired = (f: FormField, v: Values) => !!f.required || (!!f.requiredIf && active(f, v));
const empty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

/** Siapkan isian untuk API: angka sebagai number, kosong dibuang, NIK kosong tidak dikirim (nilai lama tetap dipakai saat ralat). */
function cleanData(schema: FormSchema, values: Values) {
  const out: Values = {};
  for (const f of schema.fields) {
    if (MEDIA.includes(f.type) || !active(f, values)) continue;
    const v = values[f.key];
    if (empty(v)) continue;
    if (f.type === 'number' || f.type === 'currency') out[f.key] = Number(v);
    else if (f.type === 'repeater') {
      out[f.key] = (v as Row[])
        .filter((row) => Object.values(row).some((x) => x !== ''))
        .map((row) => Object.fromEntries((f.fields ?? []).filter((s) => row[s.key] !== '' && row[s.key] != null && active(s, row)).map((s) => [
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
  // Isian sensitif (No KK/NIK) yang sudah tersimpan terenkripsi: tidak dikirim ke layar; kosong = pakai nilai tersimpan.
  const saved = new Set(report?.sensitiveFilled ?? []);
  const geo = useGeolocation();
  const [clientUuid] = useState(() => newUuid());
  // Desa binaan dikunci: 1 Bhabin membina 1 desa (ralat/draft memakai desa laporan itu).
  const village = report ? { id: report.village.id, nama: report.village.nama, kecamatan: report.village.kecamatan } : villages[0];
  const villageId = village?.id ?? '';
  // Waktu kegiatan dikunci: laporan baru = waktu saat disimpan/dikirim; draft & ralat mempertahankan waktu awalnya.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (report) return;
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [report]);
  const occurredAt = report ? new Date(report.occurredAt) : now;
  const [values, setValues] = useState<Values>(() => {
    const init: Values = {};
    for (const f of schema.fields) {
      const v = report?.data?.[f.key];
      if (f.type === 'repeater') {
        const rows = (Array.isArray(v) ? v : []) as Values[];
        init[f.key] = rows.length ? rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, x]) => [k, String(x ?? '')]))) : (f.min ?? 0) >= 1 || f.fields?.some((x) => x.source === 'commodities') ? [{}] : [];
      } else if (f.type === 'multiselect') init[f.key] = Array.isArray(v) ? v : [];
      else if (!MEDIA.includes(f.type)) init[f.key] = v == null ? '' : String(v);
    }
    return init;
  });
  const [files, setFiles] = useState<Record<string, File[]>>({});

  // Cadangan otomatis di perangkat (laporan baru): pulih bila halaman tertutup/ditinggalkan sebelum disimpan.
  // NIK/No KK dan foto tidak dicadangkan (data sensitif & ukuran besar).
  const backupKey = report ? null : `lapor:form:${schema.category}:v${schema.version}`;
  const [restore, setRestore] = useState<{ values: Values; step: number; at: number } | null>(null);
  const backupReady = useRef(false);
  useEffect(() => {
    if (!backupKey) return;
    try {
      const raw = localStorage.getItem(backupKey);
      const b = raw ? JSON.parse(raw) : null;
      if (b?.values && Date.now() - b.at < 3 * 86_400_000) setRestore(b);
    } catch { /* penyimpanan tidak tersedia */ }
    backupReady.current = true;
  }, [backupKey]);
  const stripSensitive = (v: Values): Values => Object.fromEntries(Object.entries(v).map(([k, x]) => {
    const fdef = schema.fields.find((y) => y.key === k);
    if (fdef?.sensitive) return [k, ''];
    if (fdef?.type === 'repeater' && Array.isArray(x)) {
      const subs = new Set(fdef.fields?.filter((y) => y.sensitive).map((y) => y.key));
      return [k, (x as Row[]).map((r) => Object.fromEntries(Object.entries(r).filter(([sk]) => !subs.has(sk))))];
    }
    return [k, x];
  }));
  const [busy, setBusy] = useState<'' | 'draft' | 'send'>('');
  const [progress, setProgress] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const steps = schema.steps?.length ? schema.steps : null;
  const [step, setStep] = useState(0);
  // Melanjutkan draft: buka langkah pertama yang belum lengkap.
  useEffect(() => {
    if (!steps || !report || report.status !== 'DRAFT') return;
    const i = steps.findIndex((st) => validate(true, new Set(st.fields), false).length > 0);
    if (i > 0) setStep(i);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const last = !steps || step === steps.length - 1;

  const existingCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of report?.attachments ?? []) m[a.fieldKey] = (m[a.fieldKey] ?? 0) + 1;
    return m;
  }, [report]);

  // Lokasi diambil otomatis untuk laporan baru/draft; ralat memakai titik lama kecuali diambil ulang.
  useEffect(() => {
    if (!ralat) void geo.locate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: string, v: unknown) => {
    setValues((p) => ({ ...p, [key]: v }));
    setErrors([]);
  };

  useEffect(() => {
    if (!backupKey || !backupReady.current || restore) return;
    const filled = Object.values(values).some((v) => !empty(v) && !(Array.isArray(v) && v.every((r) => !Object.values(r as Row).some(Boolean))));
    try {
      if (filled) localStorage.setItem(backupKey, JSON.stringify({ values: stripSensitive(values), step, at: Date.now() }));
    } catch { /* abaikan */ }
  }, [values, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Peringatan bawaan browser bila menutup/memuat ulang halaman dengan isian belum disimpan.
  useEffect(() => {
    const dirty = Object.values(values).some((v) => !empty(v)) || Object.values(files).some((l) => l.length);
    if (!dirty || busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [values, files, busy]);

  const clearBackup = () => { try { if (backupKey) localStorage.removeItem(backupKey); } catch { /* abaikan */ } };

  /** `only`: validasi sebagian field (satu langkah); `withPlace`: ikut periksa desa/waktu/lokasi. */
  function validate(send: boolean, only?: Set<string>, withPlace = true) {
    const errs: string[] = [];
    if (withPlace) checkPlace(errs);
    if (!send) return errs;
    for (const f of schema.fields) {
      if (only && !only.has(f.key)) continue;
      if (!active(f, values)) continue;
      const req = isRequired(f, values);
      if (MEDIA.includes(f.type)) {
        const n = (existingCount[f.key] ?? 0) + (files[f.key]?.length ?? 0);
        const min = Math.max(f.min ?? 0, req ? 1 : 0);
        if (n < min) errs.push(`${f.label}: minimal ${min} ${f.type === 'photo' ? 'foto' : 'berkas'}.`);
        continue;
      }
      if (f.type === 'nik' && saved.has(f.key) && empty(values[f.key])) continue; // nilai tersimpan tetap dipakai
      if (f.type === 'repeater') {
        const rows = ((values[f.key] as Row[]) ?? []).filter((row) => Object.values(row).some((x) => x !== ''));
        if (req && !rows.length) errs.push(`${f.label} wajib diisi.`);
        rows.forEach((row, i) => {
          for (const sub of f.fields ?? []) {
            if (!active(sub, row)) continue;
            const sv = row[sub.key];
            if (empty(sv)) {
              if (isRequired(sub, row) && !(sub.type === 'nik' && saved.has(f.key))) errs.push(`${f.label} ${i + 1} — ${sub.label} wajib diisi.`);
            } else if (sub.type === 'nik' && !/^\d{16}$/.test(sv)) errs.push(`${f.label} ${i + 1} — ${sub.label} harus 16 digit angka.`);
          }
        });
        continue;
      }
      const v = values[f.key];
      if (req && empty(v)) errs.push(`${f.label} wajib diisi.`);
      if (f.type === 'nik' && !empty(v) && !/^\d{16}$/.test(String(v))) errs.push(`${f.label} harus 16 digit angka.`);
    }
    return errs;
  }

  function checkPlace(errs: string[]) {
    if (!villageId) errs.push('Pilih desa binaan.');
    if (!geo.fix && !report) errs.push('Lokasi GPS belum didapat. Tekan "Ambil lokasi".');
  }

  function next() {
    const errs = validate(true, new Set(steps![step].fields), step === 0);
    setErrors(errs);
    if (!errs.length) {
      setStep((x) => x + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function save(send: boolean) {
    const errs = validate(send);
    setErrors(errs);
    if (errs.length) return;
    setBusy(send ? 'send' : 'draft');
    try {
      const data = cleanData(schema, values);
      const location = geo.fix ? { location: { lat: geo.fix.lat, lng: geo.fix.lng }, gpsAccuracyM: geo.fix.accuracy } : {};
      const body = { villageId, ...(report ? {} : { occurredAt: new Date().toISOString() }), data, ...location };
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
      clearBackup();
      router.replace(`/bhabin/laporan/${saved.id}?${ralat ? 'diralat' : send ? 'terkirim' : 'tersimpan'}=1`);
      router.refresh();
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setBusy('');
      setProgress('');
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(true); }} className="space-y-4" noValidate>
      <ErrorPopup errors={errors} onClose={() => setErrors([])} />
      {restore && (
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--brand)]/25 bg-primary-soft/50 p-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]"><History size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Ada isian yang belum disimpan</p>
            <p className="text-xs text-muted">Dari {new Date(restore.at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. NIK/No. KK dan foto perlu diisi ulang.</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => { setValues((p) => ({ ...p, ...restore.values })); if (steps) setStep(Math.min(restore.step ?? 0, steps.length - 1)); setRestore(null); }}>Lanjutkan isian</Button>
              <Button size="sm" variant="secondary" onClick={() => { clearBackup(); setRestore(null); }}>Mulai baru</Button>
            </div>
          </div>
        </div>
      )}
      {ralat && report?.editableUntil && (
        <Alert tone="info">Ralat laporan terkirim. Perubahan menggantikan isian lama; foto lama tetap tersimpan.</Alert>
      )}

      {steps && <Stepper steps={steps} step={step} onJump={(i) => i < step && setStep(i)} />}

      {(!steps || step === 0) && <Section title="Lokasi & waktu">
        <div>
          <span className="mb-1.5 block text-sm font-medium">Desa binaan</span>
          <div className="flex h-11 items-center gap-2 rounded-lg border border-line bg-bg px-3 text-sm">
            <MapPin size={16} className="shrink-0 text-muted" />
            <span className="flex-1 truncate">{village ? <><strong className="font-semibold">{village.nama}</strong> · {village.kecamatan}</> : <span className="text-danger">Belum ada desa binaan</span>}</span>
            <Lock size={14} className="shrink-0 text-muted" aria-label="Terkunci" />
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Waktu kegiatan</span>
          <div className="flex h-11 items-center gap-2 rounded-lg border border-line bg-bg px-3 text-sm">
            <Clock size={16} className="shrink-0 text-muted" />
            <span className="flex-1 tabular-nums">{occurredAt.toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <Lock size={14} className="shrink-0 text-muted" aria-label="Terkunci" />
          </div>
          <span className="mt-1 block text-xs text-muted">{report ? 'Waktu saat laporan pertama dibuat.' : 'Terisi otomatis dengan waktu saat laporan disimpan atau dikirim.'}</span>
        </div>
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
      </Section>}

      <Section title={steps ? steps[step].title : schema.title} description={steps?.[step].description}>
        {schema.fields.filter((f) => !steps || steps[step].fields.includes(f.key)).map((f) => (
          <FieldInput key={f.key} f={f} value={values[f.key]} values={values} set={set} commodities={commodities}
            files={files[f.key] ?? []} existing={existingCount[f.key] ?? 0} saved={saved}
            setFiles={(list) => setFiles((p) => ({ ...p, [f.key]: list }))} />
        ))}
      </Section>

      <div className="sticky bottom-20 z-10 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
        {progress && <p className="mb-2 flex items-center gap-2 text-xs text-muted"><Loader2 size={13} className="animate-spin" /> {progress}</p>}
        <div className="flex gap-2">
          {steps && step > 0 && (
            <Button type="button" variant="secondary" className="h-12 px-3" disabled={!!busy} icon={<ChevronLeft size={17} />} onClick={() => { setErrors([]); setStep((x) => x - 1); }} aria-label="Kembali">
              <span className="sr-only sm:not-sr-only">Kembali</span>
            </Button>
          )}
          {!ralat && (
            <Button type="button" variant="secondary" className="h-12 flex-1 whitespace-nowrap px-3" disabled={!!busy} loading={busy === 'draft'} loadingText="Menyimpan…" icon={<Save size={16} />} onClick={() => void save(false)} aria-label="Simpan draft">
              Draft
            </Button>
          )}
          {last ? (
            // key berbeda: elemen tombol tidak dipakai ulang saat berganti dari "Lanjut" ke "Kirim" (mencegah kirim tak sengaja).
            <Button key="submit" type="submit" className="h-12 flex-[2]" disabled={!!busy} loading={busy === 'send'} icon={<Send size={17} />}>
              {ralat ? 'Simpan ralat' : 'Kirim laporan'}
            </Button>
          ) : (
            <Button key="next" type="button" className="h-12 flex-[2]" disabled={!!busy} onClick={(e) => { e.preventDefault(); next(); }}>
              Lanjut <ChevronRight size={17} />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

/** Peringatan isian melayang di atas layar (tidak menggeser halaman); bisa ditutup, hilang sendiri saat isian diperbaiki. */
function ErrorPopup({ errors, onClose }: { errors: string[]; onClose: () => void }) {
  const [shown, setShown] = useState<string[]>([]);
  useEffect(() => {
    if (errors.length) setShown(errors);
  }, [errors]);
  const open = errors.length > 0;
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, onClose]);
  return (
    <div aria-live="assertive" className={cn('pointer-events-none fixed inset-x-0 top-[4.25rem] z-40 flex justify-center px-3 transition-all duration-300',
      open ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0')}>
      {shown.length > 0 && (
        <div role="alert" className={cn('w-full max-w-md overflow-hidden rounded-2xl border border-danger/25 bg-surface shadow-[0_18px_44px_-14px_rgba(200,30,58,.45)]', open && 'pointer-events-auto')}>
          <div className="flex items-start gap-3 p-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger"><TriangleAlert size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{shown.length > 1 ? `${shown.length} isian perlu diperbaiki` : 'Periksa kembali'}</p>
              <ul className="mt-1 space-y-1">
                {shown.slice(0, 5).map((e) => (
                  <li key={e} className="flex gap-2 text-[13px] leading-snug text-muted"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />{e}</li>
                ))}
                {shown.length > 5 && <li className="pl-3.5 text-xs text-muted">+{shown.length - 5} lainnya</li>}
              </ul>
            </div>
            <button type="button" onClick={onClose} aria-label="Tutup" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink"><X size={16} /></button>
          </div>
          <div className="h-1 bg-gradient-to-r from-danger/70 via-danger/40 to-transparent" />
        </div>
      )}
    </div>
  );
}

/** Penunjuk langkah formulir bertahap: judul langkah aktif, bilah progres, dan daftar langkah (yang selesai bisa diklik). */
function Stepper({ steps, step, onJump }: { steps: FormStep[]; step: number; onJump: (i: number) => void }) {
  const pct = Math.round(((step + 1) / steps.length) * 100);
  return (
    <nav aria-label="Langkah formulir" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="flex items-center gap-3 px-4 pt-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--brand-2)] to-[var(--brand)] text-sm font-bold text-white shadow-md shadow-[var(--brand)]/25">
          {step + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Langkah {step + 1} dari {steps.length}</p>
          <p className="truncate text-sm font-semibold">{steps[step].title}</p>
        </div>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold tabular-nums text-primary">{pct}%</span>
      </div>
      <div className="mx-4 mt-3 flex gap-1">
        {steps.map((s, i) => (
          <span key={s.title} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', i < step ? 'bg-success' : i === step ? 'bg-[var(--brand)]' : 'bg-line')} />
        ))}
      </div>
      <ol className="mt-1 flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none]">
        {steps.map((s, i) => {
          const done = i < step;
          const cur = i === step;
          return (
            <li key={s.title} className="min-w-0 flex-1">
              <button type="button" onClick={() => onJump(i)} disabled={!done} aria-current={cur ? 'step' : undefined}
                className={cn('flex w-full min-w-[3.5rem] flex-col items-center gap-1 rounded-lg px-1 py-2 text-center transition', done && 'hover:bg-bg')}>
                <span className={cn('grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold',
                  done ? 'bg-success text-white' : cur ? 'bg-[var(--brand)] text-white' : 'bg-bg text-muted ring-1 ring-line')}>
                  {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn('line-clamp-2 text-[10px] leading-tight', cur ? 'font-semibold text-ink' : done ? 'text-success' : 'text-muted')}>{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 className={cn('text-sm font-semibold', !description && 'mb-3')}>{title}</h2>
      {description && <p className="mb-3 text-xs text-muted">{description}</p>}
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
  f, value, values, set, commodities, files, setFiles, existing, saved,
}: {
  f: FormField; value: unknown; values: Values; set: (k: string, v: unknown) => void; commodities: Commodity[];
  files: File[]; setFiles: (l: File[]) => void; existing: number; saved: Set<string>;
}) {
  if (!active(f, values)) return null;
  const req = isRequired(f, values);
  const str = (value ?? '') as string;

  if (MEDIA.includes(f.type)) return <MediaInput f={f} req={req} files={files} setFiles={setFiles} existing={existing} />;

  if (f.type === 'repeater' && !f.fields?.some((x) => x.source === 'commodities')) {
    return <CardRepeater f={f} rows={(value as Row[]) ?? []} set={(rows) => set(f.key, rows)} keep={saved.has(f.key)} />;
  }
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
                className={cn('rounded-full border px-3.5 py-2 text-sm transition', on ? 'border-[var(--brand)] bg-[var(--brand)] text-white' : 'border-line bg-surface hover:border-primary/40')}>
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
      <Labeled label={f.label} required={req} hint={saved.has(f.key) ? '✓ Sudah tersimpan (terenkripsi). Kosongkan bila tidak diubah.' : 'Disimpan terenkripsi.'}>
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

  if (f.type === 'date') {
    return (
      <Labeled label={f.label} required={req}>
        <Input type="date" value={str} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set(f.key, e.target.value)} className="h-11" />
      </Labeled>
    );
  }

  const placeholder = f.placeholders && f.requiredIf ? f.placeholders[String(values[f.requiredIf.field])] : undefined;
  return (
    <Labeled label={f.label} required={req}>
      <Input value={str} maxLength={f.maxLength} placeholder={placeholder} onChange={(e) => set(f.key, e.target.value)} className="h-11" />
    </Labeled>
  );
}

/** Satu isian di dalam kartu repeater (konteks kondisi = baris itu sendiri). */
function SubInput({ f, row, update, keep }: { f: FormField; row: Row; update: (k: string, v: string) => void; keep: boolean }) {
  if (!active(f, row)) return null;
  const req = isRequired(f, row);
  const v = row[f.key] ?? '';
  const wide = f.type === 'text' || f.type === 'nik' || f.type === 'textarea' || (f.options?.length ?? 0) > 6 || !!f.requiredIf;
  const control =
    f.type === 'select' ? (
      <Select value={v} onChange={(e) => update(f.key, e.target.value)} className="h-11">
        <option value="">— Pilih —</option>
        {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
      </Select>
    ) : f.type === 'date' ? (
      <Input type="date" value={v} max={new Date().toISOString().slice(0, 10)} onChange={(e) => update(f.key, e.target.value)} className="h-11" />
    ) : f.type === 'nik' ? (
      <Input inputMode="numeric" autoComplete="off" maxLength={16} value={v} placeholder={keep ? 'Tersimpan · kosongkan bila tidak diubah' : '16 digit'} onChange={(e) => update(f.key, e.target.value.replace(/\D/g, ''))} className="h-11 font-mono tracking-wider" />
    ) : (
      <Input value={v} maxLength={f.maxLength} placeholder={f.placeholders && f.requiredIf ? f.placeholders[row[f.requiredIf.field]] : undefined} onChange={(e) => update(f.key, e.target.value)} className="h-11" />
    );
  return (
    <label className={cn('block', wide && 'col-span-2')}>
      <span className="mb-1 block text-xs font-medium text-muted">{f.label}{req && <span className="text-danger"> *</span>}</span>
      {control}
    </label>
  );
}

/** Repeater berupa kartu per baris (mis. anggota keluarga), tombol + untuk menambah. */
function CardRepeater({ f, rows, set, keep }: { f: FormField; rows: Row[]; set: (rows: Row[]) => void; keep: boolean }) {
  const max = f.max ?? 20;
  const noun = f.label.toLowerCase().replace(/^daftar /, '');
  const update = (i: number, k: string, v: string) => set(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">Belum ada {noun}. Tekan tombol di bawah untuk menambah.</p>
      )}
      {rows.map((row, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-line bg-bg/40">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--brand)]/10 text-[var(--brand)]"><UserRound size={15} /></span>
              <span className="truncate">{row.nama || `${f.label} ${i + 1}`}</span>
              {row.hubungan && <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 text-[11px] font-normal text-muted">{row.hubungan}</span>}
            </span>
            <button type="button" onClick={() => set(rows.filter((_, j) => j !== i))} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-danger hover:bg-danger-soft"><Trash2 size={13} /> Hapus</button>
          </div>
          <div className="grid grid-cols-2 gap-3 p-3">
            {(f.fields ?? []).map((sub) => <SubInput key={sub.key} f={sub} row={row} update={(k, v) => update(i, k, v)} keep={keep} />)}
          </div>
        </div>
      ))}
      {rows.length < max && (
        <button type="button" onClick={() => set([...rows, {}])} className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[var(--brand)]/40 bg-[var(--brand)]/5 py-3 text-sm font-semibold text-[var(--brand)] hover:bg-[var(--brand)]/10">
          <Plus size={17} /> Tambah {noun}
        </button>
      )}
    </div>
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
