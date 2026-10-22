import sharp from 'sharp';

/** Sisi terpanjang foto lampiran setelah kompresi (px). */
export const PHOTO_MAX_EDGE = Number(process.env.PHOTO_MAX_EDGE ?? 1920);
/** Kualitas JPEG hasil kompresi (1–100). */
export const PHOTO_QUALITY = Number(process.env.PHOTO_QUALITY ?? 78);
/**
 * mozjpeg ±15× lebih lambat (±280 ms vs ±16 ms per foto 1600 px) demi berkas ±10% lebih kecil; saat banyak Bhabin
 * mengunggah bersamaan, kompresi jadi antrean. Default mati; nyalakan bila CPU longgar (PHOTO_MOZJPEG=true).
 */
const PHOTO_MOZJPEG = process.env.PHOTO_MOZJPEG === 'true';

/**
 * Kompres foto lampiran: putar sesuai orientasi kamera, perkecil ke PHOTO_MAX_EDGE,
 * simpan sebagai JPEG tanpa metadata EXIF — waktu & koordinat foto tetap di database.
 * Mengembalikan file asli bila penghematan < 10% — mencegah kompresi berulang yang menurunkan kualitas
 * (mis. foto yang sudah dikompres di perangkat atau dijalankan ulang lewat storage:compress) — KECUALI file asli
 * masih memuat metadata (EXIF/XMP: GPS, model HP, waktu): hasil olahan tetap dipakai agar metadata pasti terhapus.
 */
export async function compressPhoto(input: Buffer, mime: string): Promise<{ data: Buffer; mime: string; ext: string; compressed: boolean }> {
  const meta = await sharp(input, { failOn: 'error' }).metadata();
  const hasMetadata = !!(meta.exif || meta.xmp || meta.iptc || (meta.orientation && meta.orientation !== 1));
  const out = await sharp(input, { failOn: 'error' })
    .rotate()
    .resize(PHOTO_MAX_EDGE, PHOTO_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: PHOTO_QUALITY, mozjpeg: PHOTO_MOZJPEG })
    .toBuffer();
  if (hasMetadata || out.length < input.length * 0.9) return { data: out, mime: 'image/jpeg', ext: 'jpg', compressed: true };
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  return { data: input, mime, ext, compressed: false };
}

/** Thumbnail persegi 480 px (WebP) untuk daftar & galeri. */
export function thumbnail(input: Buffer) {
  return sharp(input).rotate().resize(480, 480, { fit: 'cover' }).webp({ quality: 72 }).toBuffer();
}
