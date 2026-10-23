import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../app/config.dart';
import '../auth/token_storage.dart';

final tokenStorageProvider = Provider((_) => TokenStorage());

final dioProvider = Provider<Dio>((ref) {
  final storage = ref.watch(tokenStorageProvider);
  final dio = Dio(BaseOptions(baseUrl: apiUrl, connectTimeout: const Duration(seconds: 15), sendTimeout: const Duration(seconds: 60), receiveTimeout: const Duration(seconds: 30)));
  dio.interceptors.add(_AuthInterceptor(dio, storage));
  return dio;
});

/// Pesan error dari format standar API: { error: { code, message } }.
String apiErrorMessage(Object e) {
  if (e is DioException) {
    final data = e.response?.data;
    if (data is Map && data['error'] is Map) return data['error']['message']?.toString() ?? 'Terjadi kesalahan';
    if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) {
      return 'Tidak dapat terhubung ke server';
    }
    if (e.type == DioExceptionType.sendTimeout || e.type == DioExceptionType.receiveTimeout) {
      return 'Koneksi lambat, pengiriman terputus. Coba lagi.';
    }
  }
  return 'Terjadi kesalahan';
}

class _AuthInterceptor extends QueuedInterceptor {
  _AuthInterceptor(this._dio, this._storage);

  final Dio _dio;
  final TokenStorage _storage;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _storage.accessToken;
    final info = await PackageInfo.fromPlatform();
    options.headers['X-App-Version'] = info.version;
    options.headers['X-Device-Id'] = await _storage.deviceId();
    if (token != null) options.headers['Authorization'] = 'Bearer $token';
    handler.next(options);
  }

  /// Saat access token kedaluwarsa: refresh sekali lalu ulangi request.
  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final isAuthCall = err.requestOptions.path.startsWith('/auth/');
    if (err.response?.statusCode != 401 || isAuthCall || err.requestOptions.extra['retried'] == true) {
      return handler.next(err);
    }
    final rt = await _storage.refreshToken;
    if (rt == null) return handler.next(err);
    try {
      final res = await _dio.post('/auth/refresh', data: {'refreshToken': rt});
      await _storage.save(res.data['accessToken'], res.data['refreshToken']);
      final retry = err.requestOptions..extra['retried'] = true;
      retry.headers['Authorization'] = 'Bearer ${res.data['accessToken']}';
      handler.resolve(await _dio.fetch(retry));
    } on DioException {
      await _storage.clear();
      handler.next(err);
    }
  }
}
