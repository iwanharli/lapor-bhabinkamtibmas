'use client';

import { BellOff, CheckCheck, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { NotificationItem, TYPE_META } from './notification-item';
import type { AppNotification, NotificationPage } from './types';

const LIMIT = 20;
type Filter = 'all' | 'unread' | keyof typeof TYPE_META;

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
function dayLabel(key: string) {
  const today = new Date().toLocaleDateString('en-CA');
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA');
  if (key === today) return 'Hari ini';
  if (key === yesterday) return 'Kemarin';
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }) });
}

/** Daftar notifikasi lengkap (dashboard & tampilan Bhabin): filter jenis, dikelompokkan per hari, muat otomatis saat digulir. */
export function NotificationList() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [byType, setByType] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(async (p: number, f: Filter, append: boolean) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: String(LIMIT), page: String(p) });
      if (f === 'unread') q.set('unread', 'true');
      else if (f !== 'all') q.set('type', f);
      const r = await callApi<NotificationPage>(`/notifications?${q}`);
      setItems((list) => (append ? [...list, ...r.data.filter((n) => !list.some((x) => x.id === n.id))] : r.data));
      setTotal(r.meta.total);
      setUnread(r.unread);
      setByType(r.byType ?? {});
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(1, filter, false); }, [filter, load]);

  const more = !loading && items.length < total;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && void load(page + 1, filter, true), { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [more, page, filter, load]);

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
    if (filter === 'unread') setItems([]);
    else setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
    router.refresh();
  }

  const chips: { key: Filter; label: string; count?: number; dot?: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'unread', label: 'Belum dibaca', count: unread, dot: 'bg-primary' },
    ...(Object.entries(TYPE_META) as [keyof typeof TYPE_META, (typeof TYPE_META)[keyof typeof TYPE_META]][])
      .filter(([k]) => byType[k])
      .map(([k, m]) => ({ key: k as Filter, label: m.label, count: byType[k], dot: m.dot })),
  ];

  const groups: { key: string; items: AppNotification[] }[] = [];
  for (const n of items) {
    const k = dayKey(n.createdAt);
    const g = groups.at(-1);
    if (g?.key === k) g.items.push(n);
    else groups.push({ key: k, items: [n] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
          {chips.map((c) => {
            const on = filter === c.key;
            return (
              <button key={c.key} type="button" onClick={() => setFilter(c.key)} aria-pressed={on}
                className={cn('inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
                  on ? 'border-transparent bg-primary text-white shadow-sm' : 'border-line bg-surface text-muted hover:text-ink')}>
                {!on && c.dot && <span className={cn('h-2 w-2 rounded-full', c.dot)} />}
                {c.label}
                {!!c.count && <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', on ? 'bg-white/20' : 'bg-bg')}>{c.count.toLocaleString('id-ID')}</span>}
              </button>
            );
          })}
        </div>
        {unread > 0 && (
          <button type="button" onClick={() => void readAll()} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-soft">
            <CheckCheck size={16} /> Tandai semua dibaca
          </button>
        )}
      </div>

      {items.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface px-4 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-bg text-muted"><BellOff size={24} /></span>
          <p className="font-semibold">{filter === 'unread' ? 'Semua sudah dibaca' : 'Belum ada notifikasi'}</p>
          <p className="max-w-xs text-sm text-muted">{filter === 'unread' ? 'Tidak ada pemberitahuan baru untuk Anda.' : 'Pemberitahuan penting akan muncul di sini.'}</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {dayLabel(g.key)}<span className="h-px flex-1 bg-line" />
            </h2>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm divide-y divide-line/70">
              {g.items.map((n) => <NotificationItem key={n.id} n={n} onOpen={open} />)}
            </div>
          </section>
        ))
      )}

      <div ref={sentinel} className="flex justify-center py-1 text-sm text-muted">
        {loading && <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Memuat…</span>}
      </div>
    </div>
  );
}
