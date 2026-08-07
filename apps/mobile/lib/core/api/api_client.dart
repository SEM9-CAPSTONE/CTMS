import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../env/env.dart';
import '../storage/token_storage.dart';
import 'api_exception.dart';

/// Thin wrapper around Dio — the Flutter counterpart of
/// apps/web/src/core/api/httpClient.ts. Injects the bearer token from
/// [TokenStorage] and normalizes Dio errors into [ApiException].
class ApiClient {
  ApiClient(this._tokenStorage)
    : dio = Dio(
        BaseOptions(
          baseUrl: Env.apiBaseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 15),
        ),
      ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _tokenStorage.readAccessToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final Dio dio;
  final TokenStorage _tokenStorage;

  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? queryParameters}) =>
      _guard(() => dio.get<T>(path, queryParameters: queryParameters));

  Future<Response<T>> post<T>(String path, {Object? data}) =>
      _guard(() => dio.post<T>(path, data: data));

  Future<Response<T>> put<T>(String path, {Object? data}) =>
      _guard(() => dio.put<T>(path, data: data));

  Future<Response<T>> patch<T>(String path, {Object? data}) =>
      _guard(() => dio.patch<T>(path, data: data));

  Future<Response<T>> delete<T>(String path) => _guard(() => dio.delete<T>(path));

  Future<Response<T>> _guard<T>(Future<Response<T>> Function() request) async {
    try {
      return await request();
    } on DioException catch (error) {
      final statusCode = error.response?.statusCode;

      if (statusCode != null) {
        // A real response came back from the server -- surface its message
        // and raw body as-is; feature screens map `message` to copy and
        // read `errorData` for field-level detail (see ApiException's doc).
        final data = error.response?.data;
        final message = data is Map && data['message'] != null
            ? data['message'].toString()
            : 'Đã xảy ra lỗi không xác định';
        throw ApiException(
          message,
          statusCode: statusCode,
          errorData: data,
          kind: ApiExceptionKind.response,
        );
      }

      // No response at all -- a transport-level problem, not a business
      // one. The Vietnamese copy lives here (not per-screen) because every
      // caller in the app wants the same generic offline/timeout message;
      // business-specific messages (invalid credentials, duplicate email,
      // ...) stay mapped at the screen that knows what they mean.
      final kind = switch (error.type) {
        DioExceptionType.connectionTimeout ||
        DioExceptionType.sendTimeout ||
        DioExceptionType.receiveTimeout => ApiExceptionKind.timeout,
        DioExceptionType.connectionError => ApiExceptionKind.network,
        _ => ApiExceptionKind.unknown,
      };
      final message = switch (kind) {
        ApiExceptionKind.timeout => 'Yêu cầu quá thời gian chờ. Vui lòng thử lại.',
        ApiExceptionKind.network => 'Không có kết nối mạng. Vui lòng kiểm tra và thử lại.',
        _ => error.message ?? 'Đã xảy ra lỗi không xác định',
      };
      throw ApiException(message, kind: kind);
    }
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.watch(tokenStorageProvider));
});
