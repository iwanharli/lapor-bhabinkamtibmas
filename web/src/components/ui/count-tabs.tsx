import Link from 'next/link';
import { cn } from './cn';

export interface CountTab {
  key: string;
  label: string;
  count: number;
  href: string;
  /** Kelas warna titik penanda, mis. 'bg-success'. */
  dot?: string;
}

/** Tab berbasis tautan dengan jumlah di tiap tab (state di URL). */
export function CountTabs({ tabs, active }: { tabs: CountTab[]; active: string }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <nav className="inline-flex min-w-full gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <Link
              key={t.key || 'all'}
              href={t.href}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition',
                on ? 'bg-primary text-white shadow' : 'text-muted hover:bg-bg hover:text-ink',
              )}
            >
              {t.dot && <span className={cn('h-2 w-2 rounded-full', on ? 'bg-white' : t.dot)} />}
              {t.label}
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', on ? 'bg-white/20' : 'bg-bg text-muted')}>{t.count.toLocaleString('id-ID')}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
