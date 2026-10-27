// Unduh model pengenal wajah (OpenCV Zoo) ke backend/models bila belum ada, dengan cek SHA-256. Aman diulang.
//   npm run face:models
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const DIR = process.env.FACE_MODEL_DIR ?? resolve(process.cwd(), 'models');
const BASE = 'https://github.com/opencv/opencv_zoo/raw/main/models';
const MODELS = [
  { file: 'face_detection_yunet_2023mar.onnx', url: `${BASE}/face_detection_yunet/face_detection_yunet_2023mar.onnx`, sha256: '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4' },
  { file: 'face_recognition_sface_2021dec.onnx', url: `${BASE}/face_recognition_sface/face_recognition_sface_2021dec.onnx`, sha256: '0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79' },
];
const sha = (b) => createHash('sha256').update(b).digest('hex');

mkdirSync(DIR, { recursive: true });
for (const m of MODELS) {
  const path = resolve(DIR, m.file);
  if (existsSync(path) && sha(readFileSync(path)) === m.sha256) { console.log(`✓ ${m.file}`); continue; }
  const res = await fetch(m.url);
  if (!res.ok) throw new Error(`Gagal mengunduh ${m.file}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (sha(buf) !== m.sha256) throw new Error(`Checksum ${m.file} tidak cocok`);
  writeFileSync(path, buf);
  console.log(`↓ ${m.file} (${(buf.length / 1e6).toFixed(1)} MB)`);
}
