import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../api/api_client.dart';

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
    if (await ref.read(tokenStorageProvider).refreshToken == null) return null;
    try {
      final res = await ref.read(dioProvider).get('/auth/me');
      return Me(Map<String, dynamic>.from(res.data));
    } catch (_) {
      return null;
    }
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
        'platform': Platform.isIOS ? 'ios' : 'android',
        'model': await _deviceModel(),
        'appVersion': info.version,
      },
    });
    await storage.save(res.data['accessToken'], res.data['refreshToken']);
    final me = await dio.get('/auth/me');
    state = AsyncData(Me(Map<String, dynamic>.from(me.data)));
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
    final me = await ref.read(dioProvider).get('/auth/me');
    state = AsyncData(Me(Map<String, dynamic>.from(me.data)));
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
    if (Platform.isIOS) return (await d.iosInfo).utsname.machine;
    final a = await d.androidInfo;
    return '${a.manufacturer} ${a.model}';
  }
}
