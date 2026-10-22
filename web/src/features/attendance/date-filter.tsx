'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { cn, Input } from '@/components/ui';

const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Pemilih tanggal (parameter URL `tanggal`) dengan tombol hari sebelumnya/berikutnya. */
export function DateFilter({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const go = (d: string) => {
    const next = new URLSearchParams(params.toString());
    if (d && d !== today) next.set('tanggal', d);
    else next.delete('tanggal');
    next.delete('page');
    start(() => router.push(next.size ? `${pathname}?${next}` : pathname));
  };
  const btn = 'grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-muted hover:text-ink disabled:opacity-40';
  return (
    <div className={cn('flex items-center gap-1.5', pending && 'opacity-70')}>
      <button type="button" aria-label="Hari sebelumnya" className={btn} onClick={() => go(shift(date, -1))}><ChevronLeft size={16} /></button>
      <Input type="date" aria-label="Tanggal" value={date} max={today} onChange={(e) => e.target.value && go(e.target.value)} className="w-40" />
      <button type="button" aria-label="Hari berikutnya" className={btn} disabled={date >= today} onClick={() => go(shift(date, 1))}><ChevronRight size={16} /></button>
      {date !== today && <button type="button" onClick={() => go(today)} className="ml-1 text-sm font-medium text-primary hover:underline">Hari ini</button>}
    </div>
  );
}
