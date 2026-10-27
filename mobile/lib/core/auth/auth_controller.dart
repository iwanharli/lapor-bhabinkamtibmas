import 'dart:async';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../api/api_client.dart';
import '../offline/cache.dart';

class Me {
  Me(this.json);
  final Map<String, dynamic> json;

  String get nama => json['nama'] as String;
  String get nrp => json['nrp'] as String;
  String? get pangkat => json['pangkat'] as String?;
  String get namaLengkap => [pangkat, nama].whereType<String>().join(' ');
  bool get mustChangePassword => json['mustChangePassword'] == true;
  String get unitNama => (json['unit'] as Map)['nama'] as String;
  List<Map<String, dynamic>> get villages =>
      ((json['villages'] as List?) ?? []).map((v) => Map<String, dynamic>.from(v['village'] as Map)).toList();
}

final authControllerProvider = AsyncNotifierProvider<AuthController, Me?>(AuthController.new);

class AuthController extends AsyncNotifier<Me?> {
  @override
  Future<Me?> build() async {
    final storage = ref.read(tokenStorageProvider);
    if (await storage.refreshToken == null) return null;
    // Ada profil tersimpan: aplikasi langsung terbuka, profil diperbarui di belakang (jaringan lambat / tanpa sinyal).
    final cached = await storage.cachedMe;
    if (cached != null) {
      unawaited(_refreshInBackground());
      return Me(cached);
    }
    try {
      return await _fetchMe();
    } catch (_) {
      return null;
    }
  }

  /// Perbarui profil tersimpan; sesi ditolak server (token dicabut) → keluar, sinyal putus → tetap pakai yang lama.
  Future<void> _refreshInBackground() async {
    try {
      state = AsyncData(await _fetchMe());
    } catch (e) {
      if (!isNetworkError(e) && await ref.read(tokenStorageProvider).refreshToken == null) state = const AsyncData(null);
    }
  }

  Future<Me> _fetchMe() async => _remember((await ref.read(dioProvider).get('/auth/me')).data);

  Future<Me> _remember(Object? data) async {
    final json = Map<String, dynamic>.from(data as Map);
    await ref.read(tokenStorageProvider).saveMe(json);
    return Me(json);
  }

  Future<void> login(String nrp, String password) async {
    final dio = ref.read(dioProvider);
    final storage = ref.read(tokenStorageProvider);
    final info = await PackageInfo.fromPlatform();
    final res = await dio.post('/auth/login', data: {
      'nrp': nrp,
      'password': password,
      'device': {
        'deviceId': await storage.deviceId(),
        'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
        'model': await _deviceModel(),
        'appVersion': info.version,
      },
    });
    await storage.save(res.data['accessToken'], res.data['refreshToken']);
    // Server baru menyertakan profil lengkap di jawaban login (hemat satu permintaan); server lama: ambil /auth/me.
    state = AsyncData(res.data['me'] is Map ? await _remember(res.data['me']) : await _fetchMe());
  }

  /// Ganti sandi (wajib saat login pertama). Server mengembalikan token baru; sesi lain dicabut.
  Future<void> changePassword(String current, String next) async {
    final dio = ref.read(dioProvider);
    final storage = ref.read(tokenStorageProvider);
    final res = await dio.post('/auth/change-password', data: {'currentPassword': current, 'newPassword': next});
    await storage.save(res.data['accessToken'], res.data['refreshToken']);
    await refreshMe();
  }

  Future<void> refreshMe() async {
    state = AsyncData(await _fetchMe());
  }

  Future<void> logout() async {
    final storage = ref.read(tokenStorageProvider);
    final rt = await storage.refreshToken;
    if (rt != null) {
      try {
        await ref.read(dioProvider).post('/auth/logout', data: {'refreshToken': rt});
      } catch (_) {
        // Tetap keluar walau server tak terjangkau.
      }
    }
    await storage.clear();
    state = const AsyncData(null);
  }

  Future<String> _deviceModel() async {
    final d = DeviceInfoPlugin();
    if (kIsWeb) return (await d.webBrowserInfo).browserName.name;
    if (defaultTargetPlatform == TargetPlatform.iOS) return (await d.iosInfo).utsname.machine;
    final a = await d.androidInfo;
    return '${a.manufacturer} ${a.model}';
  }
}
