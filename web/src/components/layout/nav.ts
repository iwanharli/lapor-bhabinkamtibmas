import type { NavSection } from './sidebar';
import { CATEGORY_LABEL } from '@/lib/format';

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN_UNIT'];
const AUDIT_ROLES = ['SUPERADMIN', 'ADMIN_UNIT', 'AUDITOR'];
const REPORT_CATEGORIES = [
  { href: '/laporan', label: 'Semua laporan' },
  ...Object.entries(CATEGORY_LABEL).map(([category, label]) => ({ href: `/laporan?category=${category}`, label })),
];

/** Menu per peran. Menu hanya disembunyikan; keputusan akses tetap di backend. */
export function navFor(role: string): NavSection[] {
  if (role === 'BHABIN') {
    return [{ title: 'Menu', items: [{ href: '/laporan', label: 'Laporan saya', icon: 'reports', children: REPORT_CATEGORIES }] }];
  }
  const sections: NavSection[] = [
    {
      title: 'Beranda',
      items: [
        { href: '/', label: 'Ringkasan', icon: 'dashboard' },
        { href: '/notifikasi', label: 'Notifikasi', icon: 'notifications' },
        { href: '/laporan-bulanan', label: 'Laporan Bulanan', icon: 'monthly' },
      ],
    },
    {
      title: 'Laporan & Wilayah',
      items: [
        { href: '/laporan', label: 'Laporan', icon: 'reports', children: REPORT_CATEGORIES },
        { href: '/peta', label: 'Peta Sebaran', icon: 'map' },
        { href: '/harga-pangan', label: 'Harga Pangan', icon: 'prices' },
        { href: '/keluarga', label: 'Keluarga & Stunting', icon: 'family' },
        { href: '/peta-stunting', label: 'Peta Stunting', icon: 'stuntingMap' },
      ],
    },
    {
      title: 'Personel',
      items: [
        { href: '/kinerja', label: 'Kinerja Bhabin', icon: 'performance' },
        { href: '/absensi', label: 'Absensi', icon: 'attendance' },
      ],
    },
  ];
  if (ADMIN_ROLES.includes(role)) {
    sections.push({
      title: 'Administrasi',
      items: [
        { href: '/admin/pengguna', label: 'Pengguna', icon: 'users' },
        { href: '/admin/unit', label: 'Unit', icon: 'units' },
        { href: '/admin/desa', label: 'Desa', icon: 'villages' },
        { href: '/audit', label: 'Audit log', icon: 'audit' },
      ],
    });
  } else if (AUDIT_ROLES.includes(role)) {
    sections.push({ title: 'Pengawasan', items: [{ href: '/audit', label: 'Audit log', icon: 'audit' }] });
  }
  return sections;
}

export const isAdmin = (role?: string) => !!role && ADMIN_ROLES.includes(role);
