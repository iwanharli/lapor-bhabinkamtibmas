'use client';

import { CalendarDays } from 'lucide-react';
import { UrlSelect } from '@/components/ui';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Pilihan 24 bulan terakhir (YYYY-MM) yang tersimpan di parameter URL `bulan`. */
export function MonthSelect({ value, max }: { value: string; max: string }) {
  const [y, m] = max.split('-').map(Number);
  const options = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return { value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  });
  return <UrlSelect param="bulan" label="Bulan" icon={CalendarDays} options={options} value={value} className="w-full sm:w-48" />;
}
