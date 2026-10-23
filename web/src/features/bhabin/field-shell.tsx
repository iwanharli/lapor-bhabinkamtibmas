'use client';

import { ClipboardList, Home, KeyRound, LogOut, Plus, UserCheck, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { Logo } from '@/components/brand/logo';
import { NotificationBell } from '@/features/notifications/notification-bell';

const TABS = [
  { href: '/bhabin', label: 'Beranda', icon: Home, exact: true },
  { href: '/bhabin/laporan', label: 'Laporan', icon: ClipboardList },
  { href: '/bhabin/lapor', label: 'Lapor', icon: Plus, primary: true },
  { href: '/bhabin/absensi', label: 'Absensi', icon: UserCheck },
];

const initials = (nama: string) => nama.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/** Kerangka tampilan lapangan Bhabin: header ringkas + tab bawah ala aplikasi HP; di layar lebar tetap satu kolom terpusat. */
export function FieldShell({ user, children }: { user: { nama: string; pangkat?: string | null; unit: { nama: string } }; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !menu.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    // Muat ulang penuh: data sesi di memori ikut hilang & tidak bergantung pada file versi lama setelah deploy.
    window.location.replace('/login');
  }

  const active = (t: (typeof TABS)[number]) => (t.exact ? pathname === t.href : pathname.startsWith(t.href) && !(t.href === '/bhabin/lapor' && pathname.startsWith('/bhabin/laporan')));

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-r from-[var(--navy)] to-[var(--navy-2)] text-white">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
          <Logo size={38} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">Lapor Bhabinkamtibmas</p>
            <p className="truncate text-[11px] text-white/70">{user.unit.nama}</p>
          </div>
          <NotificationBell href="/bhabin/notifikasi" dark />
          <div ref={menu} className="relative">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu akun"
              className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary-2 to-accent text-xs font-bold ring-2 ring-white/20">
              {initials(user.nama)}
            </button>
            {open && (
              <div className="absolute right-0 top-11 w-56 overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-xl">
                <div className="border-b border-line px-4 py-3">
                  <p className="truncate text-sm font-semibold">{[user.pangkat, user.nama].filter(Boolean).join(' ')}</p>
                  <p className="truncate text-xs text-muted">Bhabinkamtibmas · {user.unit.nama}</p>
                </div>
                <Link href="/bhabin/profil" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-bg"><UserRound size={16} /> Profil saya</Link>
                <Link href="/ganti-sandi" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-bg"><KeyRound size={16} /> Ganti sandi</Link>
                <button type="button" onClick={logout} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger-soft"><LogOut size={16} /> Keluar</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-28 pt-4">{children}</main>

      <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-xl grid-cols-4">
          {TABS.map((t) => {
            const on = active(t);
            return t.primary ? (
              <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined} className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-primary">
                <span className="-mt-6 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[var(--brand-2)] to-[var(--brand)] text-white shadow-lg shadow-[var(--brand)]/30 ring-4 ring-bg"><t.icon size={24} /></span>
                {t.label}
              </Link>
            ) : (
              <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined}
                className={cn('flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition', on ? 'text-primary' : 'text-muted hover:text-ink')}>
                <t.icon size={21} strokeWidth={on ? 2.4 : 2} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
