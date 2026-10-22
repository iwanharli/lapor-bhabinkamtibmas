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

  Future<String?> get accessToken => _s.read(key: _access);
  Future<String?> get refreshToken => _s.read(key: _refresh);

  Future<void> save(String access, String refresh) async {
    await _s.write(key: _access, value: access);
    await _s.write(key: _refresh, value: refresh);
  }

  Future<void> clear() async {
    await _s.delete(key: _access);
    await _s.delete(key: _refresh);
  }

  /// ID instalasi yang stabil; dipakai server untuk mencabut perangkat.
  Future<String> deviceId() async {
    final existing = await _s.read(key: _deviceId);
    if (existing != null) return existing;
    final id = const Uuid().v4();
    await _s.write(key: _deviceId, value: id);
    return id;
  }
}
