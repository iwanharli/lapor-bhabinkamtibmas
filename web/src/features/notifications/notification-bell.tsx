'use client';

import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { NotificationItem } from './notification-item';
import type { AppNotification, NotificationPage } from './types';

/** Selang pembaruan jumlah belum dibaca (ms). */
const POLL_MS = 60_000;

/**
 * Lonceng notifikasi: angka belum dibaca (diperbarui berkala & saat tab aktif kembali) dan daftar ringkas.
 * `href` = halaman Notifikasi lengkap; `dark` untuk header berlatar gelap (tampilan Bhabin).
 */
export function NotificationBell({ href, dark }: { href: string; dark?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    callApi<{ unread: number }>('/notifications/unread-count').then((r) => setUnread(r.unread)).catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    const onFocus = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh, pathname]);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    callApi<NotificationPage>('/notifications?limit=8').then((r) => { setItems(r.data); setUnread(r.unread); }).catch(() => setItems([]));
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  async function openItem(n: AppNotification) {
    setOpen(false);
    if (!n.readAt) callApi<{ unread: number }>(`/notifications/${n.id}/read`, { method: 'POST' }).then((r) => setUnread(r.unread)).catch(() => undefined);
    if (n.link) router.push(n.link);
  }

  async function readAll() {
    await callApi('/notifications/read-all', { method: 'POST' });
    setUnread(0);
    setItems((list) => list?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null);
  }

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'}
        className={cn('relative grid h-10 w-10 place-items-center rounded-xl transition', dark ? 'text-white hover:bg-white/10' : 'text-muted hover:bg-bg hover:text-ink')}>
        <Bell size={20} className={cn(unread > 0 && 'origin-top animate-[bell_1.2s_ease-in-out_1]')} />
        {unread > 0 && (
          <span className={cn('absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold tabular-nums text-white ring-2', dark ? 'ring-[var(--navy)]' : 'ring-surface')}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Notifikasi {unread > 0 && <span className="ml-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">{unread} baru</span>}</p>
            {unread > 0 && (
              <button type="button" onClick={() => void readAll()} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><CheckCheck size={14} /> Tandai dibaca</button>
            )}
          </div>
          <div className="max-h-[min(26rem,60vh)] divide-y divide-line overflow-y-auto">
            {items === null ? (
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="mx-4 my-3 h-12 animate-pulse rounded-lg bg-bg" />)
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">Belum ada notifikasi.</p>
            ) : (
              items.map((n) => <NotificationItem key={n.id} n={n} onOpen={openItem} compact />)
            )}
          </div>
          <Link href={href} onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-bg">Lihat semua notifikasi</Link>
        </div>
      )}
    </div>
  );
}
