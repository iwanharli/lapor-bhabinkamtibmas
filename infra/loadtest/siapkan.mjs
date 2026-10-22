// Siapkan data uji beban: akun Bhabin acak (dengan desa binaan & titik tengah desa), akun pimpinan, dan foto contoh.
// Jalankan dari folder backend (butuh @prisma/client & sharp):  node ../infra/loadtest/siapkan.mjs
// JANGAN di produksi: uji beban membuat laporan sungguhan. Pakai server/database cadangan, lalu bersihkan (lihat README).
import { writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(process.cwd() + '/package.json');
const { PrismaClient } = require('@prisma/client');
const sharp = require('sharp');
const DIR = new URL('.', import.meta.url).pathname;
const p = new PrismaClient();
const bhabin = await p.$queryRawUnsafe(`
  SELECT u.nrp, v.id AS village, ST_Y(v.centroid::geometry) lat, ST_X(v.centroid::geometry) lng
  FROM users u JOIN user_villages uv ON uv.user_id = u.id AND uv.until IS NULL JOIN villages v ON v.id = uv.village_id
  WHERE u.role::text = 'BHABIN' AND u.active AND v.centroid IS NOT NULL ORDER BY random() LIMIT 1000`);
const pimpinan = (await p.$queryRawUnsafe(`SELECT nrp FROM users WHERE role::text = 'PIMPINAN' AND active ORDER BY random() LIMIT 100`)).map((x) => x.nrp);
writeFileSync(DIR + 'lt-users.json', JSON.stringify({ bhabin, pimpinan }));
// Foto 1600×1200 ±1 MB (setara foto HP yang sudah diperkecil aplikasi).
const w = 1600, h = 1200, buf = Buffer.alloc(w * h * 3);
for (let i = 0; i < buf.length; i++) buf[i] = (i * 31 + ((i / w) | 0) * 7) & 255;
await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 85 }).toFile(DIR + 'lt-foto.jpg');
console.log(`${bhabin.length} Bhabin, ${pimpinan.length} pimpinan, foto contoh siap.`);
await p.$disconnect();
