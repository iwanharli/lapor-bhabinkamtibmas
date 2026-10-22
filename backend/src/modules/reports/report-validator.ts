/**
 * Validasi isian laporan terhadap skema form (packages/form-schemas, docs/teknis/03 §4).
 * Mengembalikan daftar galat per field; field media (photo/file) divalidasi terpisah lewat jumlah lampiran.
 */

export interface SchemaField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'currency' | 'date' | 'select' | 'multiselect' | 'nik' | 'phone' | 'photo' | 'file' | 'repeater';
  required?: boolean;
  /** Wajib (dan ditampilkan) hanya bila field lain bernilai `equals` atau salah satu `in`. Di repeater, field acuannya di baris yang sama. */
  requiredIf?: { field: string; equals?: unknown; in?: unknown[] };
  /** Tampil hanya untuk kelompok tertentu (nilai field lain, jenis kelamin, umur dari tanggal lahir); di repeater acuannya baris yang sama. */
  showIf?: ShowIf;
  /** Petunjuk isian per nilai field acuan requiredIf (hanya untuk tampilan). */
  placeholders?: Record<string, string>;
  options?: string[];
  source?: 'commodities';
  min?: number;
  max?: number;
  maxLength?: number;
  decimal?: boolean;
  sensitive?: boolean;
  fields?: SchemaField[];
}

export interface ShowIf {
  field?: string;
  in?: unknown[];
  sexField?: string;
  sex?: string;
  /** Field tanggal lahir (YYYY-MM-DD); umur dalam tahun, ageMax eksklusif. Tanpa tanggal lahir → tidak tampil. */
  dob?: string;
  ageMin?: number;
  ageMax?: number;
}

/** Umur (tahun penuh) dari YYYY-MM-DD; null bila kosong/tidak valid. */
export function ageYears(dob: unknown, now = new Date()) {
  if (typeof dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const a = now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0);
  return a < 0 ? null : a;
}

export function showIfMet(s: ShowIf | undefined, data: Record<string, unknown>) {
  if (!s) return true;
  if (s.field && !(s.in ?? []).includes(data[s.field])) return false;
  if (s.sexField && data[s.sexField] !== s.sex) return false;
  if (s.dob) {
    const a = ageYears(data[s.dob]);
    if (a == null || (s.ageMin != null && a < s.ageMin) || (s.ageMax != null && a >= s.ageMax)) return false;
  }
  return true;
}

export interface FormSchemaJson {
  category: string;
  version: number;
  title: string;
  fields: SchemaField[];
  /** Formulir bertahap: judul langkah & field yang tampil di tiap langkah. */
  steps?: { title: string; description?: string; fields: string[] }[];
  /** Prioritas bila field bernilai equals; dengan `repeater`, cukup salah satu baris yang cocok. */
  rules?: { when: { repeater?: string; field: string; equals: unknown }; then: { flag: 'PRIORITY' } }[];
}

export interface FieldError {
  field: string;
  message: string;
}

const MEDIA = ['photo', 'file'];
const empty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

/** Field bersyarat aktif? (tanpa requiredIf selalu aktif) */
export function conditionMet(f: SchemaField, data: Record<string, unknown>) {
  if (!showIfMet(f.showIf, data)) return false;
  if (!f.requiredIf) return true;
  const v = data[f.requiredIf.field];
  return f.requiredIf.in ? f.requiredIf.in.includes(v) : v === f.requiredIf.equals;
}

export function isRequired(f: SchemaField, data: Record<string, unknown>) {
  return !!f.required || (!!f.requiredIf && conditionMet(f, data));
}

function checkValue(f: SchemaField, v: unknown, path: string, ctx: { commodityIds: Set<number> }): string | null {
  switch (f.type) {
    case 'text':
    case 'textarea':
      if (typeof v !== 'string') return 'harus berupa teks';
      if (f.maxLength && v.length > f.maxLength) return `maksimal ${f.maxLength} karakter`;
      if (v.trim().length === 0) return 'tidak boleh kosong';
      return null;
    case 'number':
    case 'currency': {
      const n = typeof v === 'string' ? Number(v) : v;
      if (typeof n !== 'number' || !Number.isFinite(n)) return 'harus berupa angka';
      if ((f.type === 'currency' || !f.decimal) && !Number.isInteger(n)) return 'harus bilangan bulat';
      if (f.min != null && n < f.min) return `minimal ${f.min}`;
      if (f.max != null && n > f.max) return `maksimal ${f.max}`;
      return null;
    }
    case 'date':
      return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? null : 'tanggal tidak valid';
    case 'select':
      if (f.source === 'commodities') return ctx.commodityIds.has(Number(v)) ? null : 'komoditas tidak dikenal';
      return f.options?.includes(String(v)) ? null : `harus salah satu dari: ${f.options?.join(', ')}`;
    case 'multiselect':
      if (!Array.isArray(v)) return 'harus berupa daftar pilihan';
      return v.every((x) => f.options?.includes(String(x))) ? null : `pilihan tidak dikenal`;
    case 'nik':
      return /^\d{16}$/.test(String(v)) ? null : 'NIK harus 16 digit angka';
    case 'phone':
      // Nomor HP Indonesia: 08…, 628…, atau +628…, total 10–15 digit.
      return /^(\+?62|0)8\d{7,12}$/.test(String(v).replace(/[\s-]/g, '')) ? null : 'nomor HP tidak valid (mis. 0812xxxxxxxx)';
    default:
      return null;
  }
}

/** Validasi data terhadap skema. `attachmentCounts` = jumlah lampiran per fieldKey (null untuk lewati cek media, mis. saat menyimpan draft). */
export function validateReportData(
  schema: FormSchemaJson,
  data: Record<string, unknown>,
  ctx: { commodityIds: Set<number>; attachmentCounts: Record<string, number> | null },
): FieldError[] {
  const errors: FieldError[] = [];
  const known = new Set(schema.fields.map((f) => f.key));
  for (const k of Object.keys(data)) if (!known.has(k)) errors.push({ field: k, message: 'field tidak dikenal dalam formulir ini' });

  for (const f of schema.fields) {
    if (MEDIA.includes(f.type)) {
      if (!ctx.attachmentCounts) continue;
      const n = ctx.attachmentCounts[f.key] ?? 0;
      const min = f.min ?? (isRequired(f, data) ? 1 : 0);
      if (isRequired(f, data) && n < Math.max(min, 1)) errors.push({ field: f.key, message: `${f.label}: wajib minimal ${Math.max(min, 1)} berkas` });
      else if (n && n < min) errors.push({ field: f.key, message: `${f.label}: minimal ${min} berkas` });
      if (f.max != null && n > f.max) errors.push({ field: f.key, message: `${f.label}: maksimal ${f.max} berkas` });
      continue;
    }
    const v = data[f.key];
    if (empty(v)) {
      if (isRequired(f, data)) errors.push({ field: f.key, message: `${f.label}: wajib diisi` });
      continue;
    }
    if (f.type === 'repeater') {
      if (!Array.isArray(v)) {
        errors.push({ field: f.key, message: `${f.label}: harus berupa daftar` });
        continue;
      }
      if (f.min && v.length < f.min) errors.push({ field: f.key, message: `${f.label}: minimal ${f.min} baris` });
      v.forEach((row, i) => {
        for (const sub of f.fields ?? []) {
          const sv = (row as Record<string, unknown>)?.[sub.key];
          if (empty(sv)) {
            if (isRequired(sub, (row ?? {}) as Record<string, unknown>)) errors.push({ field: `${f.key}[${i}].${sub.key}`, message: `${f.label} baris ${i + 1}, ${sub.label}: wajib diisi` });
            continue;
          }
          const msg = checkValue(sub, sv, `${f.key}[${i}].${sub.key}`, ctx);
          if (msg) errors.push({ field: `${f.key}[${i}].${sub.key}`, message: `${f.label} baris ${i + 1}, ${sub.label}: ${msg}` });
        }
      });
      continue;
    }
    const msg = checkValue(f, v, f.key, ctx);
    if (msg) errors.push({ field: f.key, message: `${f.label}: ${msg}` });
  }
  return errors;
}

/** Apakah laporan prioritas menurut aturan skema. */
export function isPriority(schema: FormSchemaJson, data: Record<string, unknown>) {
  return (schema.rules ?? []).some((r) => {
    if (r.then.flag !== 'PRIORITY') return false;
    if (!r.when.repeater) return data[r.when.field] === r.when.equals;
    const rows = data[r.when.repeater];
    return Array.isArray(rows) && rows.some((row) => {
      const x = (row ?? {}) as Record<string, unknown>;
      const sub = schema.fields.find((f) => f.key === r.when.repeater)?.fields?.find((f) => f.key === r.when.field);
      return x[r.when.field] === r.when.equals && (!sub || conditionMet(sub, x));
    });
  });
}

/**
 * Pisahkan field sensitif (dienkripsi) dari data biasa. Sub-field sensitif di repeater (mis. NIK anggota keluarga)
 * disimpan per baris: secret[repeaterKey] = [{ nik }, …] sejajar dengan baris di data biasa.
 */
export function splitSensitive(schema: FormSchemaJson, data: Record<string, unknown>) {
  const sensitiveKeys = new Set(schema.fields.filter((f) => f.sensitive).map((f) => f.key));
  const nested = new Map(schema.fields.filter((f) => f.type === 'repeater' && f.fields?.some((x) => x.sensitive))
    .map((f) => [f.key, new Set(f.fields!.filter((x) => x.sensitive).map((x) => x.key))]));
  const plain: Record<string, unknown> = {};
  const secret: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const subs = nested.get(k);
    if (subs && Array.isArray(v)) {
      const rows = v as Record<string, unknown>[];
      plain[k] = rows.map((r) => Object.fromEntries(Object.entries(r ?? {}).filter(([sk]) => !subs.has(sk))));
      const hidden = rows.map((r) => Object.fromEntries(Object.entries(r ?? {}).filter(([sk, sv]) => subs.has(sk) && !empty(sv))));
      if (hidden.some((h) => Object.keys(h).length)) secret[k] = hidden;
    } else (sensitiveKeys.has(k) ? secret : plain)[k] = v;
  }
  return { plain, secret };
}

/** Gabungkan data biasa + data sensitif (hasil dekripsi) menjadi isian utuh, termasuk sub-field repeater per baris. */
export function mergeSensitive(plain: Record<string, unknown>, secret: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...plain };
  for (const [k, v] of Object.entries(secret)) {
    if (Array.isArray(v) && Array.isArray(plain[k])) {
      out[k] = (plain[k] as Record<string, unknown>[]).map((row, i) => ({ ...row, ...((v[i] as Record<string, unknown>) ?? {}) }));
    } else out[k] = v;
  }
  return out;
}

/** Gabungkan rahasia lama + baru (ralat): nilai baru menimpa; baris repeater kosong di data baru mempertahankan nilai lama. */
export function mergeSecret(existing: Record<string, unknown>, next: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(next)) {
    if (Array.isArray(v) && Array.isArray(existing[k])) {
      out[k] = v.map((row, i) => ({ ...((existing[k] as Record<string, unknown>[])[i] ?? {}), ...(row as Record<string, unknown>) }));
    } else out[k] = v;
  }
  return out;
}
