import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../features/reports/report_api.dart';
import '../api/api_client.dart';
import '../auth/auth_controller.dart';

/// Perbarui posisi bila berpindah ≥ 30 m atau sudah 1 menit sejak kiriman terakhir.
const _minMoveM = 30.0;
const _maxGap = Duration(minutes: 1);

enum TrackStatus { off, active, needPermission, gpsOff }

/// Posisi realtime jam dinas: menyala otomatis setelah absen masuk, mati setelah absen pulang.
/// Berjalan sebagai foreground service (notifikasi tetap) sehingga tetap aktif saat layar terkunci.
/// Hanya posisi terbaru yang dikirim (server menimpa); tidak ada riwayat atau antrean.
class Tracker extends Notifier<TrackStatus> {
  StreamSubscription<Position>? _sub;
  Position? _last;
  Map<String, dynamic>? _pending;
  bool _sending = false;

  @override
  TrackStatus build() {
    ref.onDispose(_stop);
    final signedIn = ref.watch(authControllerProvider.select((s) => s.valueOrNull != null));
    if (!signedIn || defaultTargetPlatform != TargetPlatform.android) return TrackStatus.off;
    ref.listen(myAttendanceProvider, (_, next) => next.whenData(_sync), fireImmediately: true);
    return TrackStatus.off;
  }

  void _sync(List<Map<String, dynamic>> rows) {
    final today = DateTime.now().toIso8601String().substring(0, 10);
    bool has(String t) => rows.any((a) => a['workDate'] == today && a['type'] == t);
    has('CHECK_IN') && !has('CHECK_OUT') ? _start() : _stop();
  }

  /// Coba nyalakan ulang (mis. setelah izin diberikan atau GPS dinyalakan).
  Future<void> retry() async {
    _stop();
    ref.invalidate(myAttendanceProvider);
  }

  Future<void> _start() async {
    if (_sub != null) return;
    if (!await Geolocator.isLocationServiceEnabled()) {
      state = TrackStatus.gpsOff;
      return;
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      state = TrackStatus.needPermission;
      return;
    }
    _sub = Geolocator.getPositionStream(
      locationSettings: AndroidSettings(
        accuracy: LocationAccuracy.high,
        intervalDuration: const Duration(seconds: 30),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: 'Pelacakan jam dinas aktif',
          notificationText: 'Posisi terkini terlihat oleh satuan sampai Anda absen pulang.',
          notificationChannelName: 'Pelacakan jam dinas',
          enableWakeLock: true,
          setOngoing: true,
        ),
      ),
    ).listen(_onPosition, onError: (_) => state = TrackStatus.gpsOff);
    state = TrackStatus.active;
  }

  void _stop() {
    _sub?.cancel();
    _sub = null;
    _last = null;
    _pending = null;
    state = TrackStatus.off;
  }

  void _onPosition(Position p) {
    state = TrackStatus.active;
    final l = _last;
    if (l != null && Geolocator.distanceBetween(l.latitude, l.longitude, p.latitude, p.longitude) < _minMoveM && p.timestamp.difference(l.timestamp) < _maxGap) return;
    _last = p;
    _pending = {'t': p.timestamp.toUtc().toIso8601String(), 'lat': p.latitude, 'lng': p.longitude, 'acc': p.accuracy, 'mock': p.isMocked};
    unawaited(_send());
  }

  /// Kirim posisi terbaru; bila gagal (offline) cukup tunggu posisi berikutnya.
  Future<void> _send() async {
    if (_sending) return;
    _sending = true;
    try {
      while (_pending != null) {
        final body = _pending!;
        _pending = null;
        await ref.read(dioProvider).post('/tracking/location', data: body);
      }
    } catch (_) {
      _last = null; // coba lagi pada titik berikutnya
    } finally {
      _sending = false;
    }
  }
}

final trackerProvider = NotifierProvider<Tracker, TrackStatus>(Tracker.new);
