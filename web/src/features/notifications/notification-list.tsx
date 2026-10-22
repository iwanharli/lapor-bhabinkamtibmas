'use client';

import { BellOff, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button, cn } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { NotificationItem } from './notification-item';
import type { AppNotification, NotificationPage } from './types';

const LIMIT = 20;

/** Daftar notifikasi lengkap (dashboard & tampilan Bhabin): Semua / Belum dibaca, muat lagi, tandai semua dibaca. */
export function NotificationList() {
  const router = useRouter();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [items, setItems] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number, t: 'all' | 'unread', append: boolean) => {
    setLoading(true);
    try {
      const r = await callApi<NotificationPage>(`/notifications?limit=${LIMIT}&page=${p}${t === 'unread' ? '&unread=true' : ''}`);
      setItems((list) => (append ? [...list, ...r.data] : r.data));
      setTotal(r.meta.total);
      setUnread(r.unread);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(1, tab, false); }, [tab, load]);

  function open(n: AppNotification) {
    if (!n.readAt) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(u - 1, 0));
      void callApi(`/notifications/${n.id}/read`, { method: 'POST' });
    }
    if (n.link) router.push(n.link);
  }

  async function readAll() {
    await callApi('/notifications/read-all', { method: 'POST' });
    if (tab === 'unread') setItems([]);
    else setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <nav className="flex rounded-xl bg-bg p-1 ring-1 ring-line/60">
          {([['all', 'Semua'], ['unread', 'Belum dibaca']] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k}
              className={cn('rounded-lg px-3.5 py-1.5 text-sm font-medium transition', tab === k ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-ink')}>
              {label}{k === 'unread' && unread > 0 && <span className="ml-1.5 rounded-full bg-danger px-1.5 text-[11px] text-white">{unread}</span>}
            </button>
          ))}
        </nav>
        {unread > 0 && <Button variant="secondary" size="sm" icon={<CheckCheck size={15} />} onClick={() => void readAll()}>Tandai semua dibaca</Button>}
      </div>
      {items.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-2 px-4 py-14 text-center text-muted">
          <BellOff size={26} />
          <p className="text-sm">{tab === 'unread' ? 'Semua notifikasi sudah dibaca.' : 'Belum ada notifikasi.'}</p>
        </div>
      ) : (
        <div className="divide-y divide-line">{items.map((n) => <NotificationItem key={n.id} n={n} onOpen={open} />)}</div>
      )}
      {loading && <div className="px-4 py-3 text-center text-sm text-muted">Memuat…</div>}
      {!loading && items.length < total && (
        <button type="button" onClick={() => void load(page + 1, tab, true)} className="block w-full border-t border-line py-3 text-sm font-medium text-primary hover:bg-bg">
          Muat lagi ({(total - items.length).toLocaleString('id-ID')})
        </button>
      )}
    </div>
  );
}
