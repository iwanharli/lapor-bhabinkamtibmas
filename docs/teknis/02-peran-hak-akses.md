# 02 — Peran & Hak Akses

## 1. Hierarki unit & wilayah

```
MABES (Baharkam)
 └── POLDA
      └── POLRES / POLRESTA
           └── POLSEK
                └── Desa/Kelurahan binaan  ◄── ditugaskan ke Bhabin
```

- Setiap pengguna terikat pada **satu unit** (`users.unit_id`).
- Seorang Bhabin dapat membina **satu atau lebih desa** (`user_villages`).
- Cakupan data pengguna = unitnya **beserta seluruh unit turunannya**.

## 2. Peran

| Kode | Nama | Platform | Unit tipikal |
|---|---|---|---|
| `BHABIN` | Bhabinkamtibmas | Mobile (web hanya baca) | Polsek |
| `VERIFIKATOR` | Petugas verifikasi laporan | Web | Polsek / Polres |
| `PIMPINAN` | Pimpinan / analis | Web | Polres / Polda / Mabes |
| `ADMIN_UNIT` | Admin unit | Web | Polres / Polda |
| `SUPERADMIN` | Admin sistem | Web | Mabes |
| `AUDITOR` | Pengawas / auditor | Web | Polda / Mabes |
| `INTEGRASI` | Akun mesin Command Center | API | Mabes |

Satu pengguna memiliki satu peran. Jika perlu peran ganda, buat akun terpisah agar audit tetap jelas.

## 3. Matriks izin

Keterangan: ✅ penuh · 👁 lihat saja · 🔒 tidak · ⓢ hanya milik sendiri · ⓦ dalam cakupan wilayah

| Aksi | BHABIN | VERIFIKATOR | PIMPINAN | ADMIN_UNIT | SUPERADMIN | AUDITOR |
|---|---|---|---|---|---|---|
| Buat / edit draft laporan | ✅ⓢ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| Kirim laporan | ✅ⓢ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| Lihat laporan | 👁ⓢ | 👁ⓦ | 👁ⓦ | 👁ⓦ | 👁 | 👁ⓦ |
| Verifikasi (setujui/revisi/tolak) | 🔒 | ✅ⓦ | 🔒 | 🔒 | 🔒 | 🔒 |
| Lihat NIK / identitas pihak (dekripsi) | ✅ⓢ | ✅ⓦ | 🔒 | 🔒 | 🔒 | 👁ⓦ |
| Absensi | ✅ⓢ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| Lihat rekap absensi | 👁ⓢ | 👁ⓦ | 👁ⓦ | 👁ⓦ | 👁 | 👁ⓦ |
| Dashboard & peta | 🔒 | 👁ⓦ | 👁ⓦ | 👁ⓦ | 👁 | 👁ⓦ |
| Ekspor CSV/XLSX | 🔒 | ✅ⓦ | ✅ⓦ | ✅ⓦ | ✅ | ✅ⓦ |
| Kelola pengguna | 🔒 | 🔒 | 🔒 | ✅ⓦ | ✅ | 🔒 |
| Kelola desa binaan | 🔒 | 🔒 | 🔒 | ✅ⓦ | ✅ | 🔒 |
| Kelola master data (komoditas, kategori) | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 |
| Kelola skema form | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 |
| Lihat audit log | 🔒 | 🔒 | 🔒 | 👁ⓦ | 👁 | 👁ⓦ |
| Cabut sesi / perangkat | 🔒 | 🔒 | 🔒 | ✅ⓦ | ✅ | 🔒 |

## 4. Implementasi

### 4.1 Backend
- Guard `JwtAuthGuard` → `RolesGuard` (dekorator `@Roles(...)`) → `ScopeGuard`.
- `ScopeGuard` menyuntikkan `allowedUnitIds` (hasil query rekursif unit turunan, di-cache di memori proses 10 menit) ke dalam request.
- Setiap repository wajib menerapkan filter `unit_id IN (:allowedUnitIds)` atau `user_id = :me` untuk BHABIN. Diuji dengan test otomatis per endpoint.
- Dekripsi NIK hanya melalui `SensitiveDataService.reveal()`, yang memeriksa izin dan menulis audit `SENSITIVE_READ`.

### 4.2 Contoh query unit turunan

```sql
WITH RECURSIVE tree AS (
  SELECT id FROM units WHERE id = $1
  UNION ALL
  SELECT u.id FROM units u JOIN tree t ON u.parent_id = t.id
)
SELECT id FROM tree;
```

### 4.3 Klien
- Mobile hanya dapat login dengan peran `BHABIN`.
- Web menyembunyikan menu sesuai izin, tetapi **keputusan akses tetap di backend**.
