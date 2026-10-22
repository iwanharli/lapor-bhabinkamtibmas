import { apiGet } from '@/lib/api/server';
import type { Commodity, FormSchema, Village } from './report-form';

/** Kategori di URL: SAMBANG → "sambang", DETEKSI_DINI → "deteksi-dini". */
export const slugOf = (category: string) => category.toLowerCase().replace(/_/g, '-');
export const categoryOf = (slug: string) => slug.toUpperCase().replace(/-/g, '_');

/** Skema formulir aktif (versi terbaru per kategori; Penyuluhan sedang ditunda sehingga tidak muncul). */
export async function activeSchemas(): Promise<FormSchema[]> {
  const rows = await apiGet<{ category: string; version: number; schema: FormSchema }[]>('/form-schemas');
  const latest = new Map<string, FormSchema>();
  for (const r of rows) if (!latest.has(r.category)) latest.set(r.category, { ...r.schema, category: r.category, version: r.version });
  return [...latest.values()];
}

export interface Me {
  id: string;
  nama: string;
  pangkat: string | null;
  unit: { id: string; nama: string; timezone: string };
  villages: { village: Village & { kabupaten: string } }[];
}

export const getMe = () => apiGet<Me>('/auth/me');
export const getCommodities = () => apiGet<Commodity[]>('/commodities');
