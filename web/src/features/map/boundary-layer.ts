import type { GeoJSON as GeoJSONLayer, Map as LeafletMap } from 'leaflet';

type Leaflet = typeof import('leaflet');
type Level = 1 | 2 | 3 | 4;

interface RegionProps { kode: string; nama: string; chain: string; level: Level }
interface Boundaries { type: 'FeatureCollection'; truncated: boolean; features: GeoJSON.Feature<GeoJSON.Geometry, RegionProps>[] }

export const LEVEL_LABEL: Record<Level, string> = { 1: 'Provinsi', 2: 'Kabupaten/Kota', 3: 'Kecamatan', 4: 'Desa/Kelurahan' };

/** Tingkat wilayah yang digambar untuk satu zoom. */
const levelFor = (zoom: number): Level => (zoom <= 6 ? 1 : zoom <= 8 ? 2 : zoom <= 11 ? 3 : 4);
const WEIGHT: Record<Level, number> = { 1: 1.6, 2: 1.3, 3: 1.1, 4: 1 };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Lapisan batas wilayah Kemendagri di bawah titik laporan: tingkatnya mengikuti zoom
 * (provinsi → kabupaten/kota → kecamatan → desa), dimuat ulang per bbox saat peta digeser,
 * dan panel rantai wilayah (provinsi › … › desa) untuk titik tengah peta.
 * Mengembalikan fungsi pembersih.
 */
export function attachBoundaries(L: Leaflet, map: LeafletMap): () => void {
  if (!map.getPane('batas')) map.createPane('batas').style.zIndex = '350';

  let layer: GeoJSONLayer | null = null;
  let abort: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const provinces: { data?: Boundaries } = {};

  const panel = new L.Control({ position: 'bottomleft' });
  const box = L.DomUtil.create('div');
  box.style.cssText =
    'background:rgba(255,255,255,.94);border-radius:10px;padding:6px 10px;font:12px/1.4 inherit;color:#0f172a;box-shadow:0 1px 4px rgba(15,23,42,.18);max-width:min(520px,70vw)';
  panel.onAdd = () => box;
  panel.addTo(map);

  const draw = (data: Boundaries, level: Level) => {
    layer?.remove();
    layer = L.geoJSON(data, {
      pane: 'batas',
      style: { color: '#1d4ed8', weight: WEIGHT[level], opacity: 0.75, fillColor: '#3b82f6', fillOpacity: 0.04 },
      onEachFeature: (f, l) => {
        const p = f.properties as RegionProps;
        l.bindTooltip(`<b>${esc(p.nama)}</b>${p.chain ? `<br><span style="color:#64748b">${esc(p.chain)}</span>` : ''}`, { sticky: true, direction: 'top' });
        l.on('mouseover', () => (l as L.Path).setStyle({ fillOpacity: 0.14, weight: WEIGHT[level] + 1 }));
        l.on('mouseout', () => layer?.resetStyle(l as L.Path));
      },
    }).addTo(map);
  };

  const refresh = async () => {
    abort?.abort();
    abort = new AbortController();
    const { signal } = abort;
    const level = levelFor(map.getZoom());
    const b = map.getBounds().pad(0.25);
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(4)).join(',');
    const c = map.getCenter();
    try {
      const [data, chain] = await Promise.all([
        level === 1 && provinces.data
          ? provinces.data
          : get<Boundaries>(`/regions/boundaries?level=${level}${level === 1 ? '' : `&bbox=${bbox}`}`, signal),
        get<RegionProps[]>(`/regions/at?lat=${c.lat.toFixed(5)}&lng=${c.lng.toFixed(5)}`, signal),
      ]);
      if (level === 1) provinces.data = data;
      draw(data, level);
      const trail = chain.map((r) => esc(r.nama)).join(' <span style="color:#94a3b8">›</span> ');
      box.innerHTML = `<div style="font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:#64748b">Batas ${LEVEL_LABEL[level]}${
        data.truncated ? ' · perbesar untuk melihat semua' : ''
      }${level === 4 && !data.features.length ? ' · data desa belum diimpor di area ini' : ''}</div>${trail || (level === 1 ? `Indonesia · ${data.features.length} provinsi` : '<span style="color:#64748b">Di luar wilayah administrasi</span>')}`;
    } catch (e) {
      if ((e as Error).name !== 'AbortError') box.textContent = 'Batas wilayah tidak dapat dimuat';
    }
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 250);
  };
  map.on('moveend', schedule);
  refresh();

  return () => {
    clearTimeout(timer);
    abort?.abort();
    map.off('moveend', schedule);
    layer?.remove();
    panel.remove();
  };
}
