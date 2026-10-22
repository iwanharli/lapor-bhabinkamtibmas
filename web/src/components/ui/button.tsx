import Link from 'next/link';
import { forwardRef } from 'react';
import { cn } from './cn';

const VARIANTS = {
  primary: 'bg-primary text-white hover:brightness-110',
  secondary: 'border border-line bg-surface text-ink hover:bg-bg',
  ghost: 'text-muted hover:bg-bg hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-110',
  warn: 'bg-warn text-white hover:brightness-110',
  'outline-danger': 'border border-danger text-danger hover:bg-danger/5',
  'outline-warn': 'border border-warn text-warn hover:bg-warn/5',
} as const;

const SIZES = {
  sm: 'gap-1.5 px-3 py-1.5 text-xs',
  md: 'gap-2 px-4 py-2 text-sm',
  lg: 'gap-2 px-5 py-2.5 text-sm',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function buttonClass({ variant = 'primary', size = 'md', className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    'inline-flex items-center justify-center rounded-lg font-semibold transition disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, icon, loading, loadingText = 'Memproses…', className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonClass({ variant, size, className })} {...rest}>
      {icon}
      {loading ? loadingText : children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant,
  size,
  icon,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass({ variant, size, className })}>
      {icon}
      {children}
    </Link>
  );
}
