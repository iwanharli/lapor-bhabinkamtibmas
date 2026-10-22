# mobile — Aplikasi Flutter Bhabinkamtibmas

Kerangka fase 1: login, penyimpanan token aman, refresh token otomatis, beranda, dan pemuatan skema form.
Folder platform (`android/`, `ios/`) belum dibuat. Jalankan sekali setelah Flutter terpasang:

```bash
cd mobile
flutter create --org id.polri.lapor --platforms android,ios .
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:3000/api/v1   # emulator Android → host
```

Akun uji dev: NRP `90000001`, sandi `Demo#12345` (lihat `backend/prisma/seed.ts`).
Spesifikasi lengkap: `docs/teknis/07-mobile-flutter.md`.
