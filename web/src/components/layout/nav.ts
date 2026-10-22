import type { NavSection } from './sidebar';

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN_UNIT'];

/** Menu per peran. Menu hanya disembunyikan; keputusan akses tetap di backend. */
export function navFor(role: string): NavSection[] {
  if (role === 'BHABIN') {
    return [{ title: 'Menu', items: [{ href: '/laporan', label: 'Laporan saya', icon: 'reports' }] }];
  }
  const sections: NavSection[] = [
    { title: 'Pemantauan', items: [{ href: '/', label: 'Ringkasan', icon: 'dashboard' }] },
    {
      title: 'Operasional',
      items: [
        { href: '/laporan', label: 'Laporan', icon: 'reports' },
        { href: '/harga-pangan', label: 'Harga Pangan', icon: 'prices' },
      ],
    },
  ];
  if (ADMIN_ROLES.includes(role)) {
    sections.push({
      title: 'Administrasi',
      items: [
        { href: '/admin/pengguna', label: 'Pengguna', icon: 'users' },
        { href: '/admin/unit', label: 'Unit', icon: 'units' },
      ],
    });
  }
  return sections;
}

export const isAdmin = (role?: string) => !!role && ADMIN_ROLES.includes(role);
