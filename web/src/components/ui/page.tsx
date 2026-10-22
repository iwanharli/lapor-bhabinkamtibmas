import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from './cn';

/** Judul halaman. `eyebrow` opsional (mis. kategori di halaman detail); navigasi sudah ada di breadcrumb topbar. */
export function PageHeader({ eyebrow, badges, title, subtitle, actions }: { eyebrow?: React.ReactNode; badges?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {(eyebrow || badges) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {eyebrow && <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">{eyebrow}</span>}
            {badges}
          </div>
        )}
        <h1 className="break-words text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function BackLink({ href, children = 'Kembali ke daftar' }: { href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
      <ArrowLeft size={16} /> {children}
    </Link>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: 'warn' | 'danger' }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cn('mt-1 text-3xl font-bold tabular-nums', tone === 'warn' && 'text-warn', tone === 'danger' && 'text-danger')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Tampilan kosong; beri `icon` + `title` untuk kartu yang kosong agar tetap informatif. */
export function EmptyState({
  icon,
  title,
  tone = 'success',
  children,
  className,
}: {
  icon?: React.ReactNode;
  title?: string;
  /** success untuk "semua beres", neutral untuk "belum ada data". */
  tone?: 'success' | 'neutral';
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-5 py-8 text-center', className)}>
      {icon && <span className={cn('mb-1 grid h-12 w-12 place-items-center rounded-2xl', tone === 'success' ? 'bg-success-soft text-success' : 'bg-bg text-muted')}>{icon}</span>}
      {title && <p className="font-semibold">{title}</p>}
      {children && <p className="max-w-xs text-sm text-muted">{children}</p>}
    </div>
  );
}

/** Daftar label–nilai. `compact` untuk kolom sempit: label kiri, nilai rata kanan. */
export function DescriptionList({ items, compact }: { items: { label: React.ReactNode; value: React.ReactNode }[]; compact?: boolean }) {
  return (
    <dl>
      {items.map((it, i) => (
        <div
          key={i}
          className={cn(
            'border-b border-line px-5 py-3 text-sm last:border-0',
            compact ? 'flex items-baseline justify-between gap-4' : 'grid grid-cols-[40%_60%] gap-3 sm:grid-cols-[200px_1fr]',
          )}
        >
          <dt className="shrink-0 text-muted">{it.label}</dt>
          <dd className={cn('break-words', compact && 'text-right font-medium')}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
