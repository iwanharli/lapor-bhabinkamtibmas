import { Alert } from '@/components/ui';
import { personName, tanggalJam } from '@/lib/format';
import type { ReportDetail } from '@/lib/types';

export function ReviewNote({ report: r }: { report: ReportDetail }) {
  if (!r.reviewNote) return null;
  return (
    <Alert tone="warn" title="Catatan verifikator">
      <p>{r.reviewNote}</p>
      {r.reviewedBy && <p className="mt-2 text-xs text-muted">{personName(r.reviewedBy)} · {r.reviewedAt && tanggalJam(r.reviewedAt, r.unit.timezone)}</p>}
    </Alert>
  );
}
