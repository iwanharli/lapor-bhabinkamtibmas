import Link from 'next/link';
import { cn } from './cn';

/** Kontrol segmen berbasis tautan (state di URL). */
export function SegmentedLinks({ items, active, size = 'md', className }: {
  items: { key: string; label: React.ReactNode; href: string; icon?: React.ReactNode }[];
  active: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <nav className={cn('inline-flex gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm', className)}>
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          aria-current={it.key === active ? 'page' : undefined}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition',
            size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
            it.key === active ? 'bg-primary text-white shadow' : 'text-muted hover:bg-bg hover:text-ink',
          )}
        >
          {it.icon}
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
