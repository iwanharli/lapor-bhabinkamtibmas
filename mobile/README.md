# mobile — Aplikasi Android Bhabinkamtibmas (Flutter)

**Tahap 1 (online):** login & ganti sandi wajib, beranda (status absen, kategori, laporan terbaru), formulir laporan dari
skema JSON (langkah, isian bersyarat, balita otomatis, NIK & data kesehatan terenkripsi di server, foto kamera, GPS +
deteksi lokasi palsu), simpan draft / kirim / ralat 3×24 jam, laporan saya & detail, absensi swafoto + GPS, profil.
**Tahap 2 (belum):** antrean offline terenkripsi (drift + SQLCipher), sinkron latar, watermark foto, notifikasi push.
Spesifikasi: `docs/teknis/07-mobile-flutter.md`. iOS menyusul (butuh Xcode & akun Apple Developer).

## Persiapan (macOS, tanpa emulator)

```bash
brew install --cask flutter android-commandlinetools && brew install openjdk@17
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=$HOME/Library/Android/sdk
sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-36" "build-tools;36.0.0" "cmdline-tools;latest"
flutter config --android-sdk $ANDROID_HOME --jdk-dir $JAVA_HOME
yes | flutter doctor --android-licenses
```

## Menjalankan di HP Android (USB)

1. HP: **Pengaturan → Tentang ponsel →** ketuk *Nomor bentukan* 7× → **Opsi pengembang → Debugging USB** aktif. Sambungkan kabel, izinkan.
2. HP & laptop di **jaringan Wi-Fi yang sama**; backend dev berjalan di laptop (`:3000`).
3. ```bash
   cd mobile
   flutter devices                                   # HP harus terdaftar
   flutter run --dart-define=API_URL=http://$(ipconfig getifaddr en0):3000/api/v1
   ```
   Atau pasang APK: `flutter build apk --debug --dart-define=API_URL=http://<IP-laptop>:3000/api/v1`
   lalu `adb install -r build/app/outputs/flutter-apk/app-debug.apk`.
4. macOS mungkin bertanya *izinkan koneksi masuk untuk node* — pilih **Izinkan**.

Akun uji dev: NRP `90000001`, sandi `Demo#12345`. Build debug mengizinkan HTTP polos ke server dev; build rilis wajib HTTPS.

```bash
flutter analyze && flutter test
```
