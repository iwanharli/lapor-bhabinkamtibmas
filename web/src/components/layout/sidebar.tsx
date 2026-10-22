'use client';

import {
  Building2,
  ClipboardList,
  History,
  LayoutDashboard,
  Map,
  TrendingUp,
  LucideIcon,
  ShieldCheck,
  ShoppingBasket,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/components/ui';

/** Nama ikon dikirim dari Server Component sebagai string, dipetakan di sini. */
const ICONS = {
  dashboard: LayoutDashboard,
  reports: ClipboardList,
  prices: ShoppingBasket,
  users: Users,
  units: Building2,
  map: Map,
  performance: TrendingUp,
  audit: History,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

export function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary-2 to-primary text-white shadow-lg shadow-primary/30">
        <ShieldCheck size={22} />
      </span>
      {!collapsed && (
        <span className="leading-tight">
          <strong className="block text-[15px] text-white">Lapor Bhabinkamtibmas</strong>
          <small className="text-xs text-white/55">Pelaporan & harga pangan</small>
        </span>
      )}
    </Link>
  );
}

function NavLinks({ sections, collapsed, onNavigate }: { sections: NavSection[]; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-6">
      {sections.map((s) => (
        <div key={s.title}>
          {collapsed ? (
            <hr className="mx-3 mb-3 border-white/10" />
          ) : (
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">{s.title}</p>
          )}
          <ul className="flex flex-col gap-1.5">
            {s.items.map((it) => {
              const Icon = ICONS[it.icon];
              const active = isActive(pathname, it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    title={collapsed ? it.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3.5 rounded-xl border p-2 text-[15px] transition',
                      collapsed && 'justify-center',
                      active
                        ? 'border-white/15 bg-white/10 font-semibold text-white shadow-inner'
                        : 'border-transparent text-white/70 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    {active && <span className="absolute -left-4 top-2 bottom-2 w-1 rounded-r-full bg-accent" />}
                    <span
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition',
                        active
                          ? 'border-transparent bg-gradient-to-br from-primary-2 to-primary text-white shadow-md shadow-primary/30'
                          : 'border-white/10 bg-white/5 text-white/70 group-hover:text-white',
                      )}
                    >
                      <Icon size={18} strokeWidth={active ? 2.2 : 1.9} />
                    </span>
                    {!collapsed && it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const panelBg = 'bg-[radial-gradient(120%_60%_at_0%_100%,rgb(59_130_246/0.28),transparent_60%),linear-gradient(180deg,var(--navy),var(--navy-2))]';

/** Sidebar tetap di layar lebar. */
export function Sidebar({ sections, collapsed }: { sections: NavSection[]; collapsed: boolean }) {
  return (
    <aside className={cn('sticky top-0 hidden h-screen shrink-0 flex-col gap-6 overflow-y-auto px-4 py-5 transition-[width] md:flex', panelBg, collapsed ? 'w-20' : 'w-72')}>
      <div className={cn('px-1', collapsed && 'flex justify-center')}>
        <Brand collapsed={collapsed} />
      </div>
      <hr className="border-white/10" />
      <NavLinks sections={sections} collapsed={collapsed} />
      {!collapsed && <p className="mt-auto px-3 text-[11px] text-white/35">Baharkam Polri · v0.1</p>}
    </aside>
  );
}

/** Laci menu di layar kecil. */
export function MobileNav({ sections, open, onClose }: { sections: NavSection[]; open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <aside className={cn('absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col gap-6 overflow-y-auto p-5', panelBg)}>
        <div className="flex items-center justify-between">
          <Brand />
          <button onClick={onClose} aria-label="Tutup menu" className="rounded-lg p-2 text-white/70 hover:bg-white/10">
            <X size={22} />
          </button>
        </div>
        <hr className="border-white/10" />
        <NavLinks sections={sections} onNavigate={onClose} />
      </aside>
    </div>
  );
}
