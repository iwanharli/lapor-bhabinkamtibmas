# Panduan API Integrasi Command Center

Panduan untuk dua pihak:

- **Tim pengembang Baharkam Command Center (Pusat)**: cara memanggil API, arti setiap kolom, dan cara sinkron yang benar (bagian 3–8).
- **Superadmin instance Polda**: cara menyiapkan akun, menerbitkan token, dan mencabutnya (bagian 2).

API ini **baca-saja**. Pusat hanya menarik data, tidak bisa menulis, mengubah, atau menghapus apa pun di instance Polda.

---

## 1. Ringkasan

| Hal | Ketentuan |
|---|---|
| Alamat dasar | `https://<domain-instance-polda>/api/v1/integration` |
| Metode | `GET` saja |
| Autentikasi | Header `Authorization: Bearer lbi_…` (token integrasi) |
| Pembatasan | IP/CIDR yang didaftarkan pada token, atau `INTEGRATION_ALLOWED_IPS` bila token tidak punya daftar. Bila keduanya kosong, semua IP diizinkan |
| Batas laju | 120 permintaan/menit per IP (bawaan, bisa diubah instance) |
| Format | JSON UTF-8. Waktu ISO 8601 dengan offset zona, mis. `2026-10-25T08:30:00+07:00` |
| Paginasi | Kursor: `limit` (bawaan 500, maks. 2000) dan `cursor` |
| Sinkron bertahap | `updatedSince` (ISO 8601) |

Daftar endpoint:

| Endpoint | Isi | `updatedSince` | Paginasi |
|---|---|---|---|
| `GET /units` | Pohon unit organisasi | – | – (semua sekaligus) |
| `GET /villages` | Desa/kelurahan binaan | ✓ | ✓ |
| `GET /bhabins` | Data Bhabinkamtibmas | ✓ | ✓ |
| `GET /reports` | Laporan kegiatan | ✓ | ✓ |
| `GET /attendance` | Absensi harian | ✓ | ✓ |
| `GET /prices` | Harga pangan harian | ✓ | ✓ |
| `GET /commodities` | Daftar komoditas | – | – (semua sekaligus) |
| `GET /family-summary` | Ringkasan keluarga & stunting per desa | ✓ | ✓ |

---

## 2. Menyiapkan akses (Superadmin instance Polda)

### 2.1 Terbitkan token
1. Buka **Administrasi › Token Integrasi** (hanya terlihat oleh Superadmin).
2. Klik **Buat token**, lalu isi:
   - **Nama**: penanda pemakai token, mis. `Pusat produksi` atau `Pusat staging`.
   - **IP diizinkan**: IP publik server Pusat, satu per baris. Boleh CIDR, mis. `10.9.0.0/16`.
3. Klik **Buat token**. **Klik token untuk menyalin**, lalu kirim ke tim Pusat lewat kanal aman. Jangan kirim lewat chat grup atau email biasa.

Token dimiliki oleh Superadmin yang membuatnya. Aplikasi lain hanya memakai token bearer untuk membaca API; token tidak memerlukan akun Integrasi terpisah. Token yang belum dicabut bisa **disalin lagi kapan saja** dengan mengklik token di daftar. Setiap penyalinan tercatat di audit log (`INTEGRATION_TOKEN_COPIED`). Menonaktifkan akun pemilik akan memblokir tokennya.

> **IP kosong?** Token memakai daftar bawaan server `INTEGRATION_ALLOWED_IPS`. Jika daftar token dan daftar bawaan server sama-sama kosong, token dapat dipakai dari **semua IP**. Batasi IP pada token atau isi `INTEGRATION_ALLOWED_IPS` bila akses harus dibatasi.

### 2.2 Mengubah IP, rotasi, dan pencabutan

| Kebutuhan | Langkah |
|---|---|
| IP server Pusat berubah | Klik **Ubah** pada token, perbarui daftar IP, lalu simpan. Berlaku seketika |
| Rotasi berkala | Buat token baru → Pusat memasang token baru → pastikan kolom "Terakhir dipakai" token baru terisi → **Cabut** token lama |
| Token bocor | **Cabut** segera. Token langsung ditolak (401) dan tidak bisa dipulihkan |

Kolom **Terakhir dipakai** diperbarui paling sering sekali per menit.

### 2.3 Lewat server (cadangan)
Jika web tidak bisa diakses, jalankan di folder `backend`:

```bash
npm run integrasi:token -- buat --nrp 00000001 --nama "Pusat produksi" --ip 203.0.113.10,10.9.0.0/16
npm run integrasi:token -- daftar
npm run integrasi:token -- cabut lbi_AbCdEfGh      # prefix 12 karakter, atau id token
```

Variabel lingkungan terkait (berkas `.env` backend):

```env
INTEGRATION_ALLOWED_IPS=203.0.113.10     # daftar bawaan untuk token tanpa IP sendiri
INTEGRATION_RATE_LIMIT=120               # permintaan/menit per IP
TRUST_PROXY=loopback                     # wajib benar agar IP asli Pusat terbaca di balik reverse proxy
```

> **Penting:** jika API berada di balik nginx atau load balancer, pastikan `X-Forwarded-For` diteruskan dan `TRUST_PROXY` mencakup proksi itu. Tanpa itu, IP yang terbaca adalah IP proksi, sehingga allowlist tidak berfungsi sebagaimana mestinya.

---

## 3. Memanggil API

### 3.1 Contoh paling sederhana

```bash
TOKEN='lbi_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
BASE='https://lapor.polda-contoh.go.id/api/v1/integration'

curl -s -H "Authorization: Bearer $TOKEN" "$BASE/units"
```

### 3.2 Bentuk respons

Semua endpoint mengembalikan bentuk yang sama:

```json
{
  "data": [ { "...": "..." } ],
  "nextCursor": "eyJ1IjoiMjAyNi0xMC0yNVQwMTozMDowMC4xMjM0NTZaIiwiaSI6Ii4uLiJ9",
  "generatedAt": "2026-10-26T09:00:00+07:00"
}
```

- `data`: baris hasil.
- `nextCursor`: kirim sebagai `cursor` untuk halaman berikutnya. `null` berarti sudah habis.
- `generatedAt`: waktu server saat respons dibuat, dalam zona instance.

### 3.3 Paginasi kursor

Baris selalu diurutkan berdasarkan **`updatedAt` lalu `id`**. Untuk mengambil semua data:

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/reports?limit=1000"
# ambil nextCursor dari respons, lalu:
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/reports?limit=1000&cursor=<nextCursor>"
# ulangi sampai nextCursor = null
```

Aturan kursor:
- Kursor bersifat **opaque**. Jangan diurai atau dibuat sendiri.
- Saat memakai kursor, kirim lagi **filter yang sama** (`updatedSince`, `category`, `from`, `to`, dst.) seperti permintaan pertama.
- Kursor tidak kedaluwarsa, tetapi berlaku untuk filter yang sama saja.

### 3.4 Sinkron bertahap (`updatedSince`)

`updatedSince` mengembalikan baris dengan `updatedAt >= updatedSince`, yaitu baris yang dibuat atau berubah sejak waktu itu.

Pola yang disarankan untuk setiap endpoint:

1. **Tarik awal**: tanpa `updatedSince`, telusuri semua halaman.
2. Simpan **`updatedAt` terbesar** yang diterima sebagai *watermark* endpoint itu.
3. **Tarik berkala** (mis. tiap 5 menit): `updatedSince = watermark − 5 menit`, telusuri semua halaman, lalu perbarui watermark.
4. Simpan baris dengan **upsert berdasarkan `id`**. Baris yang terkirim dua kali aman.

Jendela tumpang-tindih (−5 menit) menjaga dari transaksi yang selesai sedikit terlambat di server. Tanpa jendela itu, baris bisa terlewat.

### 3.5 Data terhapus atau dibatalkan
- `reports` dan `prices` memuat `deleted: true` untuk laporan yang **ditolak** (status `REJECTED`). Hapus atau sembunyikan baris itu di Pusat.
- Draft tidak pernah dikirim. Hanya draft yang bisa dihapus permanen di instance, jadi tidak ada baris terkirim yang tiba-tiba hilang, kecuali kasus harga di bagian 4.6.
- Bhabin yang dinonaktifkan tetap dikirim dengan `aktif: false`.
- Unit yang dihapus tidak muncul lagi di `/units`. Bandingkan dengan daftar sebelumnya.

---

## 4. Referensi endpoint

Konvensi umum:
- **`id` berupa UUID** yang stabil dan tidak berubah. Kode yang mudah dibaca ada di kolom terpisah (`kode`, `nrp`, `nomor`, `kodeDesa`).
- Kolom rujukan (`polsekId`, `desaId`, `bhabinId`, `parentId`) berisi `id` dari endpoint terkait.
- Parameter tanggal (`date`, `from`, `to`) berformat `YYYY-MM-DD` dan dihitung sebagai **tanggal lokal unit** (WIB/WITA/WIT). `date` sama dengan `from` dan `to` pada hari yang sama. `from`/`to` inklusif.
- Parameter yang tidak dikenal ditolak dengan `400`.

### 4.1 `GET /units`

Pohon unit organisasi instance. Tanpa paginasi.

```json
{
  "id": "1a1e9375-c62f-44d0-9e72-e2b8ea57badf",
  "kode": "POLDA-31",
  "level": "POLDA",
  "nama": "Polda Metro Jaya",
  "parentId": "7f3c3a0d-a64b-4fd2-aa65-9f8d6e73bde9",
  "zonaWaktu": "Asia/Jakarta",
  "kodePolda": "POLDA-31"
}
```

| Kolom | Tipe | Arti |
|---|---|---|
| `id` | UUID | ID unit |
| `kode` | string | Kode unit di instance |
| `level` | `MABES` \| `POLDA` \| `POLRES` \| `POLSEK` | Tingkat |
| `nama` | string | Nama unit |
| `parentId` | UUID \| null | Unit induk |
| `zonaWaktu` | `Asia/Jakarta` \| `Asia/Makassar` \| `Asia/Jayapura` | Zona waktu unit (WIB/WITA/WIT) |
| `kodePolda` | string \| null | `kode` unit Polda leluhurnya, untuk pemetaan di Pusat. `null` untuk unit di atas Polda |

### 4.2 `GET /villages`

Parameter: `updatedSince`, `limit`, `cursor`.

```json
{
  "id": "37d6b684-084b-4f22-b78e-7cdf5edf2a55",
  "nama": "Gubeng",
  "kodeKabupaten": "3578",
  "kodeKecamatan": "357801",
  "kodeDesa": "3578010001",
  "lat": -7.2756,
  "lng": 112.7508,
  "polsekId": "…",
  "bhabinId": "…",
  "updatedAt": "2026-10-20T10:00:00+07:00"
}
```

| Kolom | Arti |
|---|---|
| `kodeKabupaten` / `kodeKecamatan` / `kodeDesa` | Kode Kemendagri 4 / 6 / 10 digit, tanpa titik. Kunci pertemuan antar sumber di Pusat |
| `lat`, `lng` | Titik tengah wilayah desa. `null` bila batas desa belum tersedia |
| `polsekId` | Polsek pengampu. `null` bila belum ditetapkan |
| `bhabinId` | Bhabin yang saat ini membina desa. `null` bila kosong |
| `updatedAt` | Berubah juga saat **Bhabin pembina berganti** |

### 4.3 `GET /bhabins`

Parameter: `updatedSince`, `limit`, `cursor`.

```json
{
  "id": "8a2e2d4d-2bec-48bf-b890-2bb38d253eed",
  "pangkat": "Bripka",
  "nama": "Budi Santoso",
  "nrp": "85010123",
  "polsekId": "…",
  "desaIds": ["37d6b684-…"],
  "aktif": true,
  "updatedAt": "2026-10-20T10:00:00+07:00"
}
```

| Kolom | Arti |
|---|---|
| `polsekId` | Unit tempat Bhabin bertugas |
| `desaIds` | Desa binaan aktif saat ini. `updatedAt` berubah bila daftar ini berubah |
| `aktif` | `false` = akun dinonaktifkan |

Nomor telepon, alamat, dan data pribadi lain tidak dikirim.

### 4.4 `GET /reports`

Parameter: `updatedSince`, `category`, `from`, `to`, `limit`, `cursor`.

`category`: `SAMBANG`, `DETEKSI_DINI`, `PROBLEM_SOLVING`, `PENYULUHAN`, `HARGA_PANGAN`, `MAPPING_KK`, `KETAHANAN_PANGAN`. `from`/`to` menyaring tanggal kegiatan.

```json
{
  "id": "bb7c0492-6653-4258-a395-073b9adb95dc",
  "nomor": "DD-RES-3171-2608-00001",
  "kategori": "DETEKSI_DINI",
  "waktu": "2026-08-28T11:29:00+07:00",
  "judul": "Sengketa Lahan",
  "urgensi": "RENDAH",
  "prioritas": false,
  "lat": -6.1938,
  "lng": 106.8447,
  "akurasiGps": 24,
  "lokasiDicek": false,
  "desaId": "…",
  "bhabinId": "…",
  "jumlahFoto": 1,
  "skemaVersi": 1,
  "isian": { "kategori_kerawanan": "Sengketa Lahan", "urgensi": "Rendah", "uraian": "…" },
  "status": "SUBMITTED",
  "updatedAt": "2026-08-28T12:17:00+07:00",
  "deleted": false
}
```

| Kolom | Arti |
|---|---|
| `nomor` | Nomor laporan resmi |
| `waktu` | Waktu kegiatan (bukan waktu kirim) |
| `judul` | Ringkasan dari isian. Deteksi Dini: kategori kerawanan · Problem Solving: pokok masalah · Sambang: jenis sasaran · Penyuluhan: tema · Harga Pangan: nama pasar · Ketahanan Pangan: jenis usaha · Mapping KK: nama kepala keluarga. Bila kosong, dipakai nama kategori |
| `urgensi` | `RENDAH` \| `SEDANG` \| `TINGGI`, hanya untuk `DETEKSI_DINI`. Kategori lain `null` |
| `prioritas` | Tanda prioritas, mis. Deteksi Dini urgensi tinggi |
| `akurasiGps` | Akurasi GPS dalam meter |
| `lokasiDicek` | `true` bila lokasi perlu diperiksa: GPS palsu (*mock location*) **atau** di luar desa binaan. Bila posisi terhadap desa tidak dapat ditentukan, hanya GPS palsu yang dipertimbangkan |
| `jumlahFoto` | Jumlah lampiran. Berkas foto tidak dikirim |
| `skemaVersi` | Versi skema form yang dipakai `isian` |
| `isian` | Isian form sesuai skema kategori (lihat 4.4.1) |
| `status` | `SUBMITTED` (terkirim) atau `REJECTED` (ditolak) |
| `deleted` | `true` bila `REJECTED` |

#### 4.4.1 Isi `isian`
- Kunci mengikuti skema form kategori dan versinya (`skemaVersi`).
- Isian yang ditandai **sensitif** di skema, seperti NIK, tidak dikirim.
- **`MAPPING_KK`**:
  - Nomor KK dikirim **terdekripsi** di `no_kk`.
  - Nama kepala keluarga (`kk_nama`) dan nama anggota (`anggota[].nama`) ikut terkirim.
  - Isian kesehatan per orang **tidak** dikirim: `status_stunting`, `stunting_ditangani`, `stunting_ket`, `risiko_ibu`, `kk_risiko_ibu`. Angka kesehatan tersedia per desa di `/family-summary`.
  - Kunci `_id` pada baris `anggota` adalah ID baris internal yang boleh diabaikan.
- **`HARGA_PANGAN`**: rincian harga per komoditas lebih mudah dipakai lewat `/prices`.

### 4.5 `GET /attendance`

Parameter: `updatedSince`, `date` atau `from`/`to`, `limit`, `cursor`.

Satu baris per Bhabin per tanggal kerja, gabungan absen masuk dan pulang.

```json
{
  "id": "ABS-20261025-8a2e2d4d-2bec-48bf-b890-2bb38d253eed",
  "bhabinId": "8a2e2d4d-2bec-48bf-b890-2bb38d253eed",
  "tanggal": "2026-10-25",
  "jamMasuk": "2026-10-25T07:55:00+07:00",
  "jamPulang": "2026-10-25T16:05:00+07:00",
  "lokasiMasuk": { "lat": -7.2757, "lng": 112.7509, "didalamDesa": true },
  "lokasiPulang": { "lat": -7.2759, "lng": 112.7511, "didalamDesa": true },
  "lokasiPalsu": false,
  "updatedAt": "2026-10-25T16:06:00+07:00"
}
```

| Kolom | Arti |
|---|---|
| `id` | `ABS-<YYYYMMDD>-<bhabinId>`, stabil |
| `jamMasuk` / `jamPulang` | Waktu absen menurut perangkat. `null` bila belum absen |
| `lokasiMasuk` / `lokasiPulang` | `null` bila belum absen. `didalamDesa`: di dalam salah satu desa binaan (toleransi 200 m); `null` bila tidak dapat ditentukan (mis. tidak ada desa pembanding) |
| `lokasiPalsu` | `true` bila salah satu absen memakai GPS palsu |

Baris yang sama dikirim lagi dengan `updatedAt` baru ketika absen pulang masuk. Simpan dengan upsert berdasarkan `id`.

### 4.6 `GET /prices`

Parameter: `updatedSince`, `date` atau `from`/`to`, `limit`, `cursor`.

Satu baris per komoditas per laporan Harga Pangan. **Tidak dirata-rata**: bila ada beberapa input untuk komoditas, desa, dan hari yang sama, semuanya dikirim dan Pusat yang merata-ratakan.

```json
{
  "id": "62db27cb-ac6a-4bd8-b2cb-147983a178f5:BERAS_MEDIUM",
  "laporanId": "62db27cb-ac6a-4bd8-b2cb-147983a178f5",
  "tanggal": "2026-10-25",
  "komoditas": "BERAS_MEDIUM",
  "namaKomoditas": "Beras Medium",
  "satuan": "kg",
  "harga": 13200,
  "stok": "AMAN",
  "desaId": "…",
  "bhabinId": "…",
  "updatedAt": "2026-10-25T09:00:00+07:00",
  "deleted": false
}
```

| Kolom | Arti |
|---|---|
| `id` | `<laporanId>:<komoditas>` |
| `laporanId` | Laporan Harga Pangan asal |
| `komoditas` | Kode tetap (lihat `/commodities`) |
| `harga` | Rupiah per `satuan` |
| `stok` | `AMAN` \| `MENIPIS` \| `KOSONG` |
| `deleted` | `true` bila laporan ditolak |

> **Ralat laporan:** Bhabin bisa meralat laporan sesaat setelah dikirim. Kalau ralat menghapus satu komoditas, baris komoditas itu tidak dikirim lagi dan tidak ada tanda hapus. Karena itu, **setiap kali menerima baris dengan suatu `laporanId`, ganti semua baris lama dengan `laporanId` yang sama** dengan baris dari tarikan terbaru.

### 4.7 `GET /commodities`

Daftar komoditas. Tanpa paginasi.

```json
{ "komoditas": "BERAS_MEDIUM", "namaKomoditas": "Beras Medium", "satuan": "kg", "aktif": true }
```

`aktif: false` berarti komoditas tidak lagi ditawarkan di form, tetapi data lamanya tetap sah.

### 4.8 `GET /family-summary`

Parameter: `periode` (`YYYY-MM`, bawaan bulan berjalan), `updatedSince`, `limit`, `cursor`.

**Hanya angka per desa**, tanpa data per orang.

```json
{
  "desaId": "37d6b684-084b-4f22-b78e-7cdf5edf2a55",
  "periode": "2026-10",
  "kk": 1840,
  "balita": 412,
  "stunting": 38,
  "berisikoStunting": 61,
  "belumDitangani": 24,
  "ibuHamil": 57,
  "kek": 9,
  "anemia": 14,
  "calonPengantin": 22,
  "sanitasiLayak": 1655,
  "sanitasiTidakLayak": 185,
  "updatedAt": "2026-10-25T00:30:00+07:00"
}
```

**Cara hitung.** Angka adalah **posisi pada akhir `periode`**: semua KK hasil Mapping Data Keluarga (form v2) yang terkirim dengan waktu kegiatan sebelum akhir bulan itu. KK yang didata lebih dari sekali (nomor KK sama) dihitung dari laporan terbarunya saja. Umur dihitung terhadap waktu pendataan. Hanya desa yang punya data yang muncul.

| Kolom | Definisi |
|---|---|
| `kk` | Jumlah KK terdata |
| `balita` | Anggota berumur di bawah 5 tahun |
| `stunting` | Balita berstatus "Stunting" |
| `berisikoStunting` | Balita berstatus "Berisiko stunting" |
| `belumDitangani` | Balita stunting/berisiko dengan isian penanganan "Belum" |
| `ibuHamil` | Anggota/KK dengan risiko ibu "Ibu hamil" atau "Ibu hamil KEK/anemia" |
| `kek` | Risiko ibu "Ibu hamil KEK/anemia". KEK dan anemia ibu hamil tidak dipisah di form |
| `anemia` | Risiko ibu "Remaja putri anemia" |
| `calonPengantin` | Anggota dengan isian calon pengantin "Ya" |
| `sanitasiLayak` | KK dengan jamban "Jamban sendiri dengan septic tank" |
| `sanitasiTidakLayak` | KK dengan isian jamban selain itu. KK tanpa isian jamban tidak dihitung di keduanya |
| `updatedAt` | Perubahan terakhir laporan yang ikut dihitung di desa itu |

Saran pemakaian:
- Tarik `periode` bulan berjalan secara berkala dengan `updatedSince`.
- Untuk bulan yang sudah lewat, tarik sekali penuh (tanpa `updatedSince`) per `periode`. Angkanya hanya berubah bila ada laporan yang diralat atau ditolak kemudian.
- Kunci unik baris: `desaId` + `periode`.

---

## 5. Kode galat

Isi selalu:

```json
{ "error": { "code": "IP_NOT_ALLOWED", "message": "IP tidak diizinkan" } }
```

| HTTP | `code` | Penyebab | Tindakan |
|---|---|---|---|
| 400 | `VALIDATION_FAILED` | Parameter salah atau tidak dikenal (rinciannya di `error.details`) | Perbaiki parameter |
| 400 | `INVALID_CURSOR` | Kursor rusak atau dibuat sendiri | Mulai ulang tanpa `cursor` |
| 401 | `UNAUTHENTICATED` | Token salah, tidak dikirim, atau sudah dicabut | Minta token baru ke Superadmin Polda |
| 403 | `IP_NOT_ALLOWED` | IP pemanggil tidak terdaftar | Minta Superadmin menambah IP |
| 403 | `FORBIDDEN` | Akun Superadmin pemilik token dinonaktifkan | Hubungi Superadmin Polda |
| 429 | `RATE_LIMITED` | Terlalu banyak permintaan | Tunggu lalu ulangi dengan *backoff* |
| 5xx | `INTERNAL_ERROR` | Galat server | Ulangi dengan *backoff*; laporkan bila berulang |

---

## 6. Contoh klien sinkron (Python)

Contoh lengkap tarik bertahap semua endpoint ke penyimpanan lokal. Sesuaikan fungsi `simpan()` dengan basis data Pusat.

```python
import json, time, datetime as dt
import requests

BASE = "https://lapor.polda-contoh.go.id/api/v1/integration"
TOKEN = "lbi_xxx"                      # simpan di secret manager, bukan di kode
OVERLAP = dt.timedelta(minutes=5)
STATE_FILE = "watermark.json"

s = requests.Session()
s.headers["Authorization"] = f"Bearer {TOKEN}"

def get(path, params):
    for attempt in range(6):
        r = s.get(f"{BASE}/{path}", params=params, timeout=60)
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(2 ** attempt)    # backoff
            continue
        if not r.ok:
            raise RuntimeError(f"{r.status_code} {r.json().get('error')}")
        return r.json()
    raise RuntimeError("gagal setelah beberapa percobaan")

def tarik(path, extra=None, since=None):
    """Telusuri semua halaman; kembalikan updatedAt terbesar yang diterima."""
    params = {"limit": 2000, **(extra or {})}
    if since:
        params["updatedSince"] = since
    terbaru = None
    while True:
        page = get(path, params)
        for row in page["data"]:
            simpan(path, row)
            u = row.get("updatedAt")
            if u and (terbaru is None or dt.datetime.fromisoformat(u) > dt.datetime.fromisoformat(terbaru)):
                terbaru = u
        if not page["nextCursor"]:
            return terbaru
        params["cursor"] = page["nextCursor"]

def simpan(path, row):
    # Upsert berdasarkan kunci; hapus/sembunyikan bila row.get("deleted").
    # prices: ganti semua baris dengan laporanId yang sama (lihat 4.6).
    print(path, row.get("id") or row.get("desaId"))

def main():
    try:
        state = json.load(open(STATE_FILE))
    except FileNotFoundError:
        state = {}

    tarik("units")                     # kecil, selalu penuh
    tarik("commodities")

    # Bulan menurut jam server Pusat; di sekitar pergantian bulan bisa berbeda dengan zona instance (WITA/WIT).
    # Tanpa parameter periode, instance memakai bulan berjalan menurut zonanya sendiri.
    periode = dt.date.today().strftime("%Y-%m")
    for path, extra in [("villages", None), ("bhabins", None), ("reports", None),
                        ("attendance", None), ("prices", None),
                        ("family-summary", {"periode": periode})]:
        key = f"{path}:{periode}" if path == "family-summary" else path
        since = None
        if key in state:
            since = (dt.datetime.fromisoformat(state[key]) - OVERLAP).isoformat()
        terbaru = tarik(path, extra, since)
        if terbaru:
            state[key] = terbaru

    json.dump(state, open(STATE_FILE, "w"))

if __name__ == "__main__":
    main()
```

---

## 7. Praktik yang disarankan

- **Jadwal**: tarik tiap 5–15 menit. Satu putaran untuk instance berukuran sedang hanya butuh beberapa permintaan.
- **`limit` besar** (1000–2000) untuk tarikan awal agar jumlah permintaan sedikit.
- **Jangan paralel berlebihan** ke satu instance. Satu atau dua permintaan bersamaan sudah cukup.
- **Simpan zona waktu apa adanya.** Semua waktu membawa offset, jadi bandingkan sebagai waktu absolut, bukan teks.
- **Kunci unik** per endpoint:

  | Endpoint | Kunci |
  |---|---|
  | units, villages, bhabins, reports, attendance, prices | `id` |
  | commodities | `komoditas` |
  | family-summary | `desaId` + `periode` |

- **Banyak instance Polda**: setiap instance punya token, IP, dan watermark sendiri. ID (UUID) unik per instance, jadi simpan bersama penanda instance (mis. `kodePolda`).
- **Kerahasiaan**: respons `reports` kategori `MAPPING_KK` memuat nomor KK dan nama warga. Batasi akses di sisi Pusat, simpan terenkripsi, dan catat siapa yang membukanya.

### 7.1 Menangani penolakan dan koreksi

- Untuk `reports`, `deleted: true` berarti laporan berstatus `REJECTED`; tandai tidak berlaku atau hapus dari tampilan aktif di Pusat.
- Untuk `prices`, `deleted: true` berlaku bagi baris harga yang masih ada pada laporan yang ditolak. Jika laporan harga diralat dan satu komoditas dihapus, API tidak mengirim tombstone untuk komoditas yang hilang. Saat menerima hasil baru untuk `laporanId`, ganti seluruh rincian lama laporan itu.
- `family-summary` adalah ringkasan keadaan akhir periode, bukan daftar perubahan per KK. Jika ada koreksi laporan lama, tarik ulang periode terkait secara penuh untuk memastikan angka dan desa yang sudah tidak memiliki data ikut tersinkron.
- `/units` dan `/commodities` tidak memiliki `updatedSince`. Tarik ulang berkala; untuk unit, bandingkan daftar sebelumnya karena unit yang dihapus tidak memiliki tombstone.

### 7.2 Validasi respons

Sebelum menyimpan satu halaman, periksa bahwa respons memiliki `data` berupa array dan `nextCursor` berupa string atau `null`. Teruskan cursor persis seperti diterima dan gunakan filter yang sama sampai halaman terakhir. Jika respons gagal di tengah proses, jangan memajukan watermark; ulangi sinkronisasi dengan watermark sebelumnya agar rentang data tetap tercakup.

---

## 8. Pemecahan masalah

| Gejala | Kemungkinan penyebab |
|---|---|
| `403 IP_NOT_ALLOWED` | IP pemanggil tidak cocok dengan allowlist token atau `INTEGRATION_ALLOWED_IPS`. Jika keduanya kosong, pembatasan IP tidak berlaku. Periksa `TRUST_PROXY` dan `X-Forwarded-For` (bagian 2.3), serta IP **publik keluar** server Pusat (NAT) |
| `401` mendadak | Token dicabut atau dirotasi. Tanyakan ke Superadmin Polda |
| Data lama tidak muncul di tarikan berkala | Sudah benar: `updatedSince` hanya mengirim perubahan. Lakukan tarikan penuh tanpa `updatedSince` bila perlu memulai ulang |
| Baris yang sama datang dua kali | Wajar karena jendela tumpang-tindih. Lakukan upsert berdasarkan kunci |
| `family-summary` bulan lalu berubah | Ada laporan Mapping KK lama yang diralat atau ditolak. Tarik ulang periode itu |
| Kolom "Terakhir dipakai" di admin tidak bergerak | Token tidak dipakai, atau pemanggilan ditolak sebelum autentikasi (mis. IP salah). Periksa audit log `INTEGRATION_READ` |

Setiap pemanggilan tercatat di **Audit log** instance (aksi `INTEGRATION_READ`, berisi endpoint, parameter, dan jumlah baris), sehingga Superadmin bisa menelusuri pemakaian token.
