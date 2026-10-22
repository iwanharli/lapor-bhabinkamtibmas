'use client';

import 'leaflet/dist/leaflet.css';
import type { FeatureGroup, Map as LeafletMap } from 'leaflet';
import { useEffect, useRef } from 'react';
import { CATEGORY_LABEL, STATUS_LABEL, tanggalJam } from '@/lib/format';
import { attachBoundaries } from './boundary-layer';
import { CATEGORY_COLOR, type MapPoint } from './categories';

/** Ubin peta; untuk server internal arahkan ke tile server sendiri lewat NEXT_PUBLIC_TILE_URL. */
const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Peta Leaflet titik laporan di atas batas wilayah Kemendagri. Dimuat hanya di browser. */
export function ReportMap({ points }: { points: MapPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const pointsLayer = useRef<FeatureGroup | null>(null);
  const detach = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
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
      const m = map.current;
      pointsLayer.current?.remove();
      const layer = (pointsLayer.current = L.featureGroup());
      // Prioritas digambar terakhir agar berada di atas.
      for (const p of [...points].sort((a, b) => Number(a.priority) - Number(b.priority))) {
        const color = CATEGORY_COLOR[p.category] ?? '#1d4ed8';
        L.circleMarker([p.lat, p.lng], {
          radius: p.priority ? 9 : 6,
          color: p.priority ? '#c81e3a' : '#ffffff',
          weight: p.priority ? 3 : 1.5,
          fillColor: color,
          fillOpacity: 0.9,
        })
          .bindPopup(
            `<div style="min-width:200px;font-family:inherit">
              <div style="font-size:11px;color:${color};font-weight:600">${esc(CATEGORY_LABEL[p.category] ?? p.category)}${p.priority ? ' · <span style="color:#c81e3a">PRIORITAS</span>' : ''}</div>
              <div style="font-family:monospace;font-size:12px;margin:2px 0 6px">${esc(p.nomor)}</div>
              <div style="font-size:12px">${esc(p.bhabin)} · ${esc(p.desa)}</div>
              <div style="font-size:11px;color:#64748b">${esc(tanggalJam(p.occurred_at, p.timezone))} · ${esc(STATUS_LABEL[p.status] ?? p.status)}${p.flagged ? ' · ⚠ lokasi perlu dicek' : ''}</div>
              <a href="/laporan/${p.id}" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:#1d4ed8">Buka laporan →</a>
            </div>`,
          )
          .addTo(layer);
      }
      layer.addTo(m);
      if (points.length) m.fitBounds(layer.getBounds().pad(0.15), { maxZoom: 15 });
    })();
    return () => {
      cancelled = true;
    };
  }, [points]);

  useEffect(() => () => {
    detach.current?.();
    map.current?.remove();
    map.current = null;
  }, []);

  return <div ref={el} className="h-full min-h-[480px] w-full rounded-b-2xl bg-bg" aria-label="Peta sebaran laporan" />;
}
