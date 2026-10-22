import { Download } from 'lucide-react';
import { buttonClass } from './button';

/** Tautan unduh CSV lewat BFF; `path` relatif ke API, mis. "/exports/reports.csv?status=APPROVED". */
export function ExportButton({ path, label = 'Ekspor CSV' }: { path: string; label?: string }) {
  return (
    <a href={`/api/proxy${path}`} download className={buttonClass({ variant: 'secondary' })} title="Unduh sebagai CSV (dapat dibuka di Excel)">
      <Download size={16} /> {label}
    </a>
  );
}
