'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from './cn';
import { Select } from './form';

/** Dropdown yang langsung menulis ke parameter URL (halaman kembali ke 1). */
export function UrlSelect({ param, options, label, className }: { param: string; options: { value: string; label: string }[]; label: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <Select
      aria-label={label}
      value={params.get(param) ?? ''}
      className={cn('w-auto min-w-40', pending && 'opacity-70', className)}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value) next.set(param, e.target.value);
        else next.delete(param);
        next.delete('page');
        start(() => router.push(next.size ? `${pathname}?${next}` : pathname));
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select>
  );
}
