import { ChevronRight, MapPinOff, Paperclip } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { CategoryIcon } from '@/features/reports/category-icon';
import { CATEGORY_LABEL, relatif } from '@/lib/format';
import type { ReportListItem } from '@/lib/types';

/** Satu laporan milik Bhabin dalam daftar (beranda & Laporan saya). */
export function ReportCard({ r }: { r: ReportListItem }) {
  const draft = r.status === 'DRAFT';
  return (
    <Link href={`/bhabin/laporan/${r.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm transition active:scale-[0.99] hover:border-primary/40">
      <CategoryIcon category={r.category} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{CATEGORY_LABEL[r.category] ?? r.category}</span>
          {r.priority && <Badge tone="danger" strong className="text-[9px]">Prioritas</Badge>}
        </span>
        <span className="block truncate text-xs text-muted">{r.village.nama} · {relatif(r.occurredAt, r.unit.timezone)}</span>
        <span className="mt-1 flex items-center gap-2 text-[11px]">
          {draft ? <Badge tone="neutral">Draft — belum dikirim</Badge> : <Badge tone="info">Terkirim</Badge>}
          {(r.isMockLocation || r.insideVillage === false) && <span className="inline-flex items-center gap-0.5 text-warn"><MapPinOff size={12} /> lokasi</span>}
          {r._count.attachments > 0 && <span className="inline-flex items-center gap-0.5 text-muted"><Paperclip size={12} />{r._count.attachments}</span>}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </Link>
  );
}
