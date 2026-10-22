'use client';

import { ChevronDown, LogOut, Menu, PanelLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { isActive, NavSection } from './sidebar';

export interface ShellUser {
  nama: string;
  role: string;
  unit: string;
}

const initials = (nama: string) =>
  nama.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/** Breadcrumb dari konfigurasi menu: "Operasional / Laporan / Detail". */
function useCrumbs(sections: NavSection[]) {
  const pathname = usePathname();
  for (const s of sections) {
    const item = [...s.items].sort((a, b) => b.href.length - a.href.length).find((it) => isActive(pathname, it.href));
    if (item) {
      const crumbs = [{ label: s.title }, { label: item.label, href: item.href }];
      if (pathname !== item.href) crumbs.push({ label: pathname.endsWith('/baru') ? 'Tambah' : pathname.endsWith('/impor') ? 'Impor' : 'Detail' });
      return crumbs;
    }
  }
  return [{ label: 'Dashboard' }];
}

function UserMenu({ user }: { user: ShellUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-bg">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-bold text-white">{initials(user.nama)}</span>
        <span className="hidden text-left leading-tight sm:block">
          <strong className="block max-w-[180px] truncate text-sm">{user.nama}</strong>
          <span className="text-xs text-muted">{user.role}</span>
        </span>
        <ChevronDown size={16} className="text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <div className="border-b border-line px-4 py-3 text-sm">
            <strong className="block">{user.nama}</strong>
            <span className="text-xs text-muted">{user.role} · {user.unit}</span>
          </div>
          <button onClick={logout} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger-soft">
            <LogOut size={16} /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}

export function Topbar({ sections, user, onToggleSidebar, onOpenMobile }: { sections: NavSection[]; user: ShellUser; onToggleSidebar: () => void; onOpenMobile: () => void }) {
  const crumbs = useCrumbs(sections);
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-line bg-surface/80 px-4 backdrop-blur-md md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onOpenMobile} aria-label="Buka menu" className="rounded-lg p-2 text-muted hover:bg-bg md:hidden">
          <Menu size={22} />
        </button>
        <button onClick={onToggleSidebar} aria-label="Lipat sidebar" className="hidden rounded-lg p-2 text-muted hover:bg-bg md:block">
          <PanelLeft size={20} />
        </button>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-2 truncate">
              {i > 0 && <span className="text-line">/</span>}
              {'href' in c && c.href && i < crumbs.length - 1 ? (
                <Link href={c.href} className="text-muted hover:text-ink">{c.label}</Link>
              ) : (
                <span className={i === crumbs.length - 1 ? 'font-semibold text-ink' : 'text-muted'}>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>
      <UserMenu user={user} />
    </header>
  );
}
