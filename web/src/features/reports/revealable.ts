import type { ReportDetail } from '@/lib/types';

export interface RevealField {
  key: string;
  label: string;
  /** Untuk isian berulang: label sub-isian terenkripsi & nama tiap baris agar hasil buka bisa dibaca. */
  subs?: { key: string; label: string }[];
  rows?: string[];
}

/** Field sensitif yang terisi (termasuk sub-field repeater, mis. NIK & data kesehatan anggota keluarga). */
export function revealableFields(report: ReportDetail): RevealField[] {
  return (report.schema?.fields ?? []).flatMap((f) => {
    if (!report.sensitiveFilled?.includes(f.key)) return [];
    if (f.sensitive) return [{ key: f.key, label: f.label }];
    const subs = f.fields?.filter((x) => x.sensitive).map((x) => ({ key: x.key, label: x.label })) ?? [];
    if (!subs.length) return [];
    const rows = (Array.isArray(report.data[f.key]) ? report.data[f.key] : []) as Record<string, unknown>[];
    return [{ key: f.key, label: f.label, subs, rows: rows.map((r, i) => String(r?.nama ?? `${f.label} ${i + 1}`)) }];
  });
}

/** Label ringkas sub-isian terenkripsi sebuah repeater, mis. "NIK & data kesehatan". */
export function secretSummary(labels: string[]) {
  const health = labels.some((l) => /stunting|risiko|hamil/i.test(l));
  const nik = labels.some((l) => /NIK/i.test(l));
  return [nik && 'NIK', health && 'data kesehatan'].filter(Boolean).join(' & ') || 'data sensitif';
}
