'use client';

import {
  CalendarCheck,
  Layers,
  CalendarRange,
  HeartPulse,
  Bell,
  Building2,
  ChevronDown,
  ClipboardList,
  History,
  KeyRound,
  LayoutDashboard,
  Map,
  MapPinned,
  Navigation,
  TrendingUp,
  LucideIcon,
  ShoppingBasket,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/components/ui';
import { Logo } from '@/components/brand/logo';
import { useEffect, useRef, useState } from 'react';

/** Nama ikon dikirim dari Server Component sebagai string, dipetakan di sini. */
const ICONS = {
  dashboard: LayoutDashboard,
  notifications: Bell,
  reports: ClipboardList,
  prices: ShoppingBasket,
  users: Users,
  units: Building2,
  integration: KeyRound,
  map: Map,
  performance: TrendingUp,
  audit: History,
  villages: MapPinned,
  attendance: CalendarCheck,
  family: HeartPulse,
  monthly: CalendarRange,
  stuntingMap: Layers,
  tracking: Navigation,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  children?: { href: string; label: string }[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Warna tiap kelompok menu, dipakai lewat variabel --nav. */
const SECTION_COLOR: Record<string, string> = {
  Beranda: '#5cc8f2', 'Data Laporan': '#f5c400', Peta: '#34d399', Personel: '#c084fc', Administrasi: '#ff6b73', Menu: '#5cc8f2',
};

/** Ikon menu berwarna kelompoknya; menu aktif berlatar penuh. */
function NavIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg transition', active ? 'bg-[var(--nav)] text-[#0b1a33] shadow-md' : 'bg-[color-mix(in_srgb,var(--nav)_16%,transparent)] text-[var(--nav)] group-hover:bg-[color-mix(in_srgb,var(--nav)_28%,transparent)]')}>
      <Icon size={18} strokeWidth={active ? 2.4 : 2} />
    </span>
  );
}

const activeBar = 'absolute top-2 bottom-2 w-1 rounded-r-full bg-[var(--nav)]';

/** Aktif bila path sama atau di bawahnya per segmen: /laporan cocok untuk /laporan/123, tidak untuk /laporan-bulanan. */
export const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));

export function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <Logo size={collapsed ? 38 : 44} />
      {!collapsed && (
        <span className="leading-tight">
          <strong className="block text-[15px] text-white">Lapor Bhabinkamtibmas</strong>
          <small className="text-xs text-white/55">Pelaporan & harga pangan</small>
        </span>
      )}
    </Link>
  );
}

/**
 * Submenu saat sidebar diciutkan: panel melayang di samping ikon. Memakai posisi fixed agar tidak terpotong area gulir sidebar;
 * tutup dengan klik di luar, Esc, menggulir sidebar, atau setelah memilih menu.
 */
function CollapsedMenu({ item, active, isChildActive }: { item: NavItem; active: boolean; isChildActive: (href: string) => boolean }) {
  const Icon = ICONS[item.icon];
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    const aside = box.current?.closest('aside');
    aside?.addEventListener('scroll', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      aside?.removeEventListener('scroll', close);
    };
  }, [pos]);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    if (pos) return setPos(null);
    const r = e.currentTarget.getBoundingClientRect();
    // Jaga panel tetap di dalam layar bila ikonnya di bagian bawah.
    setPos({ top: Math.max(8, Math.min(r.top, window.innerHeight - 48 - 38 * (item.children?.length ?? 0))), left: r.right + 14 });
  }

  return (
    <div ref={box}>
      <button type="button" onClick={toggle} title={item.label} aria-label={`Buka menu ${item.label}`} aria-haspopup="menu" aria-expanded={!!pos}
        className={cn('group relative flex w-full items-center justify-center rounded-xl p-1 transition', active && 'bg-white/10')}>
        {active && <span className={cn(activeBar, '-left-3')} />}
        <NavIcon icon={Icon} active={active} />
      </button>
      {pos && (
        <div role="menu" aria-label={item.label} style={pos} className="fixed z-[1000] max-h-[calc(100dvh-1rem)] w-60 overflow-y-auto rounded-xl border border-white/15 border-l-[3px] border-l-[var(--nav)] bg-[var(--navy)] p-2 shadow-2xl">
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nav)]">{item.label}</p>
          {item.children?.map((child) => (
            <Link key={child.href} href={child.href} role="menuitem" onClick={() => setPos(null)} aria-current={isChildActive(child.href) ? 'page' : undefined}
              className={cn('block rounded-lg px-3 py-2 text-sm transition', isChildActive(child.href) ? 'bg-white/10 font-semibold text-white' : 'text-white/75 hover:bg-white/5 hover:text-white')}>
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NavLinks({ sections, collapsed, onNavigate }: { sections: NavSection[]; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isChildActive = (href: string) => {
    const [childPath, childQuery] = href.split('?');
    return pathname === childPath && searchParams.get('category') === new URLSearchParams(childQuery).get('category');
  };
  return (
    <nav className={cn('flex flex-col', collapsed ? 'gap-4' : 'gap-6')}>
      {sections.map((s) => (
        <div key={s.title} style={{ '--nav': SECTION_COLOR[s.title] ?? '#60a5fa' } as React.CSSProperties}>
          {collapsed ? (
            <span aria-hidden className="mx-auto mb-2 block h-[3px] w-5 rounded-full bg-[var(--nav)] opacity-70" />
          ) : (
            <p className="mb-2 flex items-center gap-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--nav)]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--nav)]" />{s.title}
            </p>
          )}
          <ul className={cn('flex flex-col', collapsed ? 'gap-1' : 'gap-1.5')}>
            {s.items.map((it) => {
              const Icon = ICONS[it.icon];
              const active = isActive(pathname, it.href);
              const open = expanded[it.href] ?? false;
              return (
                <li key={it.href}>
                  {it.children?.length && collapsed ? (
                    <CollapsedMenu item={it} active={active} isChildActive={isChildActive} />
                  ) : it.children?.length ? (
                    <button type="button" aria-expanded={open} aria-label={`${open ? 'Tutup' : 'Buka'} kategori ${it.label}`}
                      onClick={() => setExpanded((prev) => ({ ...prev, [it.href]: !open }))}
                      className={cn(
                        'group relative flex w-full min-w-0 items-center gap-3.5 rounded-xl border p-2 text-left text-[15px] transition',
                        active ? 'border-white/15 bg-white/10 font-semibold text-white shadow-inner' : 'border-transparent text-white/70 hover:bg-white/5 hover:text-white',
                      )}>
                      {active && <span className={cn(activeBar, '-left-4')} />}
                      <NavIcon icon={Icon} active={active} />
                      <span className="min-w-0 flex-1 truncate">{it.label}</span>
                      <ChevronDown size={17} className={cn('shrink-0 text-white/65 transition-transform', open && 'rotate-180')} />
                    </button>
                  ) : (
                    <Link href={it.href} onClick={onNavigate} title={collapsed ? it.label : undefined} aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex min-w-0 items-center gap-3.5 rounded-xl text-[15px] transition',
                        collapsed ? 'justify-center p-1' : 'border p-2',
                        collapsed ? active && 'bg-white/10' : active ? 'border-white/15 bg-white/10 font-semibold text-white shadow-inner' : 'border-transparent text-white/70 hover:bg-white/5 hover:text-white',
                      )}>
                      {active && <span className={cn(activeBar, collapsed ? '-left-3' : '-left-4')} />}
                      <NavIcon icon={Icon} active={active} />
                      {!collapsed && <span className="truncate">{it.label}</span>}
                    </Link>
                  )}
                  {it.children?.length && !collapsed && open ? (
                    <ul className="ml-7 mt-2 space-y-1 border-l-2 border-[color-mix(in_srgb,var(--nav)_45%,transparent)] pl-3">
                      {it.children.map((child) => {
                        const childActive = isChildActive(child.href);
                        return (
                          <li key={child.href}>
                            <Link href={child.href} onClick={onNavigate} aria-current={childActive ? 'page' : undefined}
                              className={cn('block rounded-lg px-3 py-2.5 text-sm leading-5 transition', childActive ? 'bg-white/10 font-semibold text-white shadow-inner' : 'text-white/70 hover:bg-white/5 hover:text-white')}>
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const panelBg = 'bg-[radial-gradient(120%_60%_at_0%_100%,rgb(18_80_180/0.35),transparent_60%),linear-gradient(180deg,var(--navy),var(--navy-2))]';

/** Sidebar tetap di layar lebar. */
export function Sidebar({ sections, collapsed }: { sections: NavSection[]; collapsed: boolean }) {
  return (
    <aside className={cn('sidebar-scrollbar sticky top-0 z-40 hidden h-screen shrink-0 flex-col overflow-y-auto py-5 transition-[width] md:flex', panelBg, collapsed ? 'w-[72px] gap-4 px-3 [scrollbar-gutter:auto] [scrollbar-width:none]' : 'w-72 gap-6 px-4')}>
      <div className={cn(collapsed ? 'flex justify-center' : 'px-1')}>
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
      <aside className={cn('sidebar-scrollbar absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col gap-6 overflow-y-auto p-5', panelBg)}>
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
