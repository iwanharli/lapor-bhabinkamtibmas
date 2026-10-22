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

function pointMarker(L: Leaflet, p: MapPoint) {
  const color = CATEGORY_COLOR[p.category] ?? '#1d4ed8';
  return L.circleMarker([p.lat, p.lng], {
    radius: p.priority ? 9 : 6,
    color: p.priority ? '#c81e3a' : '#ffffff',
    weight: p.priority ? 3 : 1.5,
    fillColor: color,
    fillOpacity: 0.9,
  }).bindPopup(
    `<div style="min-width:200px;font-family:inherit">
      <div style="font-size:11px;color:${color};font-weight:600">${esc(CATEGORY_LABEL[p.category] ?? p.category)}${p.priority ? ' · <span style="color:#c81e3a">PRIORITAS</span>' : ''}</div>
      <div style="font-family:monospace;font-size:12px;margin:2px 0 6px">${esc(p.nomor)}</div>
      <div style="font-size:12px">${esc(p.bhabin)} · ${esc(p.desa)}</div>
      <div style="font-size:11px;color:#64748b">${esc(tanggalJam(p.occurred_at, p.timezone))} · ${esc(STATUS_LABEL[p.status] ?? p.status)}${p.flagged ? ' · ⚠ lokasi perlu dicek' : ''}</div>
      <a href="/laporan/${p.id}" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:#1d4ed8">Buka laporan →</a>
    </div>`,
  );
}

/** Gugus: lingkaran berangka; klik untuk memperbesar ke area gugus. */
function clusterMarker(L: Leaflet, map: LeafletMap, c: MapCluster) {
  const size = Math.round(Math.min(26 + Math.log10(c.jumlah) * 14, 64));
  const color = CATEGORY_COLOR[c.category] ?? '#1d4ed8';
  const ring = c.prioritas ? '#c81e3a' : '#ffffff';
  const label = c.jumlah >= 1000 ? `${(c.jumlah / 1000).toFixed(c.jumlah >= 10_000 ? 0 : 1)}rb` : String(c.jumlah);
  return L.marker([c.lat, c.lng], {
    icon: L.divIcon({
      className: '',
      iconSize: [size, size],
      html: `<div title="${c.jumlah} laporan${c.prioritas ? ` · ${c.prioritas} prioritas` : ''}" style="width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:.9;border:3px solid ${ring};box-shadow:0 0 0 4px ${color}33;display:grid;place-items:center;color:#fff;font:600 12px/1 system-ui">${label}</div>`,
    }),
  }).on('click', () => map.setView([c.lat, c.lng], Math.min(map.getZoom() + 2, 16)));
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
          // Prioritas digambar terakhir agar berada di atas.
          for (const p of [...data.points].sort((a, b) => Number(a.priority) - Number(b.priority))) pointMarker(L, p).addTo(layer);
        } else {
          for (const c of data.clusters) clusterMarker(L, m, c).addTo(layer);
        }
        layer.addTo(m);
        if (first && data.total) m.fitBounds(layer.getBounds().pad(0.15), { maxZoom: 15 });
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
