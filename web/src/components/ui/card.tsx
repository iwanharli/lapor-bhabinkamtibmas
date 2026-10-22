import { cn } from './cn';

export function Card({
  title,
  subtitle,
  actions,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Padding isi; kosongkan untuk tabel/list yang menempel ke tepi. */
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgb(var(--shadow-tint)/0.05),0_8px_24px_-12px_rgb(var(--shadow-tint)/0.16)]', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
