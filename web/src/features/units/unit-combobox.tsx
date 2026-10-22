'use client';

import { Building2, ChevronDown, Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { cn } from '@/components/ui';
import { callApi } from '@/lib/api/client';

export interface UnitHit {
  id: string;
  parentId: string | null;
  level: string;
  kode: string;
  nama: string;
  timezone: string;
  /** Rantai nama induk, mis. "Polda X › Polres Y". */
  path: string;
}

const LEVEL_LABEL: Record<string, string> = { MABES: 'Mabes', POLDA: 'Polda', POLRES: 'Polres', POLSEK: 'Polsek' };

/**
 * Kolom pencarian unit (autocomplete ke /units/search) pengganti <select> berisi semua unit,
 * agar tetap ringan untuk ±5.500 unit nasional. `levels` membatasi jenis unit yang bisa dipilih.
 */
export function UnitCombobox({
  id,
  value,
  onChange,
  levels,
  placeholder = 'Cari unit…',
  emptyLabel,
  className,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (id: string, unit: UnitHit | null) => void;
  levels?: string[];
  placeholder?: string;
  /** Bila diisi, tampil opsi kosong (mis. "Semua unit"). */
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<UnitHit[]>([]);
  const [selected, setSelected] = useState<UnitHit | null>(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  // Posisi daftar mengikuti kolom (fixed) agar tidak terpotong wadah ber-scroll seperti modal.
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const level = levels?.join(',');

  // Label nilai terpilih.
  useEffect(() => {
    if (!value) return setSelected(null);
    if (selected?.id === value) return;
    callApi<UnitHit[]>(`/units/search?ids=${value}`).then((r) => setSelected(r[0] ?? null)).catch(() => undefined);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hasil pencarian (debounce).
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({ limit: '20' });
      if (q.trim()) params.set('q', q.trim());
      if (level) params.set('level', level);
      callApi<UnitHit[]>(`/units/search?${params}`)
        .then((r) => {
          setHits(r);
          setActive(0);
        })
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, level]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = box.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const options: (UnitHit | null)[] = emptyLabel && !q ? [null, ...hits] : hits;
  const pick = (u: UnitHit | null) => {
    setSelected(u);
    onChange(u?.id ?? '', u);
    setOpen(false);
    setQ('');
  };

  return (
    <div ref={box} className={cn('relative', className)}>
      <div
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
          disabled && 'opacity-60',
        )}
      >
        {open ? <Search size={15} className="shrink-0 text-muted" /> : <Building2 size={15} className="shrink-0 text-muted" />}
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70"
          placeholder={selected ? selected.nama : value ? 'Memuat…' : (emptyLabel ?? placeholder)}
          value={open ? q : (selected?.nama ?? '')}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, options.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter' && open && options.length) { e.preventDefault(); pick(options[active]); }
            else if (e.key === 'Escape') setOpen(false);
          }}
        />
        {value && emptyLabel && !disabled ? (
          <button type="button" aria-label="Kosongkan" className="text-muted hover:text-ink" onClick={() => pick(null)}>
            <X size={15} />
          </button>
        ) : (
          <ChevronDown size={15} className="shrink-0 text-muted" />
        )}
      </div>
      {open && pos && (
        <ul
          id={listId}
          role="listbox"
          style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 256) }}
          className="fixed z-50 max-h-72 overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg"
        >
          {options.map((u, i) => (
            <li
              key={u?.id ?? 'empty'}
              role="option"
              aria-selected={(u?.id ?? '') === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(u)}
              onMouseEnter={() => setActive(i)}
              className={cn('cursor-pointer rounded-lg px-3 py-2 text-sm', i === active && 'bg-primary-soft', (u?.id ?? '') === value && 'font-semibold')}
            >
              {u ? (
                <>
                  <span className="flex items-center gap-2">
                    {u.nama}
                    <span className="rounded bg-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">{LEVEL_LABEL[u.level] ?? u.level}</span>
                  </span>
                  {u.path && <span className="block truncate text-xs text-muted">{u.path}</span>}
                </>
              ) : (
                emptyLabel
              )}
            </li>
          ))}
          {!options.length && <li className="px-3 py-3 text-center text-sm text-muted">{loading ? 'Mencari…' : 'Unit tidak ditemukan'}</li>}
        </ul>
      )}
    </div>
  );
}

/** UnitCombobox yang menulis ke parameter URL (filter halaman; halaman kembali ke 1). */
export function UrlUnitFilter({ param = 'unitId', levels, emptyLabel = 'Semua unit', className }: { param?: string; levels?: string[]; emptyLabel?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <UnitCombobox
      className={cn('w-full sm:w-64', pending && 'opacity-70', className)}
      value={params.get(param) ?? ''}
      levels={levels}
      emptyLabel={emptyLabel}
      onChange={(id) => {
        const next = new URLSearchParams(params.toString());
        if (id) next.set(param, id);
        else next.delete(param);
        next.delete('page');
        start(() => router.push(next.size ? `${pathname}?${next}` : pathname));
      }}
    />
  );
}
