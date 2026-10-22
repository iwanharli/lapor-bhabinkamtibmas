'use client';

import 'leaflet/dist/leaflet.css';
import type { FeatureGroup, Map as LeafletMap } from 'leaflet';
import { useEffect, useRef } from 'react';
import { CATEGORY_LABEL, STATUS_LABEL, tanggalJam } from '@/lib/format';
import { withParams } from '@/lib/url';
import { attachBoundaries } from './boundary-layer';
import { CATEGORY_COLOR, type MapCluster, type MapPoint, type MapView } from './categories';

/** Ubin peta; untuk server internal arahkan ke tile server sendiri lewat NEXT_PUBLIC_TILE_URL. */
const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type Leaflet = typeof import('leaflet');
export interface MapFilters { from: string; category?: string; priority?: string }

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
function clusterIcon(L: Leaflet, jumlah: number, prioritas: number, category: string) {
  const size = Math.round(Math.min(28 + Math.log10(jumlah) * 14, 64));
  const label = jumlah >= 1000 ? `${(jumlah / 1000).toFixed(jumlah >= 10_000 ? 0 : 1)}rb` : String(jumlah);
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    html: `<div class="map-cluster${prioritas ? ' map-priority' : ''}" title="${jumlah} laporan${prioritas ? ` · ${prioritas} prioritas` : ''}" style="width:${size}px;height:${size}px;background:${CATEGORY_COLOR[category] ?? '#1d4ed8'}">${label}</div>`,
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

/**
 * Peta laporan di atas batas wilayah Kemendagri. Isi diambil per area tampilan:
 * titik bila sedikit, gugus berangka bila banyak (docs/teknis/12 §4.2). Dimuat hanya di browser.
 */
export function ReportMap({ filters }: { filters: MapFilters }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const detach = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let layer: FeatureGroup | null = null;
    let abort: AbortController | null = null;
    let first = true;
    let m: LeafletMap | null = null;
    let cleanupMove: (() => void) | null = null;

    const load = async (L: Leaflet) => {
      if (!m) return;
      abort?.abort();
      abort = new AbortController();
      const b = m.getBounds().pad(0.2);
      const view = first ? {} : { bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(4)).join(','), zoom: String(m.getZoom()) };
      try {
        const res = await fetch(`/api/proxy${withParams('/analytics/map', { ...filters, ...view })}`, { signal: abort.signal });
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
        if (first && data.total) {
          first = false;
          // Sesuaikan ke sebaran titik asli (bukan gugus); fit memicu moveend → dikelompokkan ulang pada zoom akhir.
          const coords = (data.mode === 'points' ? data.points : data.clusters).map((p) => [p.lat, p.lng] as [number, number]);
          m.fitBounds(L.latLngBounds(coords).pad(0.15), { maxZoom: 15 });
        }
        first = false;
      } catch (e) {
        if ((e as Error).name !== 'AbortError') console.error(e);
      }
    };

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current) return;
      if (!map.current) {
        map.current = L.map(el.current, {
          zoomControl: true,
          attributionControl: true,
          minZoom: 4,
          maxBounds: [[-16, 88], [12, 148]], // sekitar wilayah Indonesia
          maxBoundsViscosity: 0.8,
        }).setView([-2.5, 118], 5);
        L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; OpenStreetMap · Batas: Kemendagri 2025' }).addTo(map.current);
        detach.current = attachBoundaries(L, map.current);
      }
      m = map.current;
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
      layer?.remove();
    };
  }, [filters.from, filters.category, filters.priority]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    detach.current?.();
    map.current?.remove();
    map.current = null;
  }, []);

  return <div ref={el} className="h-full min-h-[480px] w-full rounded-b-2xl bg-bg" aria-label="Peta sebaran laporan" />;
}
