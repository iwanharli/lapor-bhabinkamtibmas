import { Building2, MapPinned, Shield, Users } from 'lucide-react';
import { cn } from '@/components/ui';
import type { UnitOption } from '@/lib/types';
import { flattenTree } from '@/lib/units';
import { AddUnitButton } from './add-unit-button';

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

/** Pohon unit dengan garis penghubung, jumlah personel/desa, dan aksi tambah turunan. */
export function UnitTree({ units }: { units: UnitOption[] }) {
  const flat = flattenTree(units);
  return (
    <ul>
      {flat.map((u, i) => {
        const lv = LEVEL[u.level] ?? LEVEL.POLSEK;
        const isLastSibling = !flat.slice(i + 1).some((x) => x.parentId === u.parentId && x.depth === u.depth);
        return (
          <li key={u.id} className="group relative border-b border-line last:border-0 hover:bg-bg/60">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 pr-4" style={{ paddingLeft: 20 + u.depth * 32 }}>
              {u.depth > 0 && (
                <>
                  {/* garis penghubung ke induk */}
                  <span className={cn('absolute w-px bg-line', isLastSibling ? 'top-0 h-1/2' : 'inset-y-0')} style={{ left: 20 + (u.depth - 1) * 32 + 15 }} />
                  <span className="absolute top-1/2 h-px w-4 bg-line" style={{ left: 20 + (u.depth - 1) * 32 + 15 }} />
                </>
              )}
              <span className={cn('relative grid h-8 w-8 shrink-0 place-items-center rounded-lg', lv.cls)}>
                <lv.icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {u.nama}
                  <span className="rounded bg-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">{lv.label}</span>
                </p>
                <p className="font-mono text-xs text-muted">{u.kode}</p>
              </div>
              {u.counts && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <Count icon={<Users size={14} />} n={u.counts.users} label="personel" />
                  {u.level === 'POLSEK' && (
                    <>
                      <Count icon={<Shield size={14} />} n={u.counts.bhabin} label="Bhabin" />
                      <Count icon={<MapPinned size={14} />} n={u.counts.villages} label="desa" />
                    </>
                  )}
                </div>
              )}
              {u.level !== 'POLSEK' && (
                <div className="opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                  <AddUnitButton units={units} parentId={u.id} compact />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
