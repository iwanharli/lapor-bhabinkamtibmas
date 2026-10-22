'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MobileNav, NavSection, Sidebar } from './sidebar';
import { ShellUser, Topbar } from './topbar';

const COLLAPSE_KEY = 'lapor.sidebar.collapsed';

/** Kerangka dashboard: sidebar (bisa dilipat) + topbar + konten. */
export function AppShell({ sections, user, children }: { sections: NavSection[]; user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      // penyimpanan browser tidak tersedia; pakai default
    }
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        // abaikan
      }
      return !c;
    });
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar sections={sections} collapsed={collapsed} />
      <MobileNav sections={sections} open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar sections={sections} user={user} onToggleSidebar={toggle} onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
