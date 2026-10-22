'use client';

import { Building2, ChevronRight, Loader2, MapPinned, Shield, Users } from 'lucide-react';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { cn } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import type { UnitNode } from '@/lib/types';
import { AddUnitButton } from './add-unit-button';
import { TimezoneButton } from './timezone-button';

const LEVEL: Record<string, { label: string; cls: string; icon: typeof Shield }> = {
  MABES: { label: 'Mabes', cls: 'bg-navy text-accent', icon: Shield },
  POLDA: { label: 'Polda', cls: 'bg-primary text-white', icon: Shield },
  POLRES: { label: 'Polres', cls: 'bg-primary-soft text-primary', icon: Building2 },
  POLSEK: { label: 'Polsek', cls: 'bg-accent/15 text-accent-ink', icon: Building2 },
};

function Count({ icon, n, label }: { icon: React.ReactNode; n: number; label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', n ? 'text-ink' : 'text-muted/60')} title={label}>
      <span className="text-muted">{icon}</span>
      <strong className="tabular-nums">{n}</strong> <span className="text-muted">{label}</span>
    </span>
  );
}

/**
 * Pohon unit yang dimuat bertahap: akar dari server, anak diambil saat cabang dibuka
 * (/units/children) — tetap ringan untuk ±5.500 unit nasional.
 */
export function UnitTree({ roots, editable = true }: { roots: UnitNode[]; editable?: boolean }) {
  const [children, setChildren] = useState<Record<string, UnitNode[]>>({});
  const [open, setOpen] = useState<Set<string>>(() => new Set(roots.map((r) => r.id)));
  const [loading, setLoading] = useState<Set<string>>(new Set());

  const load = useCallback(async (id: string) => {
    setLoading((s) => new Set(s).add(id));
    try {
      const rows = await callApi<UnitNode[]>(`/units/children?parentId=${id}`);
      setChildren((c) => ({ ...c, [id]: rows }));
    } finally {
      setLoading((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }, []);

  // Muat ulang cabang yang terbuka setiap kali data server diperbarui (router.refresh setelah tambah/ubah).
  useEffect(() => {
    open.forEach((id) => void load(id));
  }, [roots]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (u: UnitNode) => {
    const next = new Set(open);
    if (next.has(u.id)) next.delete(u.id);
    else {
      next.add(u.id);
      if (!children[u.id]) void load(u.id);
    }
    setOpen(next);
  };

  const rows = (list: UnitNode[], depth: number): React.ReactNode =>
    list.map((u, i) => {
      const lv = LEVEL[u.level] ?? LEVEL.POLSEK;
      const isOpen = open.has(u.id);
      const isLastSibling = i === list.length - 1;
      return (
        <Fragment key={u.id}>
          <li className="group relative border-b border-line last:border-0 hover:bg-bg/60">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 pr-4" style={{ paddingLeft: 12 + depth * 32 }}>
              {depth > 0 && (
                <>
                  {/* garis penghubung ke induk */}
                  <span className={cn('absolute w-px bg-line', isLastSibling && !isOpen ? 'top-0 h-1/2' : 'inset-y-0')} style={{ left: 12 + (depth - 1) * 32 + 23 }} />
                  <span className="absolute top-1/2 h-px w-3 bg-line" style={{ left: 12 + (depth - 1) * 32 + 23 }} />
                </>
              )}
              <button
                type="button"
                aria-label={isOpen ? `Tutup ${u.nama}` : `Buka ${u.nama}`}
                aria-expanded={isOpen}
                disabled={!u.childCount}
                onClick={() => toggle(u)}
                className={cn('relative grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-line/60 hover:text-ink', !u.childCount && 'invisible')}
              >
                {loading.has(u.id) ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={15} className={cn('transition', isOpen && 'rotate-90')} />}
              </button>
              <span className={cn('relative -ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg', lv.cls)}>
                <lv.icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  {u.nama}
                  <span className="rounded bg-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">{lv.label}</span>
                  <TimezoneButton unitId={u.id} unitName={u.nama} timezone={u.timezone} editable={editable} />
                  {u.childCount > 0 && <span className="text-xs text-muted">{u.childCount} unit turunan</span>}
                </div>
                <p className="font-mono text-xs text-muted">{u.kode}</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Count icon={<Users size={14} />} n={u.counts.users} label="personel" />
                {u.level === 'POLSEK' && (
                  <>
                    <Count icon={<Shield size={14} />} n={u.counts.bhabin} label="Bhabin" />
                    <Count icon={<MapPinned size={14} />} n={u.counts.villages} label="desa" />
                  </>
                )}
              </div>
              {u.level !== 'POLSEK' && editable && (
                <div className="opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                  <AddUnitButton parent={{ id: u.id, level: u.level, timezone: u.timezone }} compact />
                </div>
              )}
            </div>
          </li>
          {isOpen && children[u.id] && rows(children[u.id], depth + 1)}
        </Fragment>
      );
    });

  return <ul>{rows(roots, 0)}</ul>;
}
