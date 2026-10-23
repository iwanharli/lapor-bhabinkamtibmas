'use client';

import 'leaflet/dist/leaflet.css';
import type { FeatureGroup, Map as LeafletMap } from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { CATEGORY_LABEL, STATUS_LABEL, tanggalJam } from '@/lib/format';
import { withParams } from '@/lib/url';
import { attachBoundaries } from './boundary-layer';
import { CATEGORY_COLOR, type MapCluster, type MapPoint, type MapView } from './categories';

/** Ubin peta; untuk server internal arahkan ke tile server sendiri lewat NEXT_PUBLIC_TILE_URL. */
const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type Leaflet = typeof import('leaflet');
export interface MapFilters { from: string; category?: string; priority?: string; unitId?: string; regionCode?: string; regionLevel?: number }

/** Wilayah daratan & laut Indonesia (Sabang–Merauke, Miangas–Rote) untuk tampilan awal. */
const INDONESIA: [[number, number], [number, number]] = [[-11.2, 94.7], [6.2, 141.1]];
/** Area geser dibuat lega agar pengguna dapat menggeser peta melewati overlay tanpa cepat tertahan. */
const PAN_LIMIT: [[number, number], [number, number]] = [[-28, 72], [24, 174]];

/** Radius pengelompokan titik yang berdekatan di layar (px). */
const CLUSTER_RADIUS = 44;
/** Mulai zoom ini titik tidak lagi dikelompokkan. */
const NO_CLUSTER_ZOOM = 17;

function popupHtml(p: MapPoint) {
  const color = CATEGORY_COLOR[p.category] ?? '#1d4ed8';
  return `<div style="min-width:200px;font-family:inherit">
      <div style="font-size:11px;color:${color};font-weight:600">${esc(CATEGORY_LABEL[p.category] ?? p.category)}${p.priority ? ' · <span style="color:#c81e3a">PRIORITAS</span>' : ''}</div>
      <div style="font-family:monospace;font-size:12px;margin:2px 0 6px">${esc(p.nomor)}</div>
      <div style="font-size:12px">${esc(p.bhabin)} · ${esc(p.desa)}</div>
      <div style="font-size:11px;color:#64748b">${esc(tanggalJam(p.occurred_at, p.timezone))} · ${esc(STATUS_LABEL[p.status] ?? p.status)}${p.flagged ? ' · ⚠ lokasi perlu dicek' : ''}</div>
      <a href="/laporan/${p.id}" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:#1d4ed8">Buka laporan →</a>
    </div>`;
}

/** Titik tunggal; prioritas diberi cincin merah berdenyut. */
function pointMarker(L: Leaflet, p: MapPoint) {
  const size = p.priority ? 18 : 13;
  return L.marker([p.lat, p.lng], {
    zIndexOffset: p.priority ? 1000 : 0,
    icon: L.divIcon({
      className: '',
      iconSize: [size, size],
      html: `<div class="map-dot${p.priority ? ' map-priority' : ''}" style="width:${size}px;height:${size}px;background:${CATEGORY_COLOR[p.category] ?? '#1d4ed8'}"></div>`,
    }),
  }).bindPopup(popupHtml(p));
}

/** Gugus berangka; berdenyut bila berisi laporan prioritas. */
/**
 * Ikon gugus. Cincin merah bila berisi laporan prioritas; denyut hanya untuk gugus kecil (≤ 20) atau yang
 * ≥ 20% prioritas — di zoom nasional hampir semua gugus berisi prioritas sehingga denyut di semua gugus jadi bising.
 */
function clusterIcon(L: Leaflet, jumlah: number, prioritas: number, category: string) {
  const size = Math.round(Math.min(26 + Math.log10(jumlah) * 9, 50));
  const pulse = prioritas > 0 && (jumlah <= 20 || prioritas / jumlah >= 0.2);
  const label = jumlah >= 1000 ? `${(jumlah / 1000).toFixed(jumlah >= 10_000 ? 0 : 1)}rb` : String(jumlah);
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    html: `<div class="map-cluster${pulse ? ' map-priority' : ''}" title="${jumlah} laporan${prioritas ? ` · ${prioritas} prioritas` : ''}" style="width:${size}px;height:${size}px;background:${CATEGORY_COLOR[category] ?? '#1d4ed8'}${prioritas && !pulse ? ';border-color:#c81e3a' : ''}">${label}</div>`,
  });
}

/** Gugus dari server (jumlah sangat banyak): klik untuk memperbesar. */
function serverCluster(L: Leaflet, map: LeafletMap, c: MapCluster) {
  return L.marker([c.lat, c.lng], { icon: clusterIcon(L, c.jumlah, c.prioritas, c.category), zIndexOffset: c.prioritas ? 1000 : 0 })
    .on('click', () => map.setView([c.lat, c.lng], Math.min(map.getZoom() + 2, 16)));
}

/** Kategori terbanyak dalam sekelompok titik (untuk warna gugus). */
const dominant = (pts: MapPoint[]) => {
  const n: Record<string, number> = {};
  for (const p of pts) n[p.category] = (n[p.category] ?? 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0];
};

/**
 * Kelompokkan titik yang berjarak < CLUSTER_RADIUS px pada zoom saat ini (greedy, dibantu grid).
 * Titik prioritas diproses lebih dulu agar menjadi pusat gugus.
 */
function groupPoints(map: LeafletMap, points: MapPoint[]): MapPoint[][] {
  const zoom = map.getZoom();
  if (zoom >= NO_CLUSTER_ZOOM) return points.map((p) => [p]);
  const items = [...points]
    .sort((a, b) => Number(b.priority) - Number(a.priority))
    .map((p) => ({ p, px: map.project([p.lat, p.lng], zoom), used: false }));
  const grid = new Map<string, typeof items>();
  const cell = (x: number, y: number) => `${Math.floor(x / CLUSTER_RADIUS)}:${Math.floor(y / CLUSTER_RADIUS)}`;
  for (const it of items) {
    const k = cell(it.px.x, it.px.y);
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(it);
  }
  const groups: MapPoint[][] = [];
  for (const it of items) {
    if (it.used) continue;
    it.used = true;
    const group = [it.p];
    const cx = Math.floor(it.px.x / CLUSTER_RADIUS);
    const cy = Math.floor(it.px.y / CLUSTER_RADIUS);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const o of grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (!o.used && it.px.distanceTo(o.px) < CLUSTER_RADIUS) {
            o.used = true;
            group.push(o.p);
          }
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

/** Gugus dari titik berdekatan: klik untuk memperbesar ke cakupannya, atau daftar bila titiknya bertumpuk. */
function pointCluster(L: Leaflet, map: LeafletMap, group: MapPoint[]) {
  const lat = group.reduce((s, p) => s + p.lat, 0) / group.length;
  const lng = group.reduce((s, p) => s + p.lng, 0) / group.length;
  const prioritas = group.filter((p) => p.priority).length;
  const bounds = L.latLngBounds(group.map((p) => [p.lat, p.lng] as [number, number]));
  const marker = L.marker([lat, lng], { icon: clusterIcon(L, group.length, prioritas, dominant(group)), zIndexOffset: prioritas ? 1000 : 0 });
  const stacked = bounds.getNorthEast().distanceTo(bounds.getSouthWest()) < 5;
  if (stacked) {
    marker.bindPopup(
      `<div style="max-height:240px;overflow:auto;min-width:220px">${group
        .map((p) => `<a href="/laporan/${p.id}" style="display:block;padding:4px 0;font-size:12px;color:#0f172a;text-decoration:none">
            <span style="color:${p.priority ? '#c81e3a' : CATEGORY_COLOR[p.category]};font-weight:600">${esc(CATEGORY_LABEL[p.category] ?? p.category)}</span>
            · <span style="font-family:monospace">${esc(p.nomor)}</span></a>`)
        .join('')}</div>`,
    );
  } else {
    marker.on('click', () => map.fitBounds(bounds.pad(0.3), { maxZoom: NO_CLUSTER_ZOOM }));
  }
  return marker;
}

const MAP_LOADING_EVENT = 'lapor:map-loading';
const MAP_INDONESIA_EVENT = 'lapor:map-focus-indonesia';

/** Arahkan peta kembali ke tampilan awal: wilayah akun, atau seluruh Indonesia untuk akun nasional. */
export function focusIndonesia() {
  window.dispatchEvent(new Event(MAP_INDONESIA_EVENT));
}

/** Panggil saat filter peta diubah (sebelum navigasi) agar peta menampilkan overlay loading sampai data baru siap. */
export function signalMapLoading() {
  window.dispatchEvent(new Event(MAP_LOADING_EVENT));
}

/** Overlay loading tembus pandang di atas peta (di bawah panel melayang). */
function MapLoading({ show }: { show: boolean }) {
  return (
    <div
      aria-hidden={!show}
      className={`pointer-events-none absolute inset-0 z-[450] grid place-items-center bg-bg/30 backdrop-blur-[3px] transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}
    >
      <div role="status" className="flex items-center gap-3 rounded-full border border-line/80 bg-surface/85 px-5 py-2.5 shadow-[0_12px_32px_-16px_rgba(15,35,65,.5)] backdrop-blur-xl">
        <span className="relative grid h-5 w-5 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        </span>
        <span className="text-sm font-medium text-ink">Memuat data peta…</span>
      </div>
    </div>
  );
}

/**
 * Peta laporan di atas batas wilayah Kemendagri. Isi diambil per area tampilan:
 * titik bila sedikit, gugus berangka bila banyak (docs/teknis/12 §4.2). Dimuat hanya di browser.
 */
/** Kotak [w,s,e,n] → batas Leaflet; null = seluruh Indonesia. */
export const homeBounds = (b?: [number, number, number, number] | null): [[number, number], [number, number]] =>
  b ? [[b[1], b[0]], [b[3], b[2]]] : INDONESIA;

/** `home`: wilayah akun (atau unit terpilih) sebagai tampilan awal; akun nasional melihat seluruh Indonesia. */
export function ReportMap({ filters, home }: { filters: MapFilters; home?: [number, number, number, number] | null }) {
  const homeRef = useRef(homeBounds(home));
  homeRef.current = homeBounds(home);
  const homeKey = home?.join(',') ?? '';
  const firstHome = useRef(true);
  // Unit di filter berganti → arahkan ke wilayah unit tersebut (tampilan awal sudah ditangani saat peta dibuat).
  useEffect(() => {
    if (firstHome.current) {
      firstHome.current = false;
      return;
    }
    focusIndonesia();
  }, [homeKey]);
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const detach = useRef<(() => void) | null>(null);
  // Overlay loading: dari filter diklik (sinyal) / filter berubah sampai titik filter baru selesai digambar.
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      setBusy(true);
      clearTimeout(timer);
      timer = setTimeout(() => setBusy(false), 10_000); // pengaman bila navigasi batal
    };
    window.addEventListener(MAP_LOADING_EVENT, start);
    return () => {
      window.removeEventListener(MAP_LOADING_EVENT, start);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let layer: FeatureGroup | null = null;
    let abort: AbortController | null = null;
    let m: LeafletMap | null = null;
    let cleanupMove: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let filterLoad = true;
    setBusy(true);

    const load = async (L: Leaflet) => {
      if (!m) return;
      abort?.abort();
      abort = new AbortController();
      const b = m.getBounds().pad(0.2);
      const view = { bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(4)).join(','), zoom: String(Math.round(m.getZoom())) };
      try {
        const res = await fetch(`/api/proxy${withParams('/analytics/map', {
          ...filters,
          regionLevel: filters.regionLevel == null ? undefined : String(filters.regionLevel),
          ...view,
        })}`, { signal: abort.signal });
        if (!res.ok || cancelled) return;
        const data: MapView = await res.json();
        layer?.remove();
        layer = L.featureGroup();
        if (data.mode === 'points') {
          for (const g of groupPoints(m, data.points)) (g.length === 1 ? pointMarker(L, g[0]) : pointCluster(L, m, g)).addTo(layer);
        } else {
          for (const c of data.clusters) serverCluster(L, m, c).addTo(layer);
        }
        layer.addTo(m);
        if (filterLoad) {
          filterLoad = false;
          setBusy(false);
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error(e);
          setBusy(false);
        }
      }
    };

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current) return;
      if (!map.current) {
        // Tampilan awal seluruh Indonesia; zoom keluar & geser dibatasi di sekitar Indonesia.
        const mm = (map.current = L.map(el.current, {
          zoomControl: false,
          // Atribusi minimalis di kanan bawah, menempel di atas strip prioritas (lihat globals.css).
          attributionControl: false,
          zoomSnap: 0.25,
          maxBounds: PAN_LIMIT,
          maxBoundsViscosity: 0.65,
        }));
        L.control.zoom({ position: 'topleft' }).addTo(mm);
        L.control.attribution({ position: 'bottomright', prefix: false }).addTo(mm);
        const mapInsets = () => {
          const wide = mm.getSize().x >= 900;
          return wide
            ? { topLeft: L.point(70, 70), bottomRight: L.point(360, 190) }
            : { topLeft: L.point(12, 70), bottomRight: L.point(12, 190) };
        };
        const fitIndonesia = () => {
          const { topLeft, bottomRight } = mapInsets();
          const symmetricPadding = L.point(Math.max(topLeft.x, bottomRight.x), Math.max(topLeft.y, bottomRight.y));
          mm.setMinZoom(Math.max(2, mm.getBoundsZoom(INDONESIA, false, symmetricPadding) - 0.5));
        };
        const initialInsets = mapInsets();
        mm.fitBounds(homeRef.current, { paddingTopLeft: initialInsets.topLeft, paddingBottomRight: initialInsets.bottomRight, maxZoom: 15 });
        fitIndonesia();
        mm.on('resize', fitIndonesia);
        L.tileLayer(TILE_URL, { maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · Kemendagri 2025' }).addTo(map.current);
        const detachBoundaries = attachBoundaries(L, map.current);
        const showIndonesia = () => {
          const { topLeft, bottomRight } = mapInsets();
          mm.flyToBounds(homeRef.current, { paddingTopLeft: topLeft, paddingBottomRight: bottomRight, duration: 0.9, maxZoom: 15 });
        };
        window.addEventListener(MAP_INDONESIA_EVENT, showIndonesia);
        detach.current = () => {
          window.removeEventListener(MAP_INDONESIA_EVENT, showIndonesia);
          detachBoundaries();
        };
      }
      m = map.current;
      if (el.current && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => m?.invalidateSize({ pan: false, debounceMoveend: true }));
        resizeObserver.observe(el.current);
      }
      const onMove = () => load(L);
      m.on('moveend', onMove);
      await load(L);
      if (cancelled) m.off('moveend', onMove);
      else cleanupMove = () => m?.off('moveend', onMove);
    })();

    return () => {
      cancelled = true;
      abort?.abort();
      cleanupMove?.();
      resizeObserver?.disconnect();
      layer?.remove();
    };
  }, [filters.from, filters.category, filters.priority, filters.unitId, filters.regionCode, filters.regionLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    detach.current?.();
    map.current?.remove();
    map.current = null;
  }, []);

  useEffect(() => {
    const focusRegion = (event: Event) => {
      const detail = (event as CustomEvent<{ lat: number; lng: number; zoom: number }>).detail;
      if (!map.current || !detail || !Number.isFinite(detail.lat) || !Number.isFinite(detail.lng)) return;
      map.current.flyTo([detail.lat, detail.lng], Math.max(map.current.getMinZoom(), detail.zoom), { duration: 0.9 });
    };
    window.addEventListener('lapor:map-focus-region', focusRegion);
    return () => window.removeEventListener('lapor:map-focus-region', focusRegion);
  }, []);

  return (
    <div className="relative h-full min-h-0 w-full">
      <div ref={el} className="map-under-bar h-full min-h-0 w-full bg-bg" aria-label="Peta sebaran laporan" aria-busy={busy} />
      <MapLoading show={busy} />
    </div>
  );
}
