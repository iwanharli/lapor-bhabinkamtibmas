import { resolve } from 'path';
import type { InferenceSession, Tensor } from 'onnxruntime-node';
import sharp from 'sharp';

/**
 * Mesin pengenal wajah di server (tanpa layanan pihak ketiga), model OpenCV Zoo berlisensi permisif:
 * - YuNet (face_detection_yunet_2023mar, MIT): kotak wajah + 5 titik (mata, hidung, sudut mulut).
 * - SFace (face_recognition_sface_2021dec, Apache-2.0): sidik wajah 128 dimensi dari wajah 112×112 yang diluruskan.
 * Pencocokan memakai kemiripan kosinus (ambang bawaan OpenCV 0,363 untuk orang yang sama).
 */
const MODEL_DIR = process.env.FACE_MODEL_DIR ?? resolve(process.cwd(), 'models');
const DET_SIZE = 640;
const STRIDES = [8, 16, 32];
const SCORE_MIN = 0.7;
/** Titik acuan wajah 112×112 (ArcFace/SFace) untuk mata kanan, mata kiri, hidung, mulut kanan, mulut kiri. */
const TEMPLATE: [number, number][] = [[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]];

export interface DetectedFace {
  box: [number, number, number, number]; // x, y, w, h (piksel gambar asli)
  landmarks: [number, number][]; // 5 titik
  score: number;
  /** Perkiraan arah hadap: negatif = menoleh ke kiri pengguna, positif = ke kanan (dari posisi hidung terhadap kedua mata). */
  yaw: number;
}

let ort: typeof import('onnxruntime-node') | undefined;
let detector: Promise<InferenceSession> | undefined;
let recognizer: Promise<InferenceSession> | undefined;
const load = async (file: string) => {
  ort ??= await import('onnxruntime-node');
  return ort.InferenceSession.create(resolve(MODEL_DIR, file), { logSeverityLevel: 3 });
};

/** Gambar → piksel RGB mentah, diputar sesuai EXIF (foto HP), dikecilkan maks. 1280 px agar cepat. */
async function decode(image: Buffer) {
  const { data, info } = await sharp(image).rotate().resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgb: data, width: info.width, height: info.height };
}

export async function detectFaces(image: Buffer): Promise<{ faces: DetectedFace[]; rgb: Buffer; width: number; height: number }> {
  const { rgb, width, height } = await decode(image);
  const scale = Math.min(DET_SIZE / width, DET_SIZE / height);
  const w = Math.round(width * scale), h = Math.round(height * scale);
  // YuNet: masukan BGR 0–255, NCHW 640×640 (sisi kosong diisi hitam).
  const small = await sharp(rgb, { raw: { width, height, channels: 3 } }).resize(w, h).raw().toBuffer();
  const input = new Float32Array(3 * DET_SIZE * DET_SIZE);
  const plane = DET_SIZE * DET_SIZE;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 3, d = y * DET_SIZE + x;
      input[d] = small[s + 2]; input[plane + d] = small[s + 1]; input[2 * plane + d] = small[s];
    }
  }
  detector ??= load('face_detection_yunet_2023mar.onnx');
  const sess = await detector;
  const out = await sess.run({ [sess.inputNames[0]]: new ort!.Tensor('float32', input, [1, 3, DET_SIZE, DET_SIZE]) });
  const get = (k: string) => (out[k] as Tensor).data as Float32Array;

  const found: DetectedFace[] = [];
  for (const s of STRIDES) {
    const cols = DET_SIZE / s, rows = DET_SIZE / s;
    const cls = get(`cls_${s}`), obj = get(`obj_${s}`), bbox = get(`bbox_${s}`), kps = get(`kps_${s}`);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const score = Math.sqrt(Math.min(Math.max(cls[i], 0), 1) * Math.min(Math.max(obj[i], 0), 1));
        if (score < SCORE_MIN) continue;
        const cx = (c + bbox[i * 4]) * s, cy = (r + bbox[i * 4 + 1]) * s;
        const bw = Math.exp(bbox[i * 4 + 2]) * s, bh = Math.exp(bbox[i * 4 + 3]) * s;
        const lm: [number, number][] = [];
        for (let k = 0; k < 5; k++) lm.push([((kps[i * 10 + 2 * k] + c) * s) / scale, ((kps[i * 10 + 2 * k + 1] + r) * s) / scale]);
        const box: [number, number, number, number] = [(cx - bw / 2) / scale, (cy - bh / 2) / scale, bw / scale, bh / scale];
        found.push({ box, landmarks: lm, score, yaw: yawOf(lm) });
      }
    }
  }
  return { faces: nms(found), rgb, width, height };
}

/** Rasio posisi hidung di antara kedua mata, -1..1 (0 = menghadap depan). */
function yawOf(lm: [number, number][]) {
  const [eyeR, eyeL, nose] = lm;
  const mid = (eyeR[0] + eyeL[0]) / 2;
  const half = Math.abs(eyeL[0] - eyeR[0]) / 2 || 1;
  return (nose[0] - mid) / half;
}

function iou(a: DetectedFace['box'], b: DetectedFace['box']) {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[0] + a[2], b[0] + b[2]), y2 = Math.min(a[1] + a[3], b[1] + b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return inter / (a[2] * a[3] + b[2] * b[3] - inter || 1);
}

function nms(faces: DetectedFace[]) {
  const sorted = [...faces].sort((a, b) => b.score - a.score);
  const keep: DetectedFace[] = [];
  for (const f of sorted) if (keep.every((k) => iou(k.box, f.box) < 0.3)) keep.push(f);
  return keep;
}

/** Transformasi kesamaan (Umeyama) dari 5 titik wajah ke titik acuan: [a, -b, tx; b, a, ty]. */
function similarity(src: [number, number][], dst: [number, number][]) {
  const n = src.length;
  const ms = src.reduce((m, p) => [m[0] + p[0] / n, m[1] + p[1] / n], [0, 0]);
  const md = dst.reduce((m, p) => [m[0] + p[0] / n, m[1] + p[1] / n], [0, 0]);
  let sxx = 0, sxy = 0, var_ = 0;
  for (let i = 0; i < n; i++) {
    const x = src[i][0] - ms[0], y = src[i][1] - ms[1];
    const u = dst[i][0] - md[0], v = dst[i][1] - md[1];
    sxx += x * u + y * v; sxy += x * v - y * u; var_ += x * x + y * y;
  }
  const a = sxx / var_, b = sxy / var_;
  return { a, b, tx: md[0] - (a * ms[0] - b * ms[1]), ty: md[1] - (b * ms[0] + a * ms[1]) };
}

/** Potong & luruskan wajah ke 112×112 (interpolasi bilinear, pemetaan balik). */
function align(rgb: Buffer, width: number, height: number, landmarks: [number, number][]) {
  const { a, b, tx, ty } = similarity(landmarks, TEMPLATE);
  const det = a * a + b * b;
  const out = Buffer.alloc(112 * 112 * 3);
  for (let y = 0; y < 112; y++) {
    for (let x = 0; x < 112; x++) {
      // invers [a -b; b a]: (1/det)[a b; -b a]
      const dx = x - tx, dy = y - ty;
      const sx = (a * dx + b * dy) / det, sy = (-b * dx + a * dy) / det;
      const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
      for (let ch = 0; ch < 3; ch++) {
        const px = (xx: number, yy: number) => (xx < 0 || yy < 0 || xx >= width || yy >= height ? 0 : rgb[(yy * width + xx) * 3 + ch]);
        const v = px(x0, y0) * (1 - fx) * (1 - fy) + px(x0 + 1, y0) * fx * (1 - fy) + px(x0, y0 + 1) * (1 - fx) * fy + px(x0 + 1, y0 + 1) * fx * fy;
        out[(y * 112 + x) * 3 + ch] = Math.round(v);
      }
    }
  }
  return out;
}

/** Sidik wajah ternormalisasi (panjang 1) dari wajah yang sudah dideteksi. */
export async function embed(rgb: Buffer, width: number, height: number, face: DetectedFace): Promise<Float32Array> {
  const crop = align(rgb, width, height, face.landmarks);
  // SFace (blobFromImage swapRB=true dari BGR) = masukan RGB 0–255, NCHW.
  const input = new Float32Array(3 * 112 * 112);
  const plane = 112 * 112;
  for (let i = 0; i < plane; i++) {
    input[i] = crop[i * 3]; input[plane + i] = crop[i * 3 + 1]; input[2 * plane + i] = crop[i * 3 + 2];
  }
  recognizer ??= load('face_recognition_sface_2021dec.onnx');
  const sess = await recognizer;
  const out = await sess.run({ [sess.inputNames[0]]: new ort!.Tensor('float32', input, [1, 3, 112, 112]) });
  const v = Float32Array.from((out[sess.outputNames[0]] as Tensor).data as Float32Array);
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

export const cosine = (a: Float32Array, b: Float32Array) => a.reduce((s, x, i) => s + x * b[i], 0);
