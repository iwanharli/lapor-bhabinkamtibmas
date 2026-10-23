import 'dart:async';

import 'package:geolocator/geolocator.dart';

class Fix {
  Fix(this.lat, this.lng, this.accuracy, this.mocked);
  final double lat;
  final double lng;
  final double accuracy;
  final bool mocked;
}

class LocationException implements Exception {
  LocationException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Ambil titik GPS akurasi tinggi: tunggu akurasi ≤ 50 m atau maksimal [wait], lalu pakai titik terbaik.
Future<Fix> getFix({Duration wait = const Duration(seconds: 20)}) async {
  if (!await Geolocator.isLocationServiceEnabled()) throw LocationException('GPS mati. Nyalakan lokasi di HP.');
  var perm = await Geolocator.checkPermission();
  if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
  if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
    throw LocationException('Izin lokasi ditolak. Izinkan lokasi untuk aplikasi ini di Pengaturan.');
  }
  Position? best;
  final done = Completer<void>();
  final sub = Geolocator.getPositionStream(locationSettings: const LocationSettings(accuracy: LocationAccuracy.best)).listen((p) {
    if (best == null || p.accuracy < best!.accuracy) best = p;
    if (p.accuracy <= 50 && !done.isCompleted) done.complete();
  }, onError: (Object e) {
    if (!done.isCompleted) done.completeError(e);
  });
  try {
    await done.future.timeout(wait, onTimeout: () {});
  } finally {
    await sub.cancel();
  }
  // Belum dapat titik (mis. di dalam ruangan): coba sekali lagi dengan batas waktu, lalu posisi terakhir ponsel.
  // Tanpa batas waktu, getCurrentPosition bisa menunggu selamanya dan tombol tampak "loading terus".
  var p = best;
  p ??= await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 10)))
      .then<Position?>((v) => v)
      .catchError((Object _) => null);
  p ??= await Geolocator.getLastKnownPosition();
  if (p == null) throw LocationException('Lokasi GPS belum didapat. Pindah ke tempat terbuka lalu coba lagi.');
  return Fix(p.latitude, p.longitude, p.accuracy, p.isMocked);
}
