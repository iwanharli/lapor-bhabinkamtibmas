'use client';

import { Bell, ChevronRight, Flame, MapPinOff, MapPinned } from 'lucide-react';
import { cn } from '@/components/ui';
import { relatif, tanggalJam } from '@/lib/format';
import type { AppNotification } from './types';

/** Tampilan per jenis notifikasi (ikon, warna, label filter). */
export const TYPE_META = {
  REPORT_PRIORITY: { label: 'Prioritas', icon: Flame, cls: 'bg-danger/10 text-danger', dot: 'bg-danger', bar: 'bg-danger' },
  REPORT_LOCATION: { label: 'Lokasi', icon: MapPinOff, cls: 'bg-warn/15 text-warn', dot: 'bg-warn', bar: 'bg-warn' },
  VILLAGES_UPDATED: { label: 'Desa binaan', icon: MapPinned, cls: 'bg-primary/10 text-primary', dot: 'bg-primary', bar: 'bg-primary' },
} as const;

const jam = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

/** Satu notifikasi (lonceng & halaman Notifikasi). */
export function NotificationItem({ n, onOpen, compact }: { n: AppNotification; onOpen: (n: AppNotification) => void; compact?: boolean }) {
  const meta = TYPE_META[n.type as keyof typeof TYPE_META] ?? { label: 'Info', icon: Bell, cls: 'bg-bg text-muted', bar: 'bg-line' };
  const unread = !n.readAt;
  if (compact) {
    return (
      <button type="button" onClick={() => onOpen(n)} className={cn('flex w-full items-start gap-3 px-4 py-2.5 text-left transition hover:bg-bg', unread && 'bg-primary-soft/35')}>
        <span className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full', meta.cls)}><meta.icon size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-sm leading-snug', unread ? 'font-semibold text-ink' : 'text-ink/85')}>{n.title}</span>
          {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.body}</span>}
          <span className="mt-1 block text-[11px] text-muted" title={tanggalJam(n.createdAt)} suppressHydrationWarning>{relatif(n.createdAt)}</span>
        </span>
        {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Belum dibaca" />}
      </button>
    );
  }
  return (
    <button type="button" onClick={() => onOpen(n)}
      className={cn('group relative flex w-full items-start gap-3.5 px-4 py-4 text-left transition hover:bg-bg sm:px-5', unread && 'bg-primary-soft/25')}>
      {unread && <span className={cn('absolute inset-y-0 left-0 w-1', meta.bar)} />}
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', meta.cls)}><meta.icon size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', meta.cls)}>{meta.label}</span>
          <span className="text-xs text-muted" title={tanggalJam(n.createdAt)} suppressHydrationWarning>{jam(n.createdAt)} · {relatif(n.createdAt)}</span>
          {unread && <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/15" aria-label="Belum dibaca" />}
        </span>
        <span className={cn('mt-1.5 block leading-snug', unread ? 'font-semibold text-ink' : 'text-ink/85')}>{n.title}</span>
        {n.body && <span className="mt-1 line-clamp-2 block text-sm text-muted">{n.body}</span>}
      </span>
      {n.link && <ChevronRight size={18} className="mt-3 shrink-0 text-muted/60 transition group-hover:translate-x-0.5 group-hover:text-ink" />}
    </button>
  );
}
