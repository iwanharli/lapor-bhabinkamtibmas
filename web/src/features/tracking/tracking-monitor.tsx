'use client';

import 'leaflet/dist/leaflet.css';
import type { LayerGroup, Map as LeafletMap, Marker } from 'leaflet';
import { AlertTriangle, Radio, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { withParams } from '@/lib/url';
import { STATUS, type LiveResponse } from './types';

const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const INDONESIA: [[number, number], [number, number]] = [[-11.2, 94.7], [6.2, 141.1]];
const REFRESH_MS = 30_000;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const jam = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '–');

function lalu(iso: string | null) {
  if (!iso) return 'belum ada posisi';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 1 ? 'baru saja' : m < 60 ? `${m} menit lalu` : `${Math.floor(m / 60)} jam ${m % 60} menit lalu`;
}

type Leaflet = typeof import('leaflet');

/** Pantau personel: posisi terkini Bhabin yang sedang dinas (diperbarui tiap 30 detik). Riwayat tidak disimpan. */
export function TrackingMonitor({ unitId }: { unitId?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const lib = useRef<Leaflet | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const byUser = useRef(new Map<string, Marker>());
  const fitted = useRef(false);
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current || map.current) return;
      lib.current = L;
      map.current = L.map(el.current).fitBounds(INDONESIA);
      L.tileLayer(TILE_URL, { maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>' }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      setReady(true);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const L = lib.current, m = map.current, g = layer.current;
    if (!ready || !L || !m || !g || !live) return;
    g.clearLayers();
    byUser.current.clear();
    const pts: [number, number][] = [];
    for (const p of live.data) {
      if (p.lat == null || p.lng == null) continue;
      const s = STATUS[p.status];
      pts.push([p.lat, p.lng]);
      const mk = L.marker([p.lat, p.lng], {
        zIndexOffset: p.status === 'aktif' ? 500 : 0,
        icon: L.divIcon({ className: '', iconSize: [16, 16], html: `<div class="map-dot${p.status === 'aktif' ? ' track-live' : ''}" style="width:16px;height:16px;background:${s.color}"></div>` }),
      })
        .bindTooltip(`<b>${esc([p.pangkat, p.nama].filter(Boolean).join(' '))}</b><br>${esc(p.unit)}<br>${s.label} · ${lalu(p.last_time)}${p.acc ? ` · ±${Math.round(p.acc)} m` : ''}${p.mock ? '<br><b style="color:#c81e3a">⚠ Lokasi palsu</b>' : ''}`)
        .on('click', () => setPicked(p.user_id))
        .addTo(g);
      byUser.current.set(p.user_id, mk);
    }
    if (!fitted.current && pts.length) {
      fitted.current = true;
      m.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 15 });
    }
    if (picked) byUser.current.get(picked)?.openTooltip();
  }, [live, ready, picked]);

  const focus = (id: string) => {
    setPicked(id);
    const mk = byUser.current.get(id);
    if (mk) map.current?.flyTo(mk.getLatLng(), Math.max(map.current.getZoom(), 16), { duration: 0.6 });
  };

  const people = live?.data ?? [];
  return (
    <div className="grid h-[calc(100dvh-13rem)] min-h-[520px] gap-4 lg:grid-cols-[1fr_340px]">
      <div className="relative isolate overflow-hidden rounded-2xl border border-line bg-[#e8edf3]">
        <div ref={el} className="absolute inset-0" />
      </div>

      <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            {([['Aktif', live?.summary.aktif, 'text-success'], ['Terputus', live?.summary.terputus, 'text-warn'], ['Selesai', live?.summary.selesai, 'text-muted']] as const).map(([l, v, c]) => (
              <div key={l} className="rounded-xl bg-surface-2 py-2">
                <div className={cn('text-xl font-bold tabular-nums', c)}>{v ?? '–'}</div>
                <div className="text-[11px] text-muted">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
            <span className="flex items-center gap-1"><Radio size={12} /> Diperbarui tiap 30 detik · terputus bila &gt; {live?.staleMinutes ?? 5} menit</span>
            <button type="button" onClick={refresh} className="rounded p-1 hover:bg-surface-2" aria-label="Muat ulang"><RefreshCw size={13} /></button>
          </div>
        </div>
        {error && <div className="m-3 rounded-lg bg-danger/10 p-3 text-xs text-danger">{error}</div>}
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {live && people.length === 0 && <li className="p-6 text-center text-sm text-muted">Belum ada Bhabin yang absen masuk hari ini.</li>}
          {people.map((p) => {
            const s = STATUS[p.status];
            return (
              <li key={p.user_id}>
                <button type="button" onClick={() => focus(p.user_id)} disabled={p.lat == null}
                  className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2 disabled:cursor-default', picked === p.user_id && 'bg-primary/5')}>
                  <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', s.dot)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{[p.pangkat, p.nama].filter(Boolean).join(' ')}</span>
                    <span className="block truncate text-xs text-muted">{p.unit}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      Masuk {jam(p.check_in)}{p.check_out ? ` · pulang ${jam(p.check_out)}` : ` · ${s.label.toLowerCase()} · ${lalu(p.last_time)}`}
                    </span>
                  </span>
                  {p.mock && <AlertTriangle size={15} className="mt-1 shrink-0 text-danger" aria-label="Lokasi palsu" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-line px-4 py-2.5 text-[11px] leading-snug text-muted">
          Hanya posisi terkini selama jam dinas (absen masuk s.d. pulang). Riwayat perjalanan tidak disimpan; posisi dihapus saat absen pulang.
        </div>
      </aside>
    </div>
  );
}
