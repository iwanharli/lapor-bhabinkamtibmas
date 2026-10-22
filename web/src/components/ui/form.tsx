import { forwardRef, useId } from 'react';
import { cn } from './cn';

const control =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cn(control, 'pr-8', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(control, 'bg-bg', className)} {...rest} />;
});

export function Checkbox({ label, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input type="checkbox" className="h-4 w-4 accent-primary" {...rest} />
      {label}
    </label>
  );
}

/**
 * Label + kontrol + petunjuk/galat. Kontrol diberikan sebagai fungsi agar id terhubung ke label:
 *   <Field label="Nama">{(id) => <Input id={id} />}</Field>
 */
export function Field({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children(id)}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Grid form responsif: 1 kolom di HP, 2 kolom di layar lebar. Pakai `className="sm:col-span-2"` untuk baris penuh. */
export function FormGrid({ className, ...rest }: React.FormHTMLAttributes<HTMLFormElement>) {
  return <form className={cn('grid gap-4 sm:grid-cols-2', className)} {...rest} />;
}
