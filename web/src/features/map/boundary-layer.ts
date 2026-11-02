import type { GeoJSON as GeoJSONLayer, Map as LeafletMap } from 'leaflet';

type Leaflet = typeof import('leaflet');
type Level = 1 | 2 | 3 | 4;

interface RegionProps { kode: string; nama: string; chain: string; level: Level }
interface Boundaries { type: 'FeatureCollection'; truncated: boolean; features: GeoJSON.Feature<GeoJSON.Geometry, RegionProps>[] }

export const LEVEL_LABEL: Record<Level, string> = { 1: 'Provinsi', 2: 'Kabupaten/Kota', 3: 'Kecamatan', 4: 'Desa/Kelurahan' };

const WEIGHT: Record<Level, number> = { 1: 1.6, 2: 1.3, 3: 1.1, 4: 1 };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Lapisan batas wilayah Kemendagri di bawah titik laporan, bertingkat seperti drilldown: klik satu wilayah untuk membuka
 * wilayah di dalamnya (provinsi → kabupaten/kota → kecamatan → desa). Desa tidak punya anak, jadi tetap tampil di antara
 * desa sekecamatan. Panel kiri bawah menampilkan satuan Polri yang mencakup wilayah terbuka.
 */
export function attachBoundaries(L: Leaflet, map: LeafletMap, onOpen: (kode: string) => void) {
  if (!map.getPane('batas')) map.createPane('batas').style.zIndex = '350';
  if (!map.getPane('focusMask')) map.createPane('focusMask').style.zIndex = '300';

  let layer: GeoJSONLayer | null = null;
  let focusMask: ReturnType<typeof L.polygon> | null = null;
  let abort: AbortController | null = null;
  const provinces: { data?: Boundaries } = {};

  const addFocusMask = (data: Boundaries) => {
    const holes: [number, number][][] = [];
    const addGeometry = (geometry: GeoJSON.Geometry) => {
      if (geometry.type === 'Polygon') {
        const ring = geometry.coordinates[0];
        if (ring?.length) holes.push(ring.map(([lng, lat]) => [lat, lng] as [number, number]));
      } else if (geometry.type === 'MultiPolygon') {
        for (const polygon of geometry.coordinates) {
          const ring = polygon[0];
          if (ring?.length) holes.push(ring.map(([lng, lat]) => [lat, lng] as [number, number]));
        }
      } else if (geometry.type === 'GeometryCollection') {
        for (const child of geometry.geometries) addGeometry(child);
      }
    };
    for (const feature of data.features) addGeometry(feature.geometry);

    focusMask?.remove();
    if (!holes.length) return;
    const world: [number, number][] = [[-85, -180], [-85, 180], [85, 180], [85, -180]];
    focusMask = L.polygon([world, ...holes], {
      pane: 'focusMask',
      stroke: false,
      fillColor: '#0b1728',
      fillOpacity: 0.34,
      interactive: false,
      fillRule: 'evenodd',
    }).addTo(map);
  };

  const maskAbort = new AbortController();
  get<Boundaries>('/regions/boundaries?level=1', maskAbort.signal)
    .then((data) => {
      provinces.data = data;
      addFocusMask(data);
    })
    .catch(() => undefined);

  // Panel kaca di kiri bawah, di atas dok prioritas (posisi bawah mengikuti --strip-h, lihat globals.css).
  const panel = new L.Control({ position: 'bottomleft' });
  const box = L.DomUtil.create('div');
  box.className = 'map-glass-card';
  box.style.cssText = 'margin:0 0 10px 12px;padding:7px 13px;font-size:12px;line-height:1.4;color:var(--ink);max-width:min(460px,70vw)';
  panel.onAdd = () => box;
  panel.addTo(map);

  const draw = (data: Boundaries, level: Level) => {
    layer?.remove();
    layer = L.geoJSON(data, {
      pane: 'batas',
      style: { color: '#ffffff', weight: WEIGHT[level], opacity: 0.85, fillColor: '#fbbf24', fillOpacity: 0.03 },
      onEachFeature: (f, l) => {
        const p = f.properties as RegionProps;
        l.bindTooltip(`<b>${esc(p.nama)}</b>`, { sticky: true, direction: 'top' });
        l.on('mouseover', () => (l as L.Path).setStyle({ color: '#fbbf24', fillOpacity: 0.2, weight: WEIGHT[level] + 1 }));
        l.on('mouseout', () => layer?.resetStyle(l as L.Path));
        l.on('click', () => onOpen(p.kode));
      },
    }).addTo(map);
  };

  /** Tampilkan anak wilayah `kode` (kosong: provinsi). */
  const setArea = async (kode?: string) => {
    abort?.abort();
    abort = new AbortController();
    const { signal } = abort;
    const depth = kode ? kode.split('.').length : 0;
    const level = Math.min(depth + 1, 4) as Level;
    const parent = kode?.split('.').slice(0, 3).join('.');
    try {
      const [data, units] = await Promise.all([
        !kode && provinces.data ? provinces.data : get<Boundaries>(`/regions/boundaries?level=${level}${parent ? `&parent=${parent}` : ''}`, signal),
        kode ? get<{ kind: string; name: string }[]>(`/regions/polri?kode=${kode}`, signal) : [],
      ]);
      if (!kode) provinces.data = data;
      draw(data, level);
      const trail = units.map((u) => esc(u.name)).join(' <span style="color:var(--muted)">›</span> ');
      box.innerHTML = `<div style="font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)">${data.features.length} ${LEVEL_LABEL[level]} · klik untuk membuka</div>${trail || (kode ? '<span style="color:var(--muted)">Satuan Polri belum terpetakan</span>' : 'Indonesia')}`;
    } catch (e) {
      if ((e as Error).name !== 'AbortError') box.textContent = 'Batas wilayah tidak dapat dimuat';
    }
  };

  return {
    setArea,
    detach() {
      abort?.abort();
      maskAbort.abort();
      layer?.remove();
      focusMask?.remove();
      panel.remove();
    },
  };
}
