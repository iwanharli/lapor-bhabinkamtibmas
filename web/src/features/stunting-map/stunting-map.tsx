'use client';

import { ArrowRight, Baby, ChevronRight, Droplets, Home, Loader2, MapPinned, Siren, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { withParams } from '@/lib/url';
import { AreaStats, COLORS, colorFor, countBreaks, FEW, fmt, METRICS, MetricKey } from './metrics';

const LEVEL: Record<number, string> = { 1: 'Provinsi', 2: 'Kabupaten/Kota', 3: 'Kecamatan', 4: 'Desa/Kelurahan' };
const n = (x: number) => x.toLocaleString('id-ID');

type Feature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, AreaStats>;
type Regions = { level: number; parent: string | null; parentNama: string | null; features: Feature[]; orphan: { features: Feature[] } | null };
/** Satu langkah telusur: tingkat yang ditampilkan & induknya (null = seluruh Indonesia; 'orphan' = desa contoh tanpa kode kecamatan). */
type Crumb = { level: number; parent: string | null; nama: string };

const W = 1000;

/** Proyeksi Mercator → koordinat SVG yang pas dengan batas semua bentuk (dengan sedikit margin). */
function project(features: Feature[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const merc = ([lng, lat]: number[]) => [lng, -Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI)];
  const polys = (g: Feature['geometry']) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
  for (const f of features) {
    for (const poly of polys(f.geometry)) {
      for (const ring of poly) {
        for (const c of ring) {
          const [x, y] = merc(c);
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
  }
  const pad = 0.03 * Math.max(maxX - minX, maxY - minY);
  minX -= pad; maxX += pad; minY -= pad; maxY += pad;
  const k = W / (maxX - minX || 1);
  const H = Math.max(240, (maxY - minY) * k);
  const toPath = (g: Feature['geometry']) => polys(g).map((poly) => poly.map((ring) =>
    ring.map((c, i) => { const [x, y] = merc(c); return `${i ? 'L' : 'M'}${((x - minX) * k).toFixed(1)} ${((y - minY) * k).toFixed(1)}`; }).join('') + 'Z').join('')).join('');
  return { H, toPath };
}

/** Peta tematik stunting SVG (tanpa pustaka peta/tile): telusur provinsi → kabupaten → kecamatan → desa. */
export function StuntingMap({ metric, unitId }: { metric: MetricKey; unitId?: string }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ level: 1, parent: null, nama: 'Indonesia' }]);
  const [data, setData] = useState<Regions | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ p: AreaStats; x: number; y: number } | null>(null);
  const [picked, setPicked] = useState<AreaStats | null>(null);
  const autoDrill = useRef(true);
  const box = useRef<HTMLDivElement>(null);
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
  const proj = useMemo(() => (features.length ? project(features) : null), [features]);
  const paths = useMemo(() => (proj ? features.map((f) => ({ f, d: proj.toPath(f.geometry) })) : []), [features, proj]);
  const breaks = useMemo(() => m.breaks ?? countBreaks(features.map((f) => m.value(f.properties) ?? 0)), [features, m]);
  const fill = (p: AreaStats) => (p.kk === 0 ? 'var(--map-empty)' : colorFor(m.value(p), breaks));
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
    { color: 'var(--map-empty)', label: 'belum ada data' },
  ];

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden">
      <section className="relative flex min-h-[460px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm [--map-empty:#e2e8f0] [--map-stroke:#ffffff] dark:[--map-empty:#1e293b] dark:[--map-stroke:#0b1220]">
        <nav aria-label="Tingkat wilayah" className="flex flex-wrap items-center gap-1 border-b border-line px-4 py-2.5 text-sm">
          {crumbs.map((c, i) => (
            <span key={`${c.level}-${c.parent}`} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} className="text-muted/60" />}
              {i < crumbs.length - 1
                ? <button type="button" onClick={() => goTo(i)} className="rounded-md px-1.5 py-0.5 text-primary hover:bg-primary-soft">{c.nama}</button>
                : <span className="px-1.5 font-semibold">{c.nama}</span>}
            </span>
          ))}
          <span className="ml-auto inline-flex items-center gap-2 text-xs text-muted">
            {busy && <Loader2 size={14} className="animate-spin text-primary" />}
            {LEVEL[data?.level ?? here.level]} · {n(features.filter((f) => f.properties.kk > 0).length)} dari {n(features.length)} berdata
          </span>
        </nav>

        <div ref={box} className="peta-laut relative min-h-0 flex-1" onMouseLeave={() => setHover(null)}>
          {error ? (
            <p className="grid h-full place-items-center p-8 text-sm text-muted">{error}</p>
          ) : proj ? (
            <svg key={`${here.level}-${here.parent}`} viewBox={`0 0 ${W} ${proj.H.toFixed(0)}`} preserveAspectRatio="xMidYMid meet"
              className={cn('stunting-svg h-full w-full transition-opacity duration-300', busy && 'opacity-40')}
              role="img" aria-label={`Peta ${m.label} per ${LEVEL[data!.level].toLowerCase()}`}>
              <defs>
                {/* Bayangan lembut di bawah daratan agar pulau tampak "terangkat" dari laut. */}
                <filter id="daratan" x="-5%" y="-5%" width="110%" height="115%">
                  <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0f2a5c" floodOpacity="0.28" />
                </filter>
              </defs>
              <g filter="url(#daratan)">
              {paths.map(({ f, d }) => {
                const p = f.properties;
                return (
                  <path key={p.kode} d={d} fill={fill(p)} fillRule="evenodd" stroke="var(--map-stroke)" strokeWidth={data!.level >= 3 ? 0.6 : 0.9}
                    vectorEffect="non-scaling-stroke" className="cursor-pointer transition-[fill,opacity] duration-300 hover:opacity-85"
                    onMouseMove={(e) => {
                      const r = box.current!.getBoundingClientRect();
                      setHover({ p, x: e.clientX - r.left, y: e.clientY - r.top });
                    }}
                    onClick={() => drill(p)}>
                    <title>{p.nama}</title>
                  </path>
                );
              })}
              </g>
              {/* Wilayah yang disorot digambar ulang di atas agar garis tepinya tidak tertutup tetangga. */}
              {shown && paths.filter(({ f }) => f.properties.kode === shown.kode).map(({ d }) => (
                <path key="sorot" d={d} fill="none" stroke="currentColor" strokeWidth={2.4} vectorEffect="non-scaling-stroke" pointerEvents="none" className="text-ink" />
              ))}
            </svg>
          ) : (
            <div className="grid h-full place-items-center"><Loader2 className="animate-spin text-muted" /></div>
          )}

          {hover && hover.x > 0 && !picked && (
            <div className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl bg-surface/95 px-3 py-2 text-xs shadow-lg ring-1 ring-line backdrop-blur"
              style={{ left: hover.x, top: hover.y }}>
              <p className="truncate font-semibold">{hover.p.nama}</p>
              <p className="text-muted">{hover.p.kk === 0 ? 'Belum ada data Mapping' : `${m.short}: ${fmt(m.value(hover.p), m.unit)} · ${n(hover.p.kk)} KK`}</p>
              {!leaf && <p className="mt-0.5 text-[10px] text-primary">Klik untuk melihat {LEVEL[here.level + 1].toLowerCase()}</p>}
            </div>
          )}

          <div className="absolute bottom-3 left-3 rounded-xl bg-surface/90 p-2.5 text-[11px] shadow ring-1 ring-line backdrop-blur">
            <p className="mb-1.5 font-semibold">{m.label}</p>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
              {legend.map((x) => <li key={x.label} className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm ring-1 ring-black/10" style={{ background: x.color }} />{x.label}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
        {/* Satu kartu rincian bertinggi tetap: wilayah yang disorot/diklik, atau gabungan wilayah yang sedang dilihat. */}
        <section className="rounded-2xl border border-line bg-surface shadow-sm">
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
              <div key={label} className="bg-surface px-4 py-2">
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

        <section className="rounded-2xl border border-line bg-surface shadow-sm">
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
        <p className="px-1 text-[11px] leading-snug text-muted">{m.hint} Satu KK yang dilaporkan ulang dihitung sekali. Tanpa titik rumah.</p>
      </aside>
    </div>
  );
}
