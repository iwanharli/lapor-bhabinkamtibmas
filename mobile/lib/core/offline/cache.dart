import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';

/// Galat karena tidak ada sinyal / server tak terjangkau (bukan penolakan dari server).
bool isNetworkError(Object e) {
  if (e is! DioException) return false;
  final status = e.response?.statusCode;
  return status == null || status >= 500 || status == 429;
}

/// Salinan terakhir data referensi yang tidak rahasia (skema formulir, komoditas)
/// agar formulir tetap bisa dibuka tanpa sinyal.
class OfflineCache {
  static Future<File> _file(String name) async => File('${(await getApplicationSupportDirectory()).path}/cache-$name.json');

  static Future<void> write(String name, Object? json) async {
    try {
      await (await _file(name)).writeAsString(jsonEncode(json));
    } catch (_) {
      // Cache hanya cadangan; gagal tulis tidak mengganggu.
    }
  }

  static Future<Object?> read(String name) async {
    try {
      final f = await _file(name);
      return await f.exists() ? jsonDecode(await f.readAsString()) : null;
    } catch (_) {
      return null;
    }
  }

  /// Ambil dari server dan simpan; bila tidak ada sinyal, pakai salinan terakhir.
  static Future<Object?> fetch(String name, Future<Object?> Function() load) async {
    try {
      final data = await load();
      await write(name, data);
      return data;
    } catch (e) {
      if (!isNetworkError(e)) rethrow;
      final cached = await read(name);
      if (cached == null) rethrow;
      return cached;
    }
  }
}
