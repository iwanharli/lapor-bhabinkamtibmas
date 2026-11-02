'use client';

import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import { useEffect, useRef } from 'react';
import type { VillageGeoJson } from './types';
import { addBaseLayers } from '@/features/map/tiles';

/** Peta batas desa (poligon) dengan label nama. */
export function BoundaryMap({ data, highlightId, fitTop }: { data: VillageGeoJson; highlightId?: string; fitTop?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current) return;
      if (!map.current) {
        map.current = L.map(el.current).setView([-2.5, 118], 5);
        addBaseLayers(L, map.current);
      }
      const m = map.current;
      m.eachLayer((l) => {
        if (!(l instanceof L.TileLayer)) m.removeLayer(l);
      });
      if (!data.features.length) return;
      const layer = L.geoJSON(data as GeoJSON.FeatureCollection, {
        style: (f) => {
          const on = f?.properties?.id === highlightId;
          return { color: on ? '#ff4d5e' : '#fbbf24', weight: on ? 3 : 2, fillColor: on ? '#ff4d5e' : '#fbbf24', fillOpacity: on ? 0.25 : 0.12 };
        },
        onEachFeature: (f, l) => l.bindTooltip(`${f.properties.nama}<br><span style="color:#64748b">${f.properties.kecamatan}</span>`, { sticky: true }),
      }).addTo(m);
      // fitTop: wilayah di paruh atas, agar tetap terlihat walau bagian bawah peta belum tergulir ke layar.
      m.fitBounds(layer.getBounds().pad(0.1), fitTop ? { paddingBottomRight: [0, m.getSize().y * 0.55] } : undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [data, highlightId, fitTop]);

  useEffect(() => () => {
    map.current?.remove();
    map.current = null;
  }, []);

  return <div ref={el} className="h-full min-h-[360px] w-full bg-bg" aria-label="Peta batas desa" />;
}
