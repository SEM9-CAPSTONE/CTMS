import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../env/env.dart';
import '../storage/token_storage.dart';
import 'api_exception.dart';
import 'auth_refresh_coordinator.dart';

/// CTMS-04-T03, Security Constraint (shared generic message): shown when
/// the refresh attempt itself failed -- never the backend's specific
/// reason (expired vs revoked vs reused are indistinguishable server-side
/// too, per CTMS-04-T01's DG-01). Same wording family as
/// apps/web/src/core/api/httpClient.ts's `SESSION_EXPIRED_MESSAGE`, for
/// consistent product copy across platforms.
const _sessionExpiredMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';

/// A synthetic `DioException` carrying only the shared generic message --
/// routed through `_guard`'s existing response-mapping logic (below)
/// instead of a separate error-shaping path, so there is exactly one place
/// in this file that turns a Dio error into an [ApiException].
DioException _sessionExpiredError(RequestOptions requestOptions) {
  return DioException(
    requestOptions: requestOptions,
    type: DioExceptionType.badResponse,
    response: Response<dynamic>(
      requestOptions: requestOptions,
      statusCode: 401,
      data: {'message': _sessionExpiredMessage},
    ),
  );
}

/// Thin wrapper around Dio — the Flutter counterpart of
/// apps/web/src/core/api/httpClient.ts. Injects the bearer token from
/// [TokenStorage] and normalizes Dio errors into [ApiException].
///
/// CTMS-04-T03, DG-M2: [onSessionExpired] is a plain callback, not a
/// Riverpod type -- this class has no knowledge of `Ref`,
/// `authControllerProvider`, or `go_router`. The composition root
/// (`main.dart`) is the only place that wires it to
/// `AuthController.clearSession()`.
class ApiClient {
  ApiClient(this._tokenStorage, {AuthRefreshCoordinator? refreshCoordinator, this.onSessionExpired})
    : _refreshCoordinator = refreshCoordinator ?? AuthRefreshCoordinator(_tokenStorage),
      dio = Dio(
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
        onError: _handleError,
      ),
    );
  }

  final Dio dio;
  final TokenStorage _tokenStorage;
  final AuthRefreshCoordinator _refreshCoordinator;

  /// Called once when a refresh attempt itself fails (not when a retried
  /// request fails again -- see [_handleError]'s doc comment). `null` in
  /// tests/contexts that don't wire session-expiry handling.
  final Future<void> Function()? onSessionExpired;

  /// CTMS-04-T03, DG-M3/DG-M4. Frozen invariants:
  /// - "Protected request" = the failed request carried an `Authorization`
  ///   header (attached by `onRequest` above) -- no per-endpoint whitelist.
  /// - Retry happens at most once: `extra['isRetryAfterRefresh']` is the
  ///   internal-only marker (Dio's own idiomatic place for such flags),
  ///   checked here and set on the retried request before it is re-sent.
  /// - Only a failed *refresh* (the coordinator itself throwing) triggers
  ///   [onSessionExpired] + the generic message. A retried request that
  ///   fails again (even with a fresh 401) is NOT treated as a session
  ///   expiry -- it re-enters this handler with the retry flag already
  ///   set, is rejected unchanged by the early-return guard below, and
  ///   surfaces through `_guard` with whatever the backend actually said.
  ///   This mirrors apps/web/src/core/api/httpClient.ts's `performRequest`
  ///   exactly: a second 401 on the retry falls through to the normal
  ///   error path, not a second refresh/auto-logout.
  Future<void> _handleError(DioException err, ErrorInterceptorHandler handler) async {
    final statusCode = err.response?.statusCode;
    final hadAuthHeader = err.requestOptions.headers.containsKey('Authorization');
    final isRetry = err.requestOptions.extra['isRetryAfterRefresh'] == true;

    if (statusCode != 401 || !hadAuthHeader || isRetry) {
      handler.next(err);
      return;
    }

    final String newAccessToken;
    try {
      newAccessToken = await _refreshCoordinator.refresh();
    } catch (_) {
      await onSessionExpired?.call();
      handler.reject(_sessionExpiredError(err.requestOptions));
      return;
    }

    // Rebuild the retried request with the NEW token -- `dio.fetch` replays
    // `requestOptions` as-is, so the stale `Authorization` header from the
    // original (failed) attempt must be overwritten first, not just
    // re-sent unchanged.
    err.requestOptions.headers['Authorization'] = 'Bearer $newAccessToken';
    err.requestOptions.extra = {...err.requestOptions.extra, 'isRetryAfterRefresh': true};

    try {
      final response = await dio.fetch<dynamic>(err.requestOptions);
      handler.resolve(response);
    } catch (retryError) {
      handler.next(
        retryError is DioException
            ? retryError
            : DioException(requestOptions: err.requestOptions, error: retryError),
      );
    }
  }

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
