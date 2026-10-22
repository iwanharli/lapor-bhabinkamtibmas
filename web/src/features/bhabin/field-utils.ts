'use client';

import { useCallback, useState } from 'react';

/** Sisi terpanjang foto setelah diperkecil di perangkat (hemat kuota di lapangan). */
const MAX_EDGE = 1600;

/** Perkecil foto di browser (JPEG ±0,8) sebelum diunggah; PDF/berkas lain dikembalikan apa adanya. */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** Unggah multipart lewat BFF; melempar Error dengan pesan siap tampil. */
export async function uploadForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.error;
    throw new Error((err?.message ?? 'Unggahan gagal') + (Array.isArray(err?.details) ? `: ${err.details.join('; ')}` : ''));
  }
  return body as T;
}

export interface GeoFix { lat: number; lng: number; accuracy: number; at: number }

const GEO_ERROR: Record<number, string> = {
  1: 'Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan browser.',
  2: 'Lokasi tidak tersedia. Pastikan GPS aktif dan coba di tempat terbuka.',
  3: 'Waktu habis mencari lokasi. Coba lagi.',
};

/** Ambil titik GPS dari browser (akurasi tinggi). Perlu HTTPS atau localhost. */
export function useGeolocation() {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const locate = useCallback(
    () =>
      new Promise<GeoFix | null>((resolve) => {
        if (!('geolocation' in navigator)) {
          setError('Browser ini tidak mendukung lokasi.');
          return resolve(null);
        }
        setBusy(true);
        setError('');
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const f = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy), at: Date.now() };
            setFix(f);
            setBusy(false);
            resolve(f);
          },
          (e) => {
            setError(GEO_ERROR[e.code] ?? 'Lokasi gagal diambil.');
            setBusy(false);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 },
        );
      }),
    [],
  );

  return { fix, error, busy, locate };
}

/** UUID untuk idempotensi (crypto.randomUUID butuh konteks aman; ada cadangan). */
export const newUuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
