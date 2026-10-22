'use client';

import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Flame, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { relatif, tanggalJam } from '@/lib/format';
import type { MapPoint } from './categories';

/** Kecepatan gerak otomatis (px per detik) dan jeda setelah interaksi pengguna. */
const SPEED = 18;
const RESUME_MS = 4000;

/**
 * Strip horizontal laporan Deteksi Dini prioritas, selebar peta & menempel di tepi bawah: bisa digeser (jari/roda/tombol)
 * dan bergerak sendiri perlahan berulang. Berhenti saat disentuh/diarahkan; mati bila pengguna memilih kurangi gerakan.
 */
export function PriorityStrip({ items }: { items: MapPoint[] }) {
  const track = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const paused = useRef(false);
  const resumeAt = useRef(0);
  // Daftar digandakan agar gerak otomatis bisa berulang tanpa putus.
  const loop = items.length > 2;
  const rows = loop ? [...items, ...items] : items;

  const hold = (ms = RESUME_MS) => (resumeAt.current = performance.now() + ms);

  // Laporkan tinggi strip ke wadah peta (--strip-h) agar kontrol kiri bawah menempel di atasnya.
  useEffect(() => {
    const el = root.current;
    const host = el?.parentElement;
    if (!el || !host || typeof ResizeObserver === 'undefined') return;
    const set = () => host.style.setProperty('--strip-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      host.style.removeProperty('--strip-h');
    };
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el || !loop || collapsed || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last = performance.now();
    let carry = 0;
    const step = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      if (!paused.current && now >= resumeAt.current) {
        carry += (SPEED * dt) / 1000;
        const px = Math.floor(carry);
        if (px) {
          carry -= px;
          el.scrollLeft += px;
          const half = el.scrollWidth / 2;
          if (el.scrollLeft >= half) el.scrollLeft -= half;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [loop, collapsed, items]);

  const slide = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    hold();
    const card = el.querySelector('li')?.getBoundingClientRect().width ?? 280;
    if (loop && dir < 0 && el.scrollLeft < card) el.scrollLeft += el.scrollWidth / 2;
    el.scrollBy({ left: dir * (card + 12), behavior: 'smooth' });
  };

  return (
    <aside
      ref={root}
      aria-label="Deteksi dini prioritas"
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-[500] overflow-hidden border-t border-line/80 bg-surface/90 shadow-[0_-10px_30px_-20px_rgba(15,35,65,.45)] backdrop-blur-xl"
    >
      <header className="flex items-center justify-between gap-3 px-3 py-2 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger">
            <Flame size={16} />
            {items.length > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-danger/60" />}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-ink">Deteksi dini prioritas</h2>
            <p className="truncate text-[11px] text-muted">Urgensi tinggi · titik bercincin merah di peta</p>
          </div>
          <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-danger">{items.length}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!collapsed && items.length > 1 && (
            <>
              <button type="button" aria-label="Sebelumnya" onClick={() => slide(-1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-bg hover:text-ink"><ChevronLeft size={17} /></button>
              <button type="button" aria-label="Berikutnya" onClick={() => slide(1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-bg hover:text-ink"><ChevronRight size={17} /></button>
            </>
          )}
          <button type="button" aria-label={collapsed ? 'Buka daftar prioritas' : 'Ciutkan daftar prioritas'} aria-expanded={!collapsed} onClick={() => setCollapsed((v) => !v)} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-bg hover:text-danger">
            {collapsed ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>
        </div>
      </header>

      {!collapsed && (items.length === 0 ? (
        <div className="flex items-center gap-3 border-t border-line px-4 py-3.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success-soft text-success"><Check size={16} /></span>
          <p className="text-sm text-muted">Tidak ada laporan prioritas pada periode & wilayah ini.</p>
        </div>
      ) : (
        <div
          ref={track}
          onMouseEnter={() => (paused.current = true)}
          onMouseLeave={() => { paused.current = false; hold(800); }}
          onPointerDown={() => hold()}
          onWheel={() => hold()}
          onTouchStart={() => hold()}
          onFocus={() => (paused.current = true)}
          onBlur={() => (paused.current = false)}
          className="overflow-x-auto border-t border-line [mask-image:linear-gradient(90deg,transparent,#000_24px,#000_calc(100%_-_24px),transparent)] [scrollbar-width:none]"
        >
          <ul className="flex w-max gap-3 px-3 pb-3 pt-2.5 sm:px-5">
            {rows.map((p, i) => (
              <li key={`${p.id}-${i}`} className="w-[17rem] shrink-0" aria-hidden={i >= items.length || undefined}>
                <Link
                  href={`/laporan/${p.id}`}
                  tabIndex={i >= items.length ? -1 : undefined}
                  className="group block h-full rounded-xl border border-danger/15 bg-gradient-to-br from-danger/[0.06] to-transparent p-3 transition hover:border-danger/40 hover:bg-danger/[0.08]"
                >
                  <span className="flex items-center justify-between gap-2 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide text-danger">
                      <span className="h-1.5 w-1.5 rounded-full bg-danger" /> Urgensi tinggi
                    </span>
                    <span title={tanggalJam(p.occurred_at, p.timezone)}>{relatif(p.occurred_at, p.timezone)}</span>
                  </span>
                  <span className="mt-1.5 flex items-center gap-1.5 truncate text-sm font-semibold text-ink group-hover:text-danger">
                    <MapPin size={14} className="shrink-0 text-danger" /> {p.desa}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{p.bhabin}</span>
                  <span className={cn('mt-2 block truncate font-mono text-[10px] text-muted', p.flagged && 'text-warn')}>
                    {p.nomor}{p.flagged ? ' · lokasi perlu dicek' : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}
