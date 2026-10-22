import { CountTabs } from '@/components/ui';
import { STATUS_LABEL } from '@/lib/format';
import { withParams } from '@/lib/url';
import type { ReportSearch } from './report-search';

const TABS = ['SUBMITTED', 'IN_REVIEW', 'NEEDS_REVISION', 'APPROVED', 'REJECTED'];
const DOT: Record<string, string> = {
  SUBMITTED: 'bg-primary',
  IN_REVIEW: 'bg-warn',
  NEEDS_REVISION: 'bg-orange-500',
  APPROVED: 'bg-success',
  REJECTED: 'bg-danger',
};

/** Tab status beserta jumlahnya (mengikuti filter lain yang aktif). */
export function StatusTabs({ sp, total, counts }: { sp: ReportSearch; total: number; counts: Record<string, number | undefined> }) {
  const href = (status?: string) => withParams('/laporan', { ...sp, page: undefined }, { status });
  return (
    <CountTabs
      active={sp.status ?? ''}
      tabs={[
        { key: '', label: 'Semua', count: total, href: href(undefined) },
        ...TABS.map((k) => ({ key: k, label: STATUS_LABEL[k], count: counts[k] ?? 0, href: href(k), dot: DOT[k] })),
      ]}
    />
  );
}
