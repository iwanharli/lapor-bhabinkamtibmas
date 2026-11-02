import type { Map as LeafletMap } from 'leaflet';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
/** Ubin satelit tidak merata di zoom tertinggi; di atas ini gambar diperbesar saja agar tidak muncul "data belum tersedia". */
const NATIVE_ZOOM = 18;

/**
 * Peta dasar satelit (Esri World Imagery + label tempat), dipakai semua peta.
 * Untuk server internal arahkan ke tile server sendiri lewat NEXT_PUBLIC_TILE_URL.
 */
export function addBaseLayers(L: typeof import('leaflet'), map: LeafletMap, attribution = '') {
  const opts = { maxZoom: 19, maxNativeZoom: NATIVE_ZOOM, referrerPolicy: 'strict-origin-when-cross-origin' as const };
  const own = process.env.NEXT_PUBLIC_TILE_URL;
  const credit = `${own ? '' : 'Citra &copy; Esri, Maxar, Earthstar Geographics'}${attribution ? ` · ${attribution}` : ''}`;
  L.tileLayer(own ?? `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, { ...opts, attribution: credit }).addTo(map);
  if (!own) L.tileLayer(`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { ...opts, opacity: 0.8 }).addTo(map);
}
