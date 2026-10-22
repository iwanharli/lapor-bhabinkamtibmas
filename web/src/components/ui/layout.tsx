import { cn } from './cn';

/** Tumpukan vertikal dengan jarak seragam. */
export function Stack({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('flex flex-col gap-4', className)}>{children}</div>;
}

/** Konten utama + kolom samping (1/3) di layar lebar; bertumpuk di HP. */
export function SplitLayout({ aside, children, asideSticky }: { aside: React.ReactNode; children: React.ReactNode; asideSticky?: boolean }) {
  return (
    // minmax(0,…) & min-w-0: tabel lebar menggulir di dalam kartunya, bukan melebarkan halaman.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Stack className="min-w-0">{children}</Stack>
      <Stack className={cn('min-w-0 self-start', asideSticky && 'lg:sticky lg:top-20')}>{aside}</Stack>
    </div>
  );
}

/** Grid kartu responsif: 1 kolom di HP, `cols` kolom di layar lebar. */
export function Grid({ cols = 2, className, children }: { cols?: 2 | 3 | 4; className?: string; children: React.ReactNode }) {
  const lg = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4' }[cols];
  return <div className={cn('grid gap-4', lg, className)}>{children}</div>;
}
