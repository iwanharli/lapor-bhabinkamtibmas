import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lapor_bhabin/core/offline/cache.dart';

DioException _err({int? status, DioExceptionType type = DioExceptionType.badResponse}) {
  final req = RequestOptions(path: '/reports');
  return DioException(requestOptions: req, type: type, response: status == null ? null : Response(requestOptions: req, statusCode: status));
}

void main() {
  test('isNetworkError: tanpa sinyal & galat server dicoba lagi, penolakan isian tidak', () {
    expect(isNetworkError(_err(type: DioExceptionType.connectionError)), isTrue);
    expect(isNetworkError(_err(type: DioExceptionType.connectionTimeout)), isTrue);
    expect(isNetworkError(_err(status: 502)), isTrue);
    expect(isNetworkError(_err(status: 429)), isTrue);
    expect(isNetworkError(_err(status: 400)), isFalse);
    expect(isNetworkError(_err(status: 409)), isFalse);
    expect(isNetworkError(StateError('x')), isFalse);
  });
}
