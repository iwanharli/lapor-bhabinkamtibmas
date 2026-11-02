'use client';

import 'leaflet/dist/leaflet.css';
import type { LayerGroup, LatLngExpression, Map as LeafletMap, Marker } from 'leaflet';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { callApi } from '@/lib/api/client';
import { withParams } from '@/lib/url';
import { STATUS, type LivePerson, type LiveResponse, type LiveStatus } from './types';
import { addBaseLayers } from '@/features/map/tiles';

const INDONESIA: [[number, number], [number, number]] = [[-11.2, 94.7], [6.2, 141.1]];
/** Cadangan bila aliran langsung terputus lama; normalnya data datang lewat SSE. */
const FALLBACK_MS = 60_000;
const GLIDE_MS = 900;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const jam = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '–');

function lalu(iso: string | null, now: number) {
  if (!iso) return 'belum ada posisi';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return 'baru saja';
  if (s < 60) return `${s} detik lalu`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} menit lalu` : `${Math.floor(m / 60)} jam ${m % 60} menit lalu`;
}

/** Status dihitung di peramban agar "aktif → terputus" berubah tepat waktu tanpa menunggu server. */
function statusOf(p: LivePerson, staleMin: number, now: number): LiveStatus {
  if (p.check_out) return 'selesai';
  if (!p.last_time) return 'belum_ada_titik';
  return now - new Date(p.last_time).getTime() > staleMin * 60_000 ? 'terputus' : 'aktif';
}

type Leaflet = typeof import('leaflet');
type Conn = 'connecting' | 'live' | 'reconnecting';
type Tracked = { marker: Marker; status?: LiveStatus; raf?: number };

/** Geser penanda dengan halus ke posisi baru (bukan melompat). */
function glide(t: Tracked, to: [number, number]) {
  const from = t.marker.getLatLng();
  if (from.lat === to[0] && from.lng === to[1]) return;
  if (t.raf) cancelAnimationFrame(t.raf);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return void t.marker.setLatLng(to);
  const start = performance.now();
  const step = (ts: number) => {
    const k = Math.min(1, (ts - start) / GLIDE_MS);
    const e = 1 - (1 - k) ** 3;
    t.marker.setLatLng([from.lat + (to[0] - from.lat) * e, from.lng + (to[1] - from.lng) * e] as LatLngExpression);
    t.raf = k < 1 ? requestAnimationFrame(step) : undefined;
  };
  t.raf = requestAnimationFrame(step);
}

/** Pantau personel secara langsung: posisi didorong server (SSE) begitu HP Bhabin mengirim. Riwayat tidak disimpan. */
export function TrackingMonitor({ unitId, home }: { unitId?: string; home?: [number, number, number, number] | null }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const lib = useRef<Leaflet | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const byUser = useRef(new Map<string, Tracked>());
  const fitted = useRef(false);
  const [people, setPeople] = useState<LivePerson[] | null>(null);
  const [staleMin, setStaleMin] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [conn, setConn] = useState<Conn>('connecting');
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    try {
      const res = await callApi<LiveResponse>(withParams('/tracking/live', { unitId }));
      setPeople(res.data);
      setStaleMin(res.staleMinutes);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [unitId]);

  // Aliran langsung + cadangan berkala; daftar dimuat ulang saat ada absen masuk/pulang atau setelah sambungan pulih.
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const reload = () => {
      clearTimeout(debounce);
      debounce = setTimeout(refresh, 600);
    };
    refresh();
    const es = new EventSource(`/api/proxy${withParams('/tracking/stream', { unitId })}`);
    let opened = false;
    es.onopen = () => {
      setConn('live');
      if (opened) reload(); // tersambung ulang: kejar perubahan yang terlewat
      opened = true;
    };
    es.onerror = () => setConn('reconnecting');
    es.addEventListener('roster', reload);
    es.addEventListener('pos', (ev) => {
      const d = JSON.parse((ev as MessageEvent<string>).data) as Pick<LivePerson, 'user_id' | 'last_time' | 'lat' | 'lng' | 'acc' | 'mock'>;
      setPeople((ps) => {
        if (!ps?.some((p) => p.user_id === d.user_id)) {
          reload();
          return ps;
        }
        return ps.map((p) => (p.user_id === d.user_id ? { ...p, ...d } : p));
      });
      setFlash((f) => ({ ...f, [d.user_id]: Date.now() }));
    });
    const fallback = setInterval(refresh, FALLBACK_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      es.close();
      clearTimeout(debounce);
      clearInterval(fallback);
      clearInterval(tick);
    };
  }, [refresh, unitId]);

  useEffect(() => {
    let cancelled = false;
    const tracked = byUser.current;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current || map.current) return;
      lib.current = L;
      map.current = L.map(el.current).fitBounds(home ? [[home[1], home[0]], [home[3], home[2]]] : INDONESIA, { maxZoom: 15 });
      addBaseLayers(L, map.current);
      layer.current = L.layerGroup().addTo(map.current);
      setReady(true);
    })();
    return () => {
      cancelled = true;
      for (const t of tracked.values()) if (t.raf) cancelAnimationFrame(t.raf);
      tracked.clear();
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- wilayah awal saja; ganti unit me-mount ulang (key)
  }, []);

  // Penanda diperbarui di tempat (geser halus, ganti warna bila status berubah), tidak digambar ulang semua.
  useEffect(() => {
    const L = lib.current, m = map.current, g = layer.current;
    if (!ready || !L || !m || !g || !people) return;
    const seen = new Set<string>();
    const pts: [number, number][] = [];
    for (const p of people) {
      if (p.lat == null || p.lng == null) continue;
      seen.add(p.user_id);
      const st = statusOf(p, staleMin, now);
      const s = STATUS[st];
      const pos: [number, number] = [p.lat, p.lng];
      pts.push(pos);
      const tip = `<b>${esc([p.pangkat, p.nama].filter(Boolean).join(' '))}</b><br>${esc(p.unit)}<br>${s.label} · ${lalu(p.last_time, now)}${p.acc ? ` · ±${Math.round(p.acc)} m` : ''}${p.mock ? '<br><b style="color:#c81e3a">⚠ Lokasi palsu</b>' : ''}`;
      let t = byUser.current.get(p.user_id);
      if (!t) {
        t = { marker: L.marker(pos).on('click', () => setPicked(p.user_id)).bindTooltip(tip).addTo(g) };
        byUser.current.set(p.user_id, t);
      } else {
        glide(t, pos);
        t.marker.setTooltipContent(tip);
      }
      if (t.status !== st) {
        t.status = st;
        t.marker.setIcon(L.divIcon({ className: '', iconSize: [16, 16], html: `<div class="map-dot${st === 'aktif' ? ' track-live' : ''}" style="width:16px;height:16px;background:${s.color}"></div>` }));
        t.marker.setZIndexOffset(st === 'aktif' ? 500 : 0);
      }
    }
    for (const [id, t] of byUser.current) {
      if (seen.has(id)) continue;
      if (t.raf) cancelAnimationFrame(t.raf);
      g.removeLayer(t.marker);
      byUser.current.delete(id);
    }
    if (!fitted.current && pts.length && !home) {
      fitted.current = true;
      m.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 15 });
    }
    if (picked) byUser.current.get(picked)?.marker.openTooltip();
  }, [people, ready, picked, home, staleMin, now]);

  const focus = (id: string) => {
    setPicked(id);
    const t = byUser.current.get(id);
    if (t) map.current?.flyTo(t.marker.getLatLng(), Math.max(map.current.getZoom(), 16), { duration: 0.6 });
  };

  const list = (people ?? []).map((p) => ({ p, st: statusOf(p, staleMin, now) }));
  const count = (...s: LiveStatus[]) => list.filter((x) => s.includes(x.st)).length;
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 isolate bg-[#0b1626]">
        <div ref={el} className="map-under-bar map-attr-left absolute inset-0" />
        <div className={cn('pointer-events-none absolute bottom-3 left-3 z-[500] flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold shadow-md ring-1',
          conn === 'live' ? 'bg-surface/85 text-success ring-success/30' : 'bg-surface/85 text-warn ring-warn/30')}>
          <span className="relative flex size-2.5">
            {conn === 'live' && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60 motion-reduce:hidden" />}
            <span className={cn('relative inline-flex size-2.5 rounded-full', conn === 'live' ? 'bg-success' : 'bg-warn')} />
          </span>
          {conn === 'live' ? 'LIVE' : conn === 'connecting' ? 'Menyambungkan…' : 'Menyambung ulang…'}
        </div>
      </div>

      <aside className="map-glass-card absolute inset-x-3 bottom-3 z-[550] flex h-[42%] flex-col overflow-hidden lg:inset-x-auto lg:right-3 lg:top-3 lg:h-auto lg:w-[21rem]">
        <div className="border-b border-line p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            {([['Aktif', count('aktif'), 'text-success'], ['Terputus', count('terputus', 'belum_ada_titik'), 'text-warn'], ['Selesai', count('selesai'), 'text-muted']] as const).map(([l, v, c]) => (
              <div key={l} className="rounded-xl bg-surface-2 py-2">
                <div className={cn('text-xl font-bold tabular-nums', c)}>{people ? v : '–'}</div>
                <div className="text-[11px] text-muted">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
            <span>{conn === 'live' ? 'Posisi tampil begitu dikirim HP Bhabin' : 'Sambungan langsung terputus; dicoba lagi otomatis'} · terputus bila &gt; {staleMin} menit</span>
            <button type="button" onClick={refresh} className="rounded p-1 hover:bg-surface-2" aria-label="Muat ulang"><RefreshCw size={13} /></button>
          </div>
        </div>
        {error && <div className="m-3 rounded-lg bg-danger/10 p-3 text-xs text-danger">{error}</div>}
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {people && list.length === 0 && <li className="p-6 text-center text-sm text-muted">Belum ada Bhabin yang absen masuk hari ini.</li>}
          {list.map(({ p, st }) => {
            const s = STATUS[st];
            const fresh = now - (flash[p.user_id] ?? 0) < 2500;
            return (
              <li key={p.user_id}>
                <button type="button" onClick={() => focus(p.user_id)} disabled={p.lat == null}
                  className={cn('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-700 hover:bg-surface-2 disabled:cursor-default',
                    picked === p.user_id && 'bg-primary/5', fresh && 'bg-success/10')}>
                  <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', s.dot)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{[p.pangkat, p.nama].filter(Boolean).join(' ')}</span>
                    <span className="block truncate text-xs text-muted">{p.unit}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      Masuk {jam(p.check_in)}{p.check_out ? ` · pulang ${jam(p.check_out)}` : ` · ${s.label.toLowerCase()} · ${lalu(p.last_time, now)}`}
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
