'use client';

import { ChevronDown, ChevronRight, MapPinned, X } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/components/ui';
import { regionQuery } from './categories';
import { signalMapLoading } from './report-map';
import { callApi } from '@/lib/api/client';

interface RegionOption { kode: string; nama: string; level: number; lat: number | null; lng: number | null }

function useRegions(parent: string | null) {
  const [rows, setRows] = useState<RegionOption[]>([]);
  useEffect(() => {
    let current = true;
    setRows([]);
    if (parent === null) return;
    callApi<RegionOption[]>(parent ? `/regions?parent=${encodeURIComponent(parent)}` : '/regions')
      .then((result) => { if (current) setRows(result); })
      .catch(() => { if (current) setRows([]); });
    return () => { current = false; };
  }, [parent]);
  return rows;
}

/** Empat tingkat filter geografis yang mengubah filter laporan pada peta. */
export function MapRegionFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const province = params.get('provinsiKode') ?? '';
  const city = params.get('kabupatenKode') ?? '';
  const district = params.get('kecamatanKode') ?? '';
  const village = params.get('desaKode') ?? '';
  const provinces = useRegions('');
  const cities = useRegions(province || null);
  const districts = useRegions(city || null);
  const villages = useRegions(district || null);

  /** Pilih wilayah; mengosongkan satu tingkat kembali ke tingkat di atasnya. */
  function update(code: string, parent: string) {
    const next = regionQuery(query, code || parent);
    // Peta terbang ke batas wilayah & menyorotnya setelah filter berlaku (ReportMap).
    signalMapLoading();
    router.push(next.size ? `${pathname}?${next}` : pathname);
  }

  const levels = [
    { label: 'Provinsi', all: 'Semua provinsi', value: province, options: provinces, level: 1, parent: '', disabled: false },
    { label: 'Kabupaten atau kota', all: 'Semua kab/kota', value: city, options: cities, level: 2, parent: province, disabled: !province },
    { label: 'Kecamatan', all: 'Semua kecamatan', value: district, options: districts, level: 3, parent: city, disabled: !city },
    { label: 'Desa atau kelurahan', all: 'Semua desa', value: village, options: villages, level: 4, parent: district, disabled: !district },
  ];

  return (
    <div className="flex h-9 items-center pl-1.5 pr-1">
      <MapPinned size={15} className="mr-1 shrink-0 text-primary" aria-hidden />
      {levels.map((l, i) => (
        <Fragment key={l.level}>
          {i > 0 && <ChevronRight size={14} className="shrink-0 text-muted/50" aria-hidden />}
          <label className={cn('relative flex h-7 items-center rounded-lg transition', !l.disabled && 'hover:bg-surface', l.value && 'bg-surface shadow-sm ring-1 ring-line/60')}>
            <span className="sr-only">{l.label}</span>
            <select
              aria-label={l.label}
              value={l.value}
              disabled={l.disabled}
              onChange={(e) => update(e.target.value, l.parent)}
              className={cn(
                'h-full max-w-[9.5rem] cursor-pointer appearance-none truncate [field-sizing:content] rounded-lg bg-transparent pl-2.5 pr-7 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed',
                l.value ? 'font-semibold text-ink' : 'text-muted',
                l.disabled && 'opacity-45',
              )}
            >
              <option value="">{l.all}</option>
              {l.options.map((r) => <option key={r.kode} value={r.kode}>{r.nama}</option>)}
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2 text-muted" aria-hidden />
          </label>
        </Fragment>
      ))}
      {province && (
        <button type="button" onClick={() => update('', '')} aria-label="Hapus filter wilayah" title="Hapus filter wilayah"
          className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
