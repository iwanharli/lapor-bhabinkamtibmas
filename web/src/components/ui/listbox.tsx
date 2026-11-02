'use client';

import { Check, ChevronDown, Search, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from './cn';

export interface ListboxOption { value: string; label: string }

/** Daftar panjang (mis. desa) diberi kotak cari. */
const SEARCH_FROM = 10;

/**
 * Dropdown filter bergaya sama dengan pemilih satuan. Daftar memakai posisi fixed agar tidak terpotong kartu/area gulir.
 * `compact`: tanpa bingkai, untuk dipakai berderet di dalam satu pil (filter wilayah).
 */
export function Listbox({ label, value, options, onChange, icon: Icon, disabled, pending, compact, className }: {
  label: string; value: string; options: ListboxOption[]; onChange: (value: string) => void; icon?: LucideIcon; disabled?: boolean; pending?: boolean; compact?: boolean; className?: string;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [cursor, setCursor] = useState(0);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => (needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options), [options, needle]);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) close(); };
    // Hanya gulir yang menggeser posisi dropdown; animasi gulir di bagian lain (strip prioritas peta) tidak menutupnya.
    const onScroll = (e: Event) => { if ((e.target as Node).contains?.(box.current)) close(); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  function show() {
    const r = box.current!.getBoundingClientRect();
    setQ('');
    setCursor(Math.max(options.indexOf(current), 0));
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }

  function pick(v: string) {
    setPos(null);
    if (v !== value) onChange(v);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!pos) {
      if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); show(); }
      return;
    }
    if (e.key === 'Escape') setPos(null);
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && shown[cursor]) { e.preventDefault(); pick(shown[cursor].value); }
  }

  const active = !!value;
  return (
    <div ref={box} className={cn('relative text-ink', className)} onKeyDown={onKey}>
      <button type="button" role="combobox" aria-label={label} aria-expanded={!!pos} aria-haspopup="listbox" data-value={value} disabled={disabled} onClick={() => (pos ? setPos(null) : show())}
        className={cn('flex w-full items-center gap-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-45',
          compact ? cn('h-7 rounded-lg px-2.5 text-xs', active ? 'bg-surface font-semibold shadow-sm ring-1 ring-line/60' : 'text-muted hover:bg-surface') : 'h-10 rounded-lg border border-line bg-surface px-3 text-sm',
          pending && 'opacity-70')}>
        {Icon && <Icon size={15} className="shrink-0 text-muted" />}
        <span className={cn('min-w-0 flex-1 truncate', compact && 'max-w-[9.5rem]')}>{current?.label}</span>
        <ChevronDown size={compact ? 13 : 15} className={cn('shrink-0 text-muted transition-transform', pos && 'rotate-180')} />
      </button>
      {pos && (
        <div ref={list} style={{ top: pos.top, left: pos.left, minWidth: Math.max(pos.width, compact ? 220 : 0) }} className="fixed z-[1000] flex max-h-80 max-w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-line bg-surface text-sm text-ink shadow-lg">
          {options.length > SEARCH_FROM && (
            <label className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
              <Search size={14} className="text-muted" />
              <input autoFocus aria-label={`Cari ${label}`} value={q} onChange={(e) => { setQ(e.target.value); setCursor(0); }} placeholder="Cari…" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70" />
            </label>
          )}
          <ul role="listbox" aria-label={label} className="min-h-0 flex-1 overflow-auto p-1">
            {shown.map((o, i) => (
              <li key={o.value} role="option" aria-selected={o.value === current?.value} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o.value)} onMouseEnter={() => setCursor(i)}
                className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2', i === cursor && 'bg-primary-soft', o.value === current?.value && 'font-semibold')}>
                <span className="flex-1">{o.label}</span>
                {o.value === current?.value && <Check size={14} className="shrink-0 text-primary" />}
              </li>
            ))}
            {!shown.length && <li className="px-3 py-3 text-center text-xs text-muted">Tidak ditemukan</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
