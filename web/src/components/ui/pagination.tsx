import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from './cn';

/** Nomor halaman yang ditampilkan: 1 … 4 5 6 … 13. */
export function pageWindow(page: number, pages: number, around = 1): (number | '…')[] {
  const set = new Set([1, pages]);
  for (let p = page - around; p <= page + around; p++) if (p >= 1 && p <= pages) set.add(p);
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

const item = 'grid h-9 min-w-9 place-items-center rounded-lg px-2.5 text-sm tabular-nums transition';

/**
 * Pagination berbasis URL (Server Component): ringkasan jumlah, nomor halaman, dan pilihan baris per halaman.
 * `hrefFor(page, limit)` membangun URL tujuan.
 */
export function Pagination({
  page,
  limit,
  total,
  hrefFor,
  sizes = [10, 20, 50],
  noun = 'data',
}: {
  page: number;
  limit: number;
  total: number;
  hrefFor: (page: number, limit: number) => string;
  sizes?: number[];
  noun?: string;
}) {
  const pages = Math.max(Math.ceil(total / limit), 1);
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(page * limit, total);

  return (
    <nav aria-label="Halaman" className="flex flex-col items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-sm md:flex-row">
      <p className="text-muted">
        {total === 0 ? (
          <>Tidak ada {noun}</>
        ) : (
          <>
            Menampilkan <strong className="text-ink">{from.toLocaleString('id-ID')}–{to.toLocaleString('id-ID')}</strong> dari{' '}
            <strong className="text-ink">{total.toLocaleString('id-ID')}</strong> {noun}
          </>
        )}
      </p>

      {pages > 1 && (
        <div className="flex items-center gap-1">
          <PageLink href={page > 1 ? hrefFor(page - 1, limit) : undefined} label="Sebelumnya"><ChevronLeft size={16} /></PageLink>
          {pageWindow(page, pages).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className={cn(item, 'text-muted')}>…</span>
            ) : (
              <Link key={p} href={hrefFor(p, limit)} aria-current={p === page ? 'page' : undefined}
                className={cn(item, p === page ? 'bg-primary font-semibold text-white shadow' : 'text-ink hover:bg-bg')}>
                {p}
              </Link>
            ),
          )}
          <PageLink href={page < pages ? hrefFor(page + 1, limit) : undefined} label="Berikutnya"><ChevronRight size={16} /></PageLink>
        </div>
      )}

      <div className="flex items-center gap-2 text-muted">
        <span>Baris</span>
        <div className="inline-flex rounded-lg border border-line p-0.5">
          {sizes.map((s) => (
            <Link key={s} href={hrefFor(1, s)} aria-current={s === limit ? 'true' : undefined}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium', s === limit ? 'bg-primary-soft text-primary' : 'hover:bg-bg')}>
              {s}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

function PageLink({ href, label, children }: { href?: string; label: string; children: React.ReactNode }) {
  if (!href) return <span aria-disabled className={cn(item, 'text-muted/40')}>{children}</span>;
  return <Link href={href} aria-label={label} className={cn(item, 'text-ink hover:bg-bg')}>{children}</Link>;
}
