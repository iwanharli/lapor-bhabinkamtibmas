'use client';

import 'leaflet/dist/leaflet.css';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import { AlertTriangle, Footprints, Radio, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { withParams } from '@/lib/url';
import { STATUS, type LiveResponse, type RouteResponse } from './types';

const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const INDONESIA: [[number, number], [number, number]] = [[-11.2, 94.7], [6.2, 141.1]];
const REFRESH_MS = 60_000;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const jam = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '–');

function lalu(iso: string | null) {
  if (!iso) return 'belum ada titik';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 1 ? 'baru saja' : m < 60 ? `${m} menit lalu` : `${Math.floor(m / 60)} jam ${m % 60} menit lalu`;
}

type Leaflet = typeof import('leaflet');

/** Pantau personel: posisi terakhir Bhabin yang sedang dinas (diperbarui tiap menit) dan rute harian per orang. */
export function TrackingMonitor({ unitId, today }: { unitId?: string; today: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const lib = useRef<Leaflet | null>(null);
  const markers = useRef<LayerGroup | null>(null);
  const routeLayer = useRef<LayerGroup | null>(null);
  const fitted = useRef(false);
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [routeErr, setRouteErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLive(await callApi<LiveResponse>(withParams('/tracking/live', { unitId })));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [unitId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // Peta
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current || map.current) return;
      lib.current = L;
      map.current = L.map(el.current, { zoomControl: true, attributionControl: true }).fitBounds(INDONESIA);
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>' }).addTo(map.current);
      markers.current = L.layerGroup().addTo(map.current);
      routeLayer.current = L.layerGroup().addTo(map.current);
      setLive((x) => (x ? { ...x } : x)); // gambar ulang bila data datang lebih dulu
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Penanda posisi terakhir
  useEffect(() => {
    const L = lib.current, m = map.current, g = markers.current;
    if (!L || !m || !g || !live) return;
    g.clearLayers();
    const pts: [number, number][] = [];
    for (const p of live.data) {
      if (p.lat == null || p.lng == null) continue;
      if (picked && route && p.user_id !== picked) continue;
      const s = STATUS[p.status];
      pts.push([p.lat, p.lng]);
      L.marker([p.lat, p.lng], {
        zIndexOffset: p.status === 'aktif' ? 500 : 0,
        icon: L.divIcon({
          className: '', iconSize: [16, 16],
          html: `<div class="map-dot${p.status === 'aktif' ? ' track-live' : ''}" style="width:16px;height:16px;background:${s.color}"></div>`,
        }),
      })
        .bindTooltip(`<b>${esc([p.pangkat, p.nama].filter(Boolean).join(' '))}</b><br>${esc(p.unit)}<br>${s.label} · ${lalu(p.last_time)}${p.mock ? '<br><b style="color:#c81e3a">⚠ Lokasi palsu</b>' : ''}`)
        .on('click', () => setPicked(p.user_id))
        .addTo(g);
    }
    if (!fitted.current && pts.length) {
      fitted.current = true;
      m.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 15 });
    }
  }, [live, picked, route]);

  // Rute harian
  useEffect(() => {
    routeLayer.current?.clearLayers();
    setRoute(null);
    setRouteErr(null);
    if (!picked) return;
    let cancelled = false;
    callApi<RouteResponse>(withParams('/tracking/route', { userId: picked, date }))
      .then((r) => {
        if (cancelled) return;
        setRoute(r);
        const L = lib.current, m = map.current, g = routeLayer.current;
        if (!L || !m || !g) return;
        const line: [number, number][] = r.points.map((p) => [p.lat, p.lng]);
        if (line.length > 1) {
          L.polyline(line, { color: '#ffffff', weight: 8, opacity: 0.9 }).addTo(g);
          L.polyline(line, { color: '#1d4ed8', weight: 4 }).addTo(g);
        }
        for (const p of r.points.filter((x) => x.isMockLocation)) {
          L.circleMarker([p.lat, p.lng], { radius: 6, color: '#c81e3a', fillOpacity: 0.8 }).bindTooltip(`Lokasi palsu · ${jam(p.clientTime)}`).addTo(g);
        }
        for (const a of r.attendance) {
          const masuk = a.type === 'CHECK_IN';
          L.marker([a.lat, a.lng], {
            icon: L.divIcon({ className: '', iconSize: [26, 26], html: `<div class="track-pin" style="background:${masuk ? '#16a34a' : '#475569'}">${masuk ? 'M' : 'P'}</div>` }),
          }).bindTooltip(`${masuk ? 'Absen masuk' : 'Absen pulang'} · ${jam(a.clientTime)}`).addTo(g);
          line.push([a.lat, a.lng]);
        }
        if (line.length) m.fitBounds(L.latLngBounds(line).pad(0.25), { maxZoom: 16 });
      })
      .catch((e) => !cancelled && setRouteErr((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [picked, date]);

  const people = live?.data ?? [];
  const person = people.find((p) => p.user_id === picked);
  const minDate = new Date(new Date(`${today}T00:00:00Z`).getTime() - ((live?.retentionDays ?? 30) - 1) * 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="grid h-[calc(100dvh-13rem)] min-h-[520px] gap-4 lg:grid-cols-[1fr_340px]">
      <div className="relative isolate overflow-hidden rounded-2xl border border-line bg-[#e8edf3]">
        <div ref={el} className="absolute inset-0" />
        {route && (
          <div className="absolute right-3 top-3 z-[500] max-w-[calc(100%-1.5rem)] rounded-xl border border-line bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{[route.user.pangkat, route.user.nama].filter(Boolean).join(' ')}</div>
                <div className="text-xs text-muted">
                  Rute {new Date(`${route.date}T00:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
                  {route.points.length} titik · ±{route.distanceKm.toLocaleString('id-ID')} km
                </div>
                {route.points.length === 0 && <div className="mt-1 text-xs text-warn">Tidak ada jejak lokasi pada tanggal ini.</div>}
              </div>
              <button type="button" onClick={() => setPicked(null)} className="rounded-md p-1 text-muted hover:bg-surface-2" aria-label="Tutup rute"><X size={16} /></button>
            </div>
          </div>
        )}
        {routeErr && <div className="absolute right-3 top-3 z-[500] rounded-lg bg-danger px-3 py-2 text-xs text-white">{routeErr}</div>}
      </div>

      <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['Aktif', live?.summary.aktif, 'text-success'],
              ['Terputus', live?.summary.terputus, 'text-warn'],
              ['Selesai', live?.summary.selesai, 'text-muted'],
            ].map(([l, v, c]) => (
              <div key={l as string} className="rounded-xl bg-surface-2 py-2">
                <div className={cn('text-xl font-bold tabular-nums', c as string)}>{v ?? '–'}</div>
                <div className="text-[11px] text-muted">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
            <span className="flex items-center gap-1"><Radio size={12} /> Diperbarui tiap menit · terputus bila &gt; {live?.staleMinutes ?? 15} menit</span>
            <button type="button" onClick={refresh} className="rounded p-1 hover:bg-surface-2" aria-label="Muat ulang"><RefreshCw size={13} /></button>
          </div>
          {picked && (
            <label className="mt-3 flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1 font-medium"><Footprints size={13} /> Tanggal rute</span>
              <input type="date" value={date} min={minDate} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded-md border border-line bg-surface px-2 py-1" />
            </label>
          )}
        </div>
        {error && <div className="m-3 rounded-lg bg-danger/10 p-3 text-xs text-danger">{error}</div>}
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {live && people.length === 0 && <li className="p-6 text-center text-sm text-muted">Belum ada Bhabin yang absen masuk hari ini.</li>}
          {people.map((p) => {
            const s = STATUS[p.status];
            return (
              <li key={p.user_id}>
                <button type="button" onClick={() => setPicked(picked === p.user_id ? null : p.user_id)}
                  className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2', picked === p.user_id && 'bg-primary/5')}>
                  <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', s.dot)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{[p.pangkat, p.nama].filter(Boolean).join(' ')}</span>
                    <span className="block truncate text-xs text-muted">{p.unit}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      Masuk {jam(p.check_in)}{p.check_out ? ` · pulang ${jam(p.check_out)}` : ''} · {s.label.toLowerCase()} · {lalu(p.last_time)}
                    </span>
                  </span>
                  {p.mock && <AlertTriangle size={15} className="mt-1 shrink-0 text-danger" aria-label="Lokasi palsu" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-line px-4 py-2.5 text-[11px] leading-snug text-muted">
          Jejak hanya direkam selama jam dinas (absen masuk s.d. pulang), disimpan {live?.retentionDays ?? 30} hari. Membuka rute tercatat di log audit.
          {person?.battery != null && ` Baterai terakhir ${person.battery}%.`}
        </div>
      </aside>
    </div>
  );
}
