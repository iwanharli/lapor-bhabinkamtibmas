'use client';

import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import { useEffect, useRef } from 'react';
import type { VillageGeoJson } from './types';

const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Peta batas desa (poligon) dengan label nama. */
export function BoundaryMap({ data, highlightId }: { data: VillageGeoJson; highlightId?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current) return;
      if (!map.current) {
        map.current = L.map(el.current).setView([-2.5, 118], 5);
        L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map.current);
      }
      const m = map.current;
      m.eachLayer((l) => {
        if (!(l instanceof L.TileLayer)) m.removeLayer(l);
      });
      if (!data.features.length) return;
      const layer = L.geoJSON(data as GeoJSON.FeatureCollection, {
        style: (f) => {
          const on = f?.properties?.id === highlightId;
          return { color: on ? '#c81e3a' : '#1d4ed8', weight: on ? 3 : 2, fillColor: on ? '#c81e3a' : '#3b82f6', fillOpacity: on ? 0.25 : 0.12 };
        },
        onEachFeature: (f, l) => l.bindTooltip(`${f.properties.nama}<br><span style="color:#64748b">${f.properties.kecamatan}</span>`, { sticky: true }),
      }).addTo(m);
      m.fitBounds(layer.getBounds().pad(0.1));
    })();
    return () => {
      cancelled = true;
    };
  }, [data, highlightId]);

  useEffect(() => () => {
    map.current?.remove();
    map.current = null;
  }, []);

  return <div ref={el} className="h-full min-h-[360px] w-full bg-bg" aria-label="Peta batas desa" />;
}
