'use client';

import 'leaflet/dist/leaflet.css';
import type { GeoJSON as GeoJSONLayer, Map as LeafletMap, Path } from 'leaflet';
import { ArrowRight, Baby, ChevronRight, Droplets, Home, Loader2, MapPinned, Siren, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { addBaseLayers } from '@/features/map/tiles';
import { withParams } from '@/lib/url';
import { AreaStats, COLORS, colorFor, countBreaks, FEW, fmt, METRICS, MetricKey } from './metrics';

const LEVEL: Record<number, string> = { 1: 'Provinsi', 2: 'Kabupaten/Kota', 3: 'Kecamatan', 4: 'Desa/Kelurahan' };
const n = (x: number) => x.toLocaleString('id-ID');

type Feature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, AreaStats>;
type Regions = { level: number; parent: string | null; parentNama: string | null; features: Feature[]; orphan: { features: Feature[] } | null };
/** Satu langkah telusur: tingkat yang ditampilkan & induknya (null = seluruh Indonesia; 'orphan' = desa contoh tanpa kode kecamatan). */
type Crumb = { level: number; parent: string | null; nama: string };

const EMPTY = '#94a3b8';

/** Peta tematik stunting di atas citra satelit: telusur provinsi → kabupaten → kecamatan → desa. */
export function StuntingMap({ metric, unitId }: { metric: MetricKey; unitId?: string }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ level: 1, parent: null, nama: 'Indonesia' }]);
  const [data, setData] = useState<Regions | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ p: AreaStats; x: number; y: number } | null>(null);
  const [picked, setPicked] = useState<AreaStats | null>(null);
  const autoDrill = useRef(true);
  const box = useRef<HTMLDivElement>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<GeoJSONLayer | null>(null);
  const leaflet = useRef<typeof import('leaflet') | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const here = crumbs[crumbs.length - 1];
  const orphanView = here.parent === 'orphan';
  const leaf = here.level >= 4 || orphanView;
  const m = METRICS[metric];

  useEffect(() => {
    let live = true;
    const ctrl = new AbortController();
    setBusy(true);
    setError(null);
    setHover(null);
    fetch(`/api/proxy${withParams('/analytics/stunting/regions', { level: String(orphanView ? 1 : here.level), parent: orphanView ? undefined : here.parent ?? undefined, unitId })}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Regions) => {
        if (!live) return;
        const view = orphanView ? { ...d, level: 4, features: d.orphan?.features ?? [] } : d;
        const withData = view.features.filter((f) => f.properties.kk > 0);
        // Pengguna wilayah: telusuri otomatis bila datanya hanya di satu wilayah (atau hanya di desa contoh).
        if (autoDrill.current && here.level === 1 && !orphanView && withData.length === 0 && d.orphan?.features.length) {
          setCrumbs((c) => [...c, { level: 4, parent: 'orphan', nama: 'Desa binaan' }]);
          return;
        }
        if (autoDrill.current && withData.length === 1 && view.level < 4) {
          const only = withData[0].properties;
          setCrumbs((c) => [...c, { level: view.level + 1, parent: only.kode, nama: only.nama }]);
          return;
        }
        autoDrill.current = false;
        setData(view);
        setPicked(null);
      })
      .catch((e: Error) => { if (live && e.name !== 'AbortError') setError('Peta belum bisa dimuat. Coba muat ulang halaman.'); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; ctrl.abort(); };
  }, [here.level, here.parent, orphanView, unitId]);

  const features = useMemo(() => data?.features ?? [], [data]);
  const breaks = useMemo(() => m.breaks ?? countBreaks(features.map((f) => m.value(f.properties) ?? 0)), [features, m]);
  const fill = (p: AreaStats) => (p.kk === 0 ? EMPTY : colorFor(m.value(p), breaks));
  const ranking = useMemo(
    () => features.map((f) => f.properties).filter((p) => p.kk > 0 && m.value(p) != null).sort((a, b) => (m.value(b) ?? 0) - (m.value(a) ?? 0)).slice(0, 8),
    [features, m],
  );
  const total = useMemo(() => features.reduce((t, f) => {
    const p = f.properties;
    return {
      kk: t.kk + p.kk, balita: t.balita + p.balita, stunting: t.stunting + p.stunting, berisiko: t.berisiko + p.berisiko, belum: t.belum + p.belum_ditangani,
      jamban: t.jamban + p.jamban_tidak_layak, air: t.air + p.air_tidak_layak, kkSanitasi: t.kkSanitasi + p.kk_sanitasi,
    };
  }, { kk: 0, balita: 0, stunting: 0, berisiko: 0, belum: 0, jamban: 0, air: 0, kkSanitasi: 0 }), [features]);

  const drill = (p: AreaStats) => {
    if (leaf) return setPicked(p);
    setCrumbs((c) => [...c, { level: here.level + 1, parent: p.kode, nama: p.nama }]);
  };
  const goTo = (i: number) => { autoDrill.current = false; setCrumbs((c) => c.slice(0, i + 1)); };
  const shown = picked ?? hover?.p ?? null;
  const drillRef = useRef(drill);
  drillRef.current = drill;
  const styleOf = (p: AreaStats, on = false) => ({
    color: on ? '#ffffff' : '#ffffffb0', weight: on ? 3 : (data?.level ?? 1) >= 3 ? 0.8 : 1.1, fillColor: fill(p), fillOpacity: p.kk === 0 ? 0.1 : on ? 0.8 : 0.62,
  });
  const styleRef = useRef(styleOf);
  styleRef.current = styleOf;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapEl.current) return;
      leaflet.current = L;
      const mm = (map.current = L.map(mapEl.current, { zoomControl: false, attributionControl: false }).setView([-2.5, 118], 5));
      L.control.zoom({ position: 'topleft' }).addTo(mm);
      L.control.attribution({ position: 'bottomright', prefix: false }).addTo(mm);
      addBaseLayers(L, mm, 'Kemendagri 2025');
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Gambar wilayah: warna mengikuti ukuran terpilih; peta hanya terbang saat wilayahnya berganti.
  useEffect(() => {
    const L = leaflet.current, mm = map.current;
    if (!mapReady || !L || !mm) return;
    layer.current?.remove();
    layer.current = features.length ? L.geoJSON({ type: 'FeatureCollection', features } as GeoJSON.FeatureCollection, {
      style: (f) => styleRef.current(f!.properties as AreaStats),
      onEachFeature: (f, l) => {
        const p = f.properties as AreaStats;
        l.on('mousemove', (e) => setHover({ p, x: (e as L.LeafletMouseEvent).containerPoint.x, y: (e as L.LeafletMouseEvent).containerPoint.y }));
        l.on('mouseout', () => setHover(null));
        l.on('click', () => drillRef.current(p));
      },
    }).addTo(mm) : null;
  }, [mapReady, features, metric, breaks]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const mm = map.current;
    const bounds = layer.current?.getBounds();
    if (!mm || !bounds?.isValid()) return;
    const wide = window.innerWidth >= 1024; // panel kanan tampil mulai lg
    mm.flyToBounds(bounds, { paddingTopLeft: [24, 170], paddingBottomRight: [wide ? 380 : 24, 24], duration: 0.8, maxZoom: 15 });
  }, [mapReady, features]);

  // Sorotan wilayah yang diarahkan/diklik.
  useEffect(() => {
    layer.current?.eachLayer((l) => {
      const p = (l as unknown as { feature: { properties: AreaStats } }).feature.properties;
      (l as Path).setStyle(styleRef.current(p, p.kode === shown?.kode));
    });
  }, [shown?.kode]);

  const detail = shown
    ? { sub: LEVEL[shown.level], nama: shown.nama, chain: shown.chain, stats: shown }
    : {
        sub: `Gabungan · ${n(features.length)} ${LEVEL[data?.level ?? here.level].toLowerCase()}`, nama: here.nama, chain: '',
        stats: { ...total, belum_ditangani: total.belum, jamban_tidak_layak: total.jamban, air_tidak_layak: total.air, kk_sanitasi: total.kkSanitasi } as unknown as AreaStats,
      };
  const legend = [
    { color: COLORS[0], label: m.unit === '%' ? `< ${breaks[0]}%` : '0' },
    ...breaks.map((b, i) => ({
      color: COLORS[i + 1],
      label: m.unit === '%' ? (breaks[i + 1] ? `${b}–${breaks[i + 1]}%` : `≥ ${b}%`) : breaks[i + 1] && breaks[i + 1] - 1 > b ? `${b}–${breaks[i + 1] - 1}` : breaks[i + 1] ? `${b}` : `≥ ${b}`,
    })),
    ...(m.unit === '%' ? [{ color: FEW, label: 'data sedikit' }] : []),
    { color: EMPTY, label: 'belum ada data' },
  ];

  return (
    <div className="absolute inset-0">
      <section className="absolute inset-0">
        <div ref={box} className="absolute inset-0" onMouseLeave={() => setHover(null)}>
          <div ref={mapEl} className="stunting-svg map-side-panel absolute inset-0 bg-[#0b1626]" role="img" aria-label={`Peta ${m.label}`} />
          {error && <p className="map-glass-card absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-1/2 p-4 text-sm text-muted">{error}</p>}
          {!data && !error && <div className="absolute inset-0 z-[500] grid place-items-center"><Loader2 className="animate-spin text-white" /></div>}

          <nav aria-label="Tingkat wilayah" className="map-glass-card absolute left-3 top-[7.5rem] z-[500] flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1 px-3 py-1.5 text-sm lg:max-w-[calc(100%-25rem)]">
            {crumbs.map((c, i) => (
              <span key={`${c.level}-${c.parent}`} className="inline-flex items-center gap-1">
                {i > 0 && <ChevronRight size={14} className="text-muted/60" />}
                {i < crumbs.length - 1
                  ? <button type="button" onClick={() => goTo(i)} className="rounded-md px-1.5 py-0.5 text-primary hover:bg-primary-soft">{c.nama}</button>
                  : <span className="px-1.5 font-semibold">{c.nama}</span>}
              </span>
            ))}
            <span className="ml-2 inline-flex items-center gap-2 text-xs text-muted">
              {busy && <Loader2 size={14} className="animate-spin text-primary" />}
              {LEVEL[data?.level ?? here.level]} · {n(features.filter((f) => f.properties.kk > 0).length)} dari {n(features.length)} berdata
            </span>
          </nav>

          {hover && hover.x > 0 && !picked && (
            <div className="pointer-events-none absolute z-[700] w-56 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl bg-surface/95 px-3 py-2 text-xs shadow-lg ring-1 ring-line backdrop-blur"
              style={{ left: hover.x, top: hover.y }}>
              <p className="truncate font-semibold">{hover.p.nama}</p>
              <p className="text-muted">{hover.p.kk === 0 ? 'Belum ada data Mapping' : `${m.short}: ${fmt(m.value(hover.p), m.unit)} · ${n(hover.p.kk)} KK`}</p>
              {!leaf && <p className="mt-0.5 text-[10px] text-primary">Klik untuk melihat {LEVEL[here.level + 1].toLowerCase()}</p>}
            </div>
          )}

          <div className="map-glass-card absolute bottom-3 left-3 z-[500] p-2.5 text-[11px]">
            <p className="mb-1.5 font-semibold">{m.label}</p>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
              {legend.map((x) => <li key={x.label} className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm ring-1 ring-black/10" style={{ background: x.color }} />{x.label}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <aside className="absolute inset-x-3 bottom-3 z-[550] flex max-h-[38%] flex-col gap-3 overflow-y-auto max-lg:hidden lg:inset-x-auto lg:right-3 lg:top-3 lg:max-h-none lg:w-[21rem]">
        {/* Satu kartu rincian bertinggi tetap: wilayah yang disorot/diklik, atau gabungan wilayah yang sedang dilihat. */}
        <section className="map-glass-card shrink-0 overflow-hidden">
          <div className="flex items-start gap-2 border-b border-line px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{detail.sub}</p>
              <p className="truncate font-semibold">{detail.nama}</p>
              <p className="truncate text-xs text-muted">{detail.chain || '\u00a0'}</p>
            </div>
            {picked && <button type="button" onClick={() => setPicked(null)} className="rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-bg">Tutup</button>}
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-muted">{m.label}</p>
            <p className="text-2xl font-bold tabular-nums">{detail.stats.kk ? fmt(m.value(detail.stats), m.unit) : '—'}</p>
          </div>
          <dl className="grid grid-cols-2 gap-px border-t border-line bg-line text-sm">
            {([
              [Home, 'Keluarga', n(detail.stats.kk)], [Baby, 'Balita', n(detail.stats.balita)],
              [Siren, 'Stunting · berisiko', `${n(detail.stats.stunting)} · ${n(detail.stats.berisiko)}`], [Siren, 'Belum ditangani', n(detail.stats.belum_ditangani)],
              [Home, 'Jamban tak layak', `${n(detail.stats.jamban_tidak_layak)} KK`], [Droplets, 'Air tak layak', `${n(detail.stats.air_tidak_layak)} KK`],
            ] as [typeof Home, string, string][]).map(([Icon, label, v]) => (
              <div key={label} className="bg-[#0c1626] px-4 py-2">
                <dt className="flex items-center gap-1 text-[11px] text-muted"><Icon size={11} /> {label}</dt>
                <dd className={cn('font-semibold tabular-nums', label === 'Belum ditangani' && detail.stats.belum_ditangani > 0 && 'text-danger')}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex min-h-[3.25rem] items-center border-t border-line px-3 py-2">
            {picked && leaf ? (
              <Link href={withParams('/laporan', { category: 'MAPPING_KK', villageId: picked.kode, rentang: 'semua' })}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:brightness-110">
                Lihat laporan Mapping desa ini <ArrowRight size={15} />
              </Link>
            ) : (
              <p className="flex items-center gap-2 px-1 text-xs text-muted">
                <MapPinned size={14} className="shrink-0" />
                {shown ? (leaf ? 'Klik desa untuk membuka laporannya.' : `Klik untuk melihat ${LEVEL[here.level + 1].toLowerCase()}.`) : 'Arahkan kursor ke wilayah untuk rinciannya.'}
              </p>
            )}
          </div>
        </section>

        <section className="map-glass-card shrink-0 overflow-hidden">
          <p className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm font-semibold"><Trophy size={15} className="text-warn" /> Tertinggi · {m.short}</p>
          {ranking.length ? (
            <ol className="divide-y divide-line/60">
              {ranking.map((p, i) => (
                <li key={p.kode}>
                  <button type="button" onClick={() => drill(p)} onMouseEnter={() => setHover({ p, x: -1, y: -1 })} onMouseLeave={() => setHover(null)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-bg/60">
                    <span className="w-4 text-xs font-semibold text-muted tabular-nums">{i + 1}</span>
                    <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: fill(p) }} />
                    <span className="min-w-0 flex-1 truncate">{p.nama}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{fmt(m.value(p), m.unit)}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : <p className="px-4 py-4 text-xs text-muted">Belum ada wilayah berdata cukup di tingkat ini.</p>}
        </section>
        <p className="map-glass-card shrink-0 px-3 py-2 text-[11px] leading-snug text-muted">{m.hint} Satu KK yang dilaporkan ulang dihitung sekali. Tanpa titik rumah.</p>
      </aside>
    </div>
  );
}
