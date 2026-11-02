'use client';

import type { LucideIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from './cn';
import { Listbox } from './listbox';

/** Dropdown yang langsung menulis ke parameter URL (halaman kembali ke 1). `value` untuk parameter yang punya nilai bawaan. */
export function UrlSelect({ param, options, label, className, icon, value }: { param: string; options: { value: string; label: string }[]; label: string; className?: string; icon?: LucideIcon; value?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <Listbox
      label={label}
      icon={icon}
      pending={pending}
      value={value ?? params.get(param) ?? ''}
      options={options}
      className={cn('min-w-40', className)}
      onChange={(v) => {
        const next = new URLSearchParams(params.toString());
        if (v) next.set(param, v);
        else next.delete(param);
        next.delete('page');
        start(() => router.push(next.size ? `${pathname}?${next}` : pathname));
      }}
    />
  );
}
