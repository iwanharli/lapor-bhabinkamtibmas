import type { LatLng, Map as LeafletMap, Polygon } from 'leaflet';

type Leaflet = typeof import('leaflet');

/** Bentuk wilayah terpilih dari /regions/shape atau /units/shape. */
export interface FocusShape { nama?: string; bbox: [number, number, number, number]; geometry: GeoJSON.Geometry }

/** Cincin luar setiap poligon (lubang di dalam wilayah diabaikan). */
function outerRings(g: GeoJSON.Geometry): [number, number][][] {
  if (g.type === 'Polygon') return g.coordinates[0] ? [g.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])] : [];
  if (g.type === 'MultiPolygon') return g.coordinates.flatMap((p) => (p[0] ? [p[0].map(([lng, lat]) => [lat, lng] as [number, number])] : []));
  if (g.type === 'GeometryCollection') return g.geometries.flatMap(outerRings);
  return [];
}

const WORLD: [number, number][] = [[-85, -180], [-85, 180], [85, 180], [85, -180]];

/**
 * Sorotan wilayah terpilih: area di luar wilayah digelapkan (lapisan peta, ikut animasi zoom) dan diburamkan
 * (lapisan backdrop-filter di atas peta yang dilubangi bentuk wilayah lewat clip-path), dengan garis tepi menyala
 * dan isi biru transparan yang "bernapas" pelan (globals.css .map-focus-line).
 */
export function attachFocus(L: Leaflet, map: LeafletMap) {
  if (!map.getPane('regionMask')) map.createPane('regionMask').style.zIndex = '360';
  if (!map.getPane('regionLine')) map.createPane('regionLine').style.zIndex = '370';

  const veil = L.DomUtil.create('div', 'map-focus-veil', map.getContainer());
  let rings: LatLng[][] = [];
  let mask: Polygon | null = null;
  let line: Polygon | null = null;

  const redraw = () => {
    if (!rings.length) {
      veil.style.opacity = '0';
      return;
    }
    const { x: w, y: h } = map.getSize();
    let d = `M0 0H${w}V${h}H0Z`;
    for (const ring of rings) {
      let last: { x: number; y: number } | null = null;
      let seg = '';
      for (const ll of ring) {
        const p = map.latLngToContainerPoint(ll);
        if (last && Math.abs(p.x - last.x) < 1.5 && Math.abs(p.y - last.y) < 1.5) continue; // titik rapat di layar tak perlu
        seg += `${seg ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        last = p;
      }
      if (seg) d += `${seg}Z`;
    }
    veil.style.clipPath = `path(evenodd, "${d}")`;
    veil.style.opacity = '1';
  };
  // Animasi zoom Leaflet memakai transform CSS: sembunyikan blur sejenak, gambar ulang setelah selesai.
  const hide = () => (veil.style.opacity = '0');
  map.on('move resize viewreset', redraw);
  map.on('zoomanim', hide);
  map.on('zoomend', redraw);

  return {
    set(shape: FocusShape | null) {
      mask?.remove();
      line?.remove();
      mask = line = null;
      rings = [];
      if (shape) {
        const latlngs = outerRings(shape.geometry);
        rings = latlngs.map((r) => r.map(([lat, lng]) => L.latLng(lat, lng)));
        mask = L.polygon([WORLD, ...latlngs], { pane: 'regionMask', stroke: false, fillColor: '#081325', fillOpacity: 0.42, interactive: false, fillRule: 'evenodd' }).addTo(map);
        line = L.polygon(latlngs, { pane: 'regionLine', color: '#3b82f6', weight: 3, opacity: 0.95, fillColor: '#3b82f6', fillOpacity: 0.12, interactive: false, className: 'map-focus-line' }).addTo(map);
      }
      // Peredup "luar Indonesia" (boundary-layer) memakai batas provinsi tersederhana yang saling tumpang-tindih
      // sehingga muncul pita gelap; selama ada sorotan wilayah lapisan itu tidak diperlukan.
      const indonesiaMask = map.getPane('focusMask');
      if (indonesiaMask) indonesiaMask.style.display = shape ? 'none' : '';
      redraw();
    },
    detach() {
      map.off('move resize viewreset', redraw);
      map.off('zoomanim', hide);
      map.off('zoomend', redraw);
      mask?.remove();
      line?.remove();
      veil.remove();
    },
  };
}
