import { cn } from './cn';

type Align = 'left' | 'right' | 'center';
const ALIGN: Record<Align, string> = { left: 'text-left', right: 'text-right', center: 'text-center' };

/** Tabel yang bisa digulir horizontal di layar sempit. */
export function Table({ minWidth, className, children }: { minWidth?: number; className?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-left text-sm', className)} style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({ align = 'left', className, children }: { align?: Align; className?: string; children?: React.ReactNode }) {
  return <th className={cn('px-4 py-3 font-medium', ALIGN[align], className)}>{children}</th>;
}

export function Tr({ active, className, children }: { active?: boolean; className?: string; children: React.ReactNode }) {
  return <tr className={cn('border-b border-line last:border-0', active ? 'bg-primary-soft' : 'hover:bg-bg', className)}>{children}</tr>;
}

export function Td({
  align = 'left',
  nowrap,
  numeric,
  muted,
  className,
  children,
}: {
  align?: Align;
  nowrap?: boolean;
  numeric?: boolean;
  muted?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <td className={cn('px-4 py-3', ALIGN[align], nowrap && 'whitespace-nowrap', numeric && 'tabular-nums', muted && 'text-muted', className)}>
      {children}
    </td>
  );
}

/** Teks utama + keterangan kecil di bawahnya dalam satu sel. */
export function CellStack({ primary, secondary }: { primary: React.ReactNode; secondary?: React.ReactNode }) {
  return (
    <>
      {primary}
      {secondary && <span className="block text-xs text-muted">{secondary}</span>}
    </>
  );
}
