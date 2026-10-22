import { Badge, type BadgeTone } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/format';

export const ROLE_TONE: Record<string, BadgeTone> = {
  BHABIN: 'info',
  VERIFIKATOR: 'warn',
  PIMPINAN: 'success',
  ADMIN_UNIT: 'orange',
  SUPERADMIN: 'danger',
  AUDITOR: 'neutral',
};

export const ROLE_DOT: Record<string, string> = {
  BHABIN: 'bg-info',
  VERIFIKATOR: 'bg-warn',
  PIMPINAN: 'bg-success',
  ADMIN_UNIT: 'bg-orange-500',
  SUPERADMIN: 'bg-danger',
  AUDITOR: 'bg-muted',
};

export function RoleBadge({ role }: { role: string }) {
  return <Badge tone={ROLE_TONE[role] ?? 'neutral'}>{ROLE_LABEL[role] ?? role}</Badge>;
}
