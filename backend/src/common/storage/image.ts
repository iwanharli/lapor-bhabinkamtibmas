import sharp from 'sharp';

/** Sisi terpanjang foto lampiran setelah kompresi (px). */
export const PHOTO_MAX_EDGE = Number(process.env.PHOTO_MAX_EDGE ?? 1920);
/** Kualitas JPEG hasil kompresi (1–100). */
export const PHOTO_QUALITY = Number(process.env.PHOTO_QUALITY ?? 78);

/**
 * Kompres foto lampiran: putar sesuai orientasi kamera, perkecil ke PHOTO_MAX_EDGE,
 * simpan sebagai JPEG (mozjpeg) tanpa metadata EXIF — waktu & koordinat foto tetap di database.
 * Mengembalikan file asli bila penghematan < 10% — mencegah kompresi berulang yang menurunkan kualitas
 * (mis. foto yang sudah dikompres di perangkat atau dijalankan ulang lewat storage:compress).
 */
export async function compressPhoto(input: Buffer, mime: string): Promise<{ data: Buffer; mime: string; ext: string; compressed: boolean }> {
  const out = await sharp(input, { failOn: 'error' })
    .rotate()
    .resize(PHOTO_MAX_EDGE, PHOTO_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: PHOTO_QUALITY, mozjpeg: true })
    .toBuffer();
  if (out.length < input.length * 0.9) return { data: out, mime: 'image/jpeg', ext: 'jpg', compressed: true };
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  return { data: input, mime, ext, compressed: false };
}

/** Thumbnail persegi 480 px (WebP) untuk daftar & galeri. */
export function thumbnail(input: Buffer) {
  return sharp(input).rotate().resize(480, 480, { fit: 'cover' }).webp({ quality: 72 }).toBuffer();
}
