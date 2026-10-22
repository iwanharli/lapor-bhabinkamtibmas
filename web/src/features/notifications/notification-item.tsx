'use client';

import { Flame, MapPinOff, MapPinned, Bell } from 'lucide-react';
import { cn } from '@/components/ui';
import { relatif, tanggalJam } from '@/lib/format';
import type { AppNotification } from './types';

const ICON: Record<string, { icon: typeof Bell; cls: string }> = {
  REPORT_PRIORITY: { icon: Flame, cls: 'bg-danger/10 text-danger' },
  REPORT_LOCATION: { icon: MapPinOff, cls: 'bg-warn/15 text-warn' },
  VILLAGES_UPDATED: { icon: MapPinned, cls: 'bg-primary/10 text-primary' },
};

/** Satu baris notifikasi (lonceng & halaman Notifikasi). */
export function NotificationItem({ n, onOpen, compact }: { n: AppNotification; onOpen: (n: AppNotification) => void; compact?: boolean }) {
  const meta = ICON[n.type] ?? { icon: Bell, cls: 'bg-bg text-muted' };
  const unread = !n.readAt;
  return (
    <button type="button" onClick={() => onOpen(n)}
      className={cn('flex w-full items-start gap-3 px-4 text-left transition hover:bg-bg', compact ? 'py-2.5' : 'py-3.5', unread && 'bg-primary-soft/35')}>
      <span className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full', meta.cls)}><meta.icon size={16} /></span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm leading-snug', unread ? 'font-semibold text-ink' : 'text-ink/85')}>{n.title}</span>
        {n.body && <span className={cn('mt-0.5 block text-xs text-muted', compact ? 'line-clamp-2' : 'line-clamp-3')}>{n.body}</span>}
        <span className="mt-1 block text-[11px] text-muted" title={tanggalJam(n.createdAt)}>{relatif(n.createdAt)}</span>
      </span>
      {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Belum dibaca" />}
    </button>
  );
}
