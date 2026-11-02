'use client';

import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import { useEffect, useRef } from 'react';
import { addBaseLayers } from '@/features/map/tiles';
import type { MarketPoint } from '@/lib/types';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Titik pasar di satu wilayah: emas = sudah ada laporan harga, putih = belum dipantau. */
export function MarketMap({ points }: { points: MarketPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false, zoomSnap: 0.25 });
      addBaseLayers(L, map);
      const layer = L.featureGroup(points.map((p) => L.circleMarker([p.lat, p.lng], {
        radius: p.laporan ? 8 : 5, color: p.laporan ? '#1a1405' : '#0a3a8c', weight: 2, fillColor: p.laporan ? '#f5c400' : '#ffffff', fillOpacity: 1,
      }).bindTooltip(`<b>${esc(p.nama)}</b><br>${p.laporan ? `${p.laporan} laporan harga` : 'Belum ada laporan harga'}`))).addTo(map);
      map.invalidateSize();
      // Abaikan titik terjauh (2%) agar satu titik menyimpang tidak membuat peta terlalu jauh.
      const lat = points.map((p) => p.lat).sort((a, b) => a - b);
      const lng = points.map((p) => p.lng).sort((a, b) => a - b);
      const cut = Math.floor(points.length * 0.02);
      map.fitBounds([[lat[cut], lng[cut]], [lat[lat.length - 1 - cut], lng[lng.length - 1 - cut]]], { padding: [24, 24], maxZoom: 15 });
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points]);
  return <div ref={el} className="relative z-0 h-[28rem] w-full bg-bg" aria-label="Peta titik pasar" />;
}
