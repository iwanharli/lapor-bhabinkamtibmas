import { Badge, type BadgeTone } from '@/components/ui';
import { STATUS_LABEL } from '@/lib/format';

const TONE: Record<string, BadgeTone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  IN_REVIEW: 'warn',
  NEEDS_REVISION: 'orange',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={TONE[status]}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function PriorityBadge() {
  return <Badge tone="danger" strong className="text-[10px]">Prioritas</Badge>;
}
