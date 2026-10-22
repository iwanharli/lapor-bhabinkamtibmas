// Uji beban: N Bhabin (buat+foto+kirim laporan Sambang, daftar laporan, notifikasi) + M pimpinan (dashboard).
// node loadtest.mjs <jumlahBhabin> <jumlahPimpinan> <detik>
import { randomUUID } from 'crypto';
import { readFileSync, appendFileSync } from 'fs';
const [N = 100, M = 10, SECS = 60] = process.argv.slice(2).map(Number);
const API = process.env.API ?? 'http://localhost:3005/api/v1';
const DIR = new URL('.', import.meta.url).pathname; // lt-users.json const DIR = new URL('.', import.meta.url).pathname; lt-foto.jpg dari siapkan.mjs
const users = JSON.parse(readFileSync(DIR + 'lt-users.json', 'utf8'));
const photo = readFileSync(DIR + 'lt-foto.jpg');
const stats = new Map();
const rec = (name, ms, ok) => { const s = stats.get(name) ?? { t: [], err: 0 }; s.t.push(ms); if (!ok) s.err++; stats.set(name, s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const think = () => sleep(2000 + Math.random() * 3000);

async function req(name, tok, path, init = {}) {
  const t = performance.now();
  try {
    const r = await fetch(API + path, { ...init, headers: { ...(init.headers ?? {}), ...(tok && { authorization: `Bearer ${tok}` }) }, signal: AbortSignal.timeout(60000) });
    const body = r.status === 204 ? null : await r.json().catch(() => null);
    rec(name, performance.now() - t, r.ok);
    if (!r.ok) throw new Error(`${name} ${r.status} ${JSON.stringify(body).slice(0, 160)}`);
    return body;
  } catch (e) { if (!String(e.message).startsWith(name)) rec(name, performance.now() - t, false); throw e; }
}
const json = (b) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const login = (nrp) => req('login', null, '/auth/login', json({ nrp, password: 'Demo#12345' })).then((r) => r.accessToken);

const errors = new Map();
const noteErr = (e) => { const k = String(e.message).slice(0, 120); errors.set(k, (errors.get(k) ?? 0) + 1); };

async function bhabin(u, tok, until) {
  while (Date.now() < until) {
    try {
      const r = await req('buat laporan', tok, '/reports', json({
        clientUuid: randomUUID(), category: 'SAMBANG', schemaVersion: 1, villageId: u.village, occurredAt: new Date().toISOString(),
        location: { lat: u.lat + (Math.random() - 0.5) * 0.002, lng: u.lng + (Math.random() - 0.5) * 0.002 }, gpsAccuracyM: 12,
        data: { jenis_sasaran: 'Warga', nama_sasaran: 'Warga Uji Beban', alamat: 'RT 01/RW 02', pesan_kamtibmas: ['Narkoba'], tanggapan: 'Warga menyambut baik.' },
      }));
      appendFileSync(DIR + 'lt-created.txt', r.id + '\n');
      const fd = new FormData();
      fd.append('fieldKey', 'foto_bersama'); fd.append('clientUuid', randomUUID()); fd.append('source', 'CAMERA');
      fd.append('file', new Blob([photo], { type: 'image/jpeg' }), 'foto.jpg');
      await req('unggah foto', tok, `/reports/${r.id}/attachments`, { method: 'POST', body: fd });
      await req('kirim laporan', tok, `/reports/${r.id}/submit`, { method: 'POST' });
      await think();
      await req('daftar laporan saya', tok, '/reports?limit=20');
      await req('notifikasi (jumlah)', tok, '/notifications/unread-count');
      await think();
    } catch (e) { noteErr(e); await think(); }
  }
}

async function pimpinan(tok, until) {
  const d30 = encodeURIComponent(new Date(Date.now() - 30 * 864e5).toISOString());
  while (Date.now() < until) {
    try {
      await req('ringkasan', tok, `/analytics/overview?from=${d30}`);
      await req('peta', tok, `/analytics/map?from=${d30}&zoom=6&bbox=95,-11,141,6`);
      await req('daftar laporan', tok, '/reports?limit=20');
      await think();
    } catch (e) { noteErr(e); await think(); }
  }
}

// Login bertahap (bukan bagian beban utama: di HP sesi bertahan 30 hari).
const bs = users.bhabin.slice(0, N), ps = users.pimpinan.slice(0, M);
const toks = [];
for (let i = 0; i < bs.length + ps.length; i += 20) {
  const batch = [...bs, ...ps.map((nrp) => ({ nrp }))].slice(i, i + 20);
  toks.push(...await Promise.all(batch.map((u) => login(u.nrp).catch((e) => (noteErr(e), null)))));
}
const loginStats = stats.get('login'); stats.delete('login');
const t0 = Date.now(), until = t0 + SECS * 1000;
await Promise.all([
  ...bs.map((u, i) => toks[i] && sleep(Math.random() * 5000).then(() => bhabin(u, toks[i], until))),
  ...ps.map((_, i) => toks[bs.length + i] && sleep(Math.random() * 5000).then(() => pimpinan(toks[bs.length + i], until))),
]);
const dur = (Date.now() - t0) / 1000;
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
console.log(`\n${N} Bhabin + ${M} pimpinan, ${dur.toFixed(0)} detik`);
const lt = [...(loginStats?.t ?? [])].sort((a, b) => a - b);
console.log(`login (20 bersamaan)       n=${lt.length} p50 ${pct(lt, .5)?.toFixed(0)} ms  p95 ${pct(lt, .95)?.toFixed(0)} ms  gagal ${loginStats?.err ?? 0}`);
let total = 0;
for (const [name, s] of stats) {
  const t = s.t.sort((a, b) => a - b); total += t.length;
  console.log(`${name.padEnd(26)} n=${String(t.length).padEnd(5)} p50 ${pct(t, .5).toFixed(0).padStart(5)} ms  p95 ${pct(t, .95).toFixed(0).padStart(5)} ms  maks ${t.at(-1).toFixed(0).padStart(6)} ms  gagal ${s.err}`);
}
console.log(`total ${total} permintaan, ${(total / dur).toFixed(1)}/detik`);
for (const [k, v] of errors) console.log(`  galat ×${v}: ${k}`);
