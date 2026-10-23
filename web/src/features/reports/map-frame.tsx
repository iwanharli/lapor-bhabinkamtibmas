'use client';

import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import { ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui';

const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Peta titik laporan (Leaflet + OpenStreetMap) yang bisa diperbesar layar penuh; fallback overlay bila Fullscreen API tak tersedia (iOS). */
export function MapFrame({ lat, lng, mapUrl }: { lat: number; lng: number; mapUrl: string }) {
  const box = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([lat, lng], 16);
      m.attributionControl.setPrefix(false);
      L.tileLayer(TILE_URL, { maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin', attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OSM</a>' }).addTo(m);
      L.circle([lat, lng], { radius: 40, color: '#2563eb', weight: 1, fillOpacity: 0.12 }).addTo(m);
      L.circleMarker([lat, lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(m);
      map.current = m;
    })();
    return () => { cancelled = true; };
  }, [lat, lng]);
  useEffect(() => () => { map.current?.remove(); map.current = null; }, []);
  const [full, setFull] = useState(false);
  const [overlay, setOverlay] = useState(false);

  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  useEffect(() => {
    if (!overlay) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOverlay(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [overlay]);

  const toggle = () => {
    if (full) void document.exitFullscreen();
    else if (overlay) setOverlay(false);
    else if (box.current?.requestFullscreen) box.current.requestFullscreen().catch(() => setOverlay(true));
    else setOverlay(true);
  };
  const big = full || overlay;
  // Ukuran peta berubah saat layar penuh: minta Leaflet menghitung ulang & bisa digulir-zoom.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    setTimeout(() => { m.invalidateSize(); m.setView([lat, lng], m.getZoom()); }, 50);
    if (big) m.scrollWheelZoom.enable(); else m.scrollWheelZoom.disable();
  }, [big, lat, lng]);

  return (
    <div ref={box} className={cn('relative bg-bg', overlay ? 'fixed inset-0 z-[100]' : full ? 'h-full' : 'h-48')}>
      <div ref={el} className="map-mini z-0 h-full w-full" aria-label="Peta lokasi laporan" />
      <div className="absolute right-2 top-2 z-[500] flex gap-1.5">
        <button type="button" onClick={toggle} aria-label={big ? 'Keluar layar penuh' : 'Layar penuh'} title={big ? 'Keluar layar penuh (Esc)' : 'Layar penuh'}
          className="grid h-8 w-8 place-items-center rounded-lg bg-surface/95 text-ink shadow ring-1 ring-line hover:text-primary">
          {big ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>
      <a href={mapUrl} target="_blank" rel="noreferrer"
        className="absolute bottom-2 right-2 z-[500] inline-flex items-center gap-1 rounded-lg bg-surface/95 px-2.5 py-1 text-xs font-medium shadow hover:text-primary">
        Buka peta <ExternalLink size={12} />
      </a>
    </div>
  );
}
