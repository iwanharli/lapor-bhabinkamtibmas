'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { cn, Select } from '@/components/ui';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Pilihan 24 bulan terakhir (YYYY-MM) yang tersimpan di parameter URL `bulan`. */
export function MonthSelect({ value, max }: { value: string; max: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [y, m] = max.split('-').map(Number);
  const options = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return { key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  });
  return (
    <Select aria-label="Bulan" value={value} className={cn('h-10 w-full sm:w-48', pending && 'opacity-70')} onChange={(e) => {
      const next = new URLSearchParams(params.toString());
      next.set('bulan', e.target.value);
      start(() => router.replace(`${pathname}?${next}`));
    }}>
      {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
    </Select>
  );
}
