import { cn } from './cn';

const TONES = {
  neutral: 'bg-slate-500/10 text-muted',
  info: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn/10 text-warn',
  orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  danger: 'bg-danger/10 text-danger',
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({ tone = 'neutral', strong, className, children }: { tone?: BadgeTone; strong?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs', strong ? 'font-bold uppercase tracking-wide' : 'font-medium', TONES[tone], className)}>
      {children}
    </span>
  );
}
