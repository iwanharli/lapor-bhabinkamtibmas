import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

/// Token & ID instalasi disimpan di Keystore (Android) / Keychain (iOS).
class TokenStorage {
  TokenStorage([FlutterSecureStorage? storage])
      : _s = storage ?? const FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));

  final FlutterSecureStorage _s;
  static const _access = 'access_token';
  static const _refresh = 'refresh_token';
  static const _deviceId = 'device_id';
  static const _me = 'me_cache';

  Future<String?> get accessToken => _s.read(key: _access);
  Future<String?> get refreshToken => _s.read(key: _refresh);

  Future<void> save(String access, String refresh) async {
    await _s.write(key: _access, value: access);
    await _s.write(key: _refresh, value: refresh);
  }

  Future<void> clear() async {
    await _s.delete(key: _access);
    await _s.delete(key: _refresh);
    await _s.delete(key: _me);
  }

  /// Profil terakhir (/auth/me) agar aplikasi tetap terbuka tanpa sinyal.
  Future<Map<String, dynamic>?> get cachedMe async {
    final v = await _s.read(key: _me);
    return v == null ? null : Map<String, dynamic>.from(jsonDecode(v) as Map);
  }

  Future<void> saveMe(Map<String, dynamic> me) => _s.write(key: _me, value: jsonEncode(me));

  Future<String>? _deviceIdFuture;

  /// ID instalasi yang stabil; dipakai server untuk mencabut perangkat.
  /// Disimpan sekali sebagai Future agar permintaan serentak saat aplikasi dibuka tidak membuat ID berbeda-beda
  /// (server menolak token bila ID perangkat tidak cocok dengan saat login).
  Future<String> deviceId() => _deviceIdFuture ??= () async {
        final existing = await _s.read(key: _deviceId);
        if (existing != null) return existing;
        final id = const Uuid().v4();
        await _s.write(key: _deviceId, value: id);
        return id;
      }();
}
