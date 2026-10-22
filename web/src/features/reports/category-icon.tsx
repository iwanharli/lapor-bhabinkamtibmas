import { HandHelping, Home, Megaphone, Radar, ShoppingBasket, Sprout, UsersRound } from 'lucide-react';
import { cn } from '@/components/ui';

/** Ikon & warna per kategori laporan. */
const META: Record<string, { icon: typeof Home; cls: string }> = {
  SAMBANG: { icon: UsersRound, cls: 'bg-primary-soft text-primary' },
  DETEKSI_DINI: { icon: Radar, cls: 'bg-danger-soft text-danger' },
  PROBLEM_SOLVING: { icon: HandHelping, cls: 'bg-warn-soft text-warn' },
  PENYULUHAN: { icon: Megaphone, cls: 'bg-accent/15 text-accent-ink' },
  HARGA_PANGAN: { icon: ShoppingBasket, cls: 'bg-info-soft text-info' },
  MAPPING_KK: { icon: Home, cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-300' },
  KETAHANAN_PANGAN: { icon: Sprout, cls: 'bg-success-soft text-success' },
};

const SIZE = { sm: ['h-8 w-8 rounded-lg', 16], md: ['h-10 w-10 rounded-xl', 19], lg: ['h-14 w-14 rounded-2xl', 26] } as const;

/** Komponen ikon kategori saja (untuk latar khusus, mis. header gradien). */
export const categoryGlyph = (category: string) => (META[category] ?? META.SAMBANG).icon;

export function CategoryIcon({ category, size = 'md' }: { category: string; size?: keyof typeof SIZE }) {
  const m = META[category] ?? META.SAMBANG;
  const [box, icon] = SIZE[size];
  return (
    <span className={cn('grid shrink-0 place-items-center', m.cls, box)}>
      <m.icon size={icon} />
    </span>
  );
}
