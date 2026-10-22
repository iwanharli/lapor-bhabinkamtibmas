'use client';

import { ChevronDown, ChevronRight, MapPinned, X } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/components/ui';
import { focusIndonesia, signalMapLoading } from './report-map';
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

/** Tiga tingkat filter geografis yang mengubah filter laporan pada peta. */

export function MapRegionFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const [province, setProvince] = useState(params.get('provinsiKode') ?? '');
  const [city, setCity] = useState(params.get('kabupatenKode') ?? '');
  const [district, setDistrict] = useState(params.get('kecamatanKode') ?? '');
  const provinces = useRegions('');
  const cities = useRegions(province || null);
  const districts = useRegions(city || null);

  useEffect(() => {
    const next = new URLSearchParams(query);
    setProvince(next.get('provinsiKode') ?? '');
    setCity(next.get('kabupatenKode') ?? '');
    setDistrict(next.get('kecamatanKode') ?? '');
  }, [query]);

  function update(level: 1 | 2 | 3, code: string) {
    const next = new URLSearchParams(query);
    if (level === 1) {
      setProvince(code);
      setCity('');
      setDistrict('');
      if (code) next.set('provinsiKode', code);
      else next.delete('provinsiKode');
      next.delete('kabupatenKode');
      next.delete('kecamatanKode');
    } else if (level === 2) {
      setCity(code);
      setDistrict('');
      if (code) next.set('kabupatenKode', code);
      else next.delete('kabupatenKode');
      next.delete('kecamatanKode');
    } else {
      setDistrict(code);
      if (code) next.set('kecamatanKode', code);
      else next.delete('kecamatanKode');
    }

    const selected = level === 3 ? code || city || province : level === 2 ? code || province : code;
    const selectedLevel = level === 3 ? (code ? '3' : city ? '2' : province ? '1' : '') : level === 2 ? (code ? '2' : province ? '1' : '') : code ? '1' : '';
    if (selected && selectedLevel) {
      next.set('regionCode', selected);
      next.set('regionLevel', selectedLevel);
    } else {
      next.delete('regionCode');
      next.delete('regionLevel');
    }

    const targetLevel = Number(selectedLevel) as 1 | 2 | 3;
    const target = targetLevel === 1
      ? provinces.find((r) => r.kode === selected)
      : targetLevel === 2
        ? cities.find((r) => r.kode === selected)
        : districts.find((r) => r.kode === selected);
    if (!selected) {
      // Semua provinsi: kembali ke tampilan seluruh Indonesia.
      focusIndonesia();
    } else if (target?.lat != null && target.lng != null) {
      window.dispatchEvent(new CustomEvent('lapor:map-focus-region', {
        detail: { lat: target.lat, lng: target.lng, zoom: targetLevel === 1 ? 5.5 : targetLevel === 2 ? 8 : 10.5 },
      }));
    }
    signalMapLoading();
    router.push(next.size ? `${pathname}?${next}` : pathname);
  }

  const levels = [
    { label: 'Provinsi', all: 'Semua provinsi', value: province, options: provinces, level: 1 as const, disabled: false },
    { label: 'Kabupaten atau kota', all: 'Semua kab/kota', value: city, options: cities, level: 2 as const, disabled: !province },
    { label: 'Kecamatan', all: 'Semua kecamatan', value: district, options: districts, level: 3 as const, disabled: !city },
  ];

  return (
    <div className="flex h-9 items-center rounded-xl bg-bg/80 pl-2.5 pr-1 ring-1 ring-line/70">
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
              onChange={(e) => update(l.level, e.target.value)}
              className={cn(
                'h-full max-w-[13rem] cursor-pointer appearance-none truncate [field-sizing:content] rounded-lg bg-transparent pl-2.5 pr-7 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed',
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
        <button type="button" onClick={() => update(1, '')} aria-label="Hapus filter wilayah" title="Hapus filter wilayah"
          className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
