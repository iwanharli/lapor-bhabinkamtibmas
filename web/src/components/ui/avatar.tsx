import { cn } from './cn';

const initials = (nama: string) => nama.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const SIZE = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl' } as const;

/** Avatar inisial nama. `muted` untuk akun nonaktif. */
export function Avatar({ nama, size = 'md', muted, className }: { nama: string; size?: keyof typeof SIZE; muted?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-bold',
        muted ? 'bg-line text-muted' : 'bg-gradient-to-br from-primary to-accent text-white',
        SIZE[size],
        className,
      )}
    >
      {initials(nama)}
    </span>
  );
}
