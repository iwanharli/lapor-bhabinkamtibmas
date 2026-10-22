import type { ReportDetail } from '@/lib/types';

/** Field sensitif yang terisi (termasuk sub-field repeater, mis. NIK anggota keluarga). */
export function revealableFields(report: ReportDetail) {
  return (report.schema?.fields ?? []).flatMap((f) => {
    if (!report.sensitiveFilled?.includes(f.key)) return [];
    if (f.sensitive) return [{ key: f.key, label: f.label }];
    const subs = f.fields?.filter((x) => x.sensitive) ?? [];
    return subs.length ? [{ key: f.key, label: `${subs.map((x) => x.label).join(', ')} (${f.label.toLowerCase()})` }] : [];
  });
}
