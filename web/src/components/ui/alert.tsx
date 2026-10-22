import { cn } from './cn';

const TONES = {
  danger: 'border-danger/30 bg-danger/5 text-danger',
  warn: 'border-warn/40 bg-warn/5',
  success: 'border-success/30 bg-success-soft',
  info: 'border-line bg-surface text-muted',
} as const;

export function Alert({ tone = 'info', title, className, children }: { tone?: keyof typeof TONES; title?: React.ReactNode; className?: string; children?: React.ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : undefined} className={cn('rounded-xl border px-4 py-3 text-sm', TONES[tone], className)}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      {children}
    </div>
  );
}

/** Pesan galat ringkas di dalam form/modal. */
export function ErrorText({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{children}</p>;
}
