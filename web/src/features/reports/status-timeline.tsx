import { cn } from '@/components/ui';
import { personName, ROLE_LABEL, STATUS_LABEL, tanggalJam } from '@/lib/format';
import type { StatusHistoryEntry } from '@/lib/types';

const DOT: Record<string, string> = {
  SUBMITTED: 'bg-primary',
  IN_REVIEW: 'bg-warn',
  NEEDS_REVISION: 'bg-orange-500',
  APPROVED: 'bg-success',
  REJECTED: 'bg-danger',
};

/** Riwayat lengkap perubahan status, terbaru di atas. */
export function StatusTimeline({ history, tz }: { history: StatusHistoryEntry[]; tz?: string }) {
  return (
    <ol className="px-5 py-4">
      {[...history].reverse().map((h, i, all) => (
        <li key={i} className="relative pb-5 pl-6 last:pb-0">
          {i < all.length - 1 && <span className="absolute bottom-0 left-[5px] top-3 w-px bg-line" />}
          <span className={cn('absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full ring-4 ring-surface', DOT[h.toStatus] ?? 'bg-muted')} />
          <p className="text-sm font-semibold">{STATUS_LABEL[h.toStatus]}</p>
          <p className="text-xs text-muted">{tanggalJam(h.at, tz)}</p>
          <p className="mt-0.5 text-xs text-muted">oleh {personName(h.actor)} · {ROLE_LABEL[h.actor.role]}</p>
          {h.note && <p className="mt-2 rounded-lg bg-bg px-3 py-2 text-sm">“{h.note}”</p>}
        </li>
      ))}
    </ol>
  );
}
