import Link from 'next/link';
import { CATEGORY_LABEL } from '@/lib/format';
import type { Overview } from '@/lib/types';

/** Jumlah laporan per kategori dengan batang proporsi. */
export function CategoryBars({ rows, hrefFor }: { rows: Overview['byCategory']; hrefFor: (category: string) => string }) {
  const max = Math.max(...rows.map((r) => r.jumlah), 1);
  const total = rows.reduce((s, r) => s + r.jumlah, 0) || 1;
  return (
    <ul className="space-y-3.5 p-5">
      {rows.map((c) => (
        <li key={c.category}>
          <Link href={hrefFor(c.category)} className="group block">
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="group-hover:text-primary">{CATEGORY_LABEL[c.category]}</span>
              <span className="tabular-nums">
                <strong>{c.jumlah}</strong>
                <span className="ml-1.5 text-xs text-muted">{Math.round((c.jumlah / total) * 100)}%</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-primary-soft">
              <div className="h-2 rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${(c.jumlah / max) * 100}%` }} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
