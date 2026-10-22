/**
 * Validasi isian laporan terhadap skema form (packages/form-schemas, docs/teknis/03 §4).
 * Mengembalikan daftar galat per field; field media (photo/file) divalidasi terpisah lewat jumlah lampiran.
 */

export interface SchemaField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'currency' | 'date' | 'select' | 'multiselect' | 'nik' | 'photo' | 'file' | 'repeater';
  required?: boolean;
  requiredIf?: { field: string; equals: unknown };
  options?: string[];
  source?: 'commodities';
  min?: number;
  max?: number;
  maxLength?: number;
  decimal?: boolean;
  sensitive?: boolean;
  fields?: SchemaField[];
}

export interface FormSchemaJson {
  category: string;
  version: number;
  title: string;
  fields: SchemaField[];
  rules?: { when: { field: string; equals: unknown }; then: { flag: 'PRIORITY' } }[];
}

export interface FieldError {
  field: string;
  message: string;
}

const MEDIA = ['photo', 'file'];
const empty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

export function isRequired(f: SchemaField, data: Record<string, unknown>) {
  return !!f.required || (!!f.requiredIf && data[f.requiredIf.field] === f.requiredIf.equals);
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
            if (sub.required) errors.push({ field: `${f.key}[${i}].${sub.key}`, message: `${f.label} baris ${i + 1}, ${sub.label}: wajib diisi` });
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
  return (schema.rules ?? []).some((r) => r.then.flag === 'PRIORITY' && data[r.when.field] === r.when.equals);
}

/** Pisahkan field sensitif (dienkripsi) dari data biasa. */
export function splitSensitive(schema: FormSchemaJson, data: Record<string, unknown>) {
  const sensitiveKeys = new Set(schema.fields.filter((f) => f.sensitive).map((f) => f.key));
  const plain: Record<string, unknown> = {};
  const secret: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) (sensitiveKeys.has(k) ? secret : plain)[k] = v;
  return { plain, secret };
}
