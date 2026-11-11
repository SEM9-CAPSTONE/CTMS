import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../env/env.dart';
import '../storage/token_storage.dart';
import 'api_endpoints.dart';

/// CTMS-04-T03, DG-M3. The Flutter counterpart of
/// apps/web/src/core/api/authRefresh.ts -- a single-flight coordinator for
/// `POST /auth/refresh`, deliberately independent of [ApiClient]'s `dio`
/// (core/api/api_client.dart).
///
/// Frozen invariant: [_refreshDio] carries no interceptors -- it cannot
/// re-enter [ApiClient]'s 401-handling (Step 4), so a 401 on the refresh
/// call itself can never trigger another refresh attempt. It is a plain
/// refresh failure, handled entirely by the caller (Step 4's
/// `onSessionExpired`), not by this class.
class AuthRefreshCoordinator {
  /// [refreshDio] is test-only injection (Step 7) -- `_refreshDio` is
  /// otherwise unreachable from a test file (Dart privacy is per-file), so
  /// there is no other way to swap in a fake `HttpClientAdapter` for
  /// isolated coordinator tests. Production call sites never pass it; the
  /// default is the real, interceptor-free Dio described in this class's
  /// doc comment.
  AuthRefreshCoordinator(this._tokenStorage, {Dio? refreshDio})
    : _refreshDio =
          refreshDio ??
          Dio(
            BaseOptions(
              baseUrl: Env.apiBaseUrl,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 15),
            ),
          );

  final TokenStorage _tokenStorage;
  final Dio _refreshDio;

  /// Single-flight in-progress refresh, or null when none is running.
  Future<String>? _inFlight;

  /// Resolves with the new access token once refreshed. Every concurrent
  /// caller -- however many protected requests 401 at the same moment --
  /// gets and awaits this exact same [Future]; only the first caller to
  /// observe `_inFlight == null` actually starts [_performRefresh]. The
  /// check (`_inFlight == null`) and the set (`_inFlight = ...`) happen in
  /// the same synchronous expression (`??=`), with no `await` between them
  /// -- Dart's single-threaded event loop (per isolate) guarantees no other
  /// caller can interleave inside this function body and observe a
  /// half-updated `_inFlight`, the same reasoning `authRefresh.ts` relies
  /// on for JS. Resets to null via `whenComplete` regardless of outcome, so
  /// the next 401 (success or failure) starts a fresh attempt.
  Future<String> refresh() {
    return _inFlight ??= _performRefresh().whenComplete(() => _inFlight = null);
  }

  Future<String> _performRefresh() async {
    final refreshToken = await _tokenStorage.readRefreshToken();
    if (refreshToken == null) {
      // Nothing to refresh with -- treated as a refresh failure by the
      // caller, same as an expired/revoked token would be.
      throw StateError('No refresh token available');
    }

    // Raw `_refreshDio.post` -- no interceptor attaches an Authorization
    // header here (unlike ApiClient's `dio`), matching the backend
    // contract: `POST /auth/refresh` authenticates via the body's
    // `refreshToken`, not a bearer header. A non-2xx response makes Dio
    // throw a `DioException` on its own (default `validateStatus`), so no
    // manual status check is needed here.
    final response = await _refreshDio.post<Map<String, dynamic>>(
      ApiEndpoints.auth.refresh,
      data: {'refreshToken': refreshToken},
    );
    final data = response.data ?? const {};
    final newAccessToken = data['accessToken'] as String;
    final newRefreshToken = data['refreshToken'] as String;

    await _tokenStorage.saveTokens(accessToken: newAccessToken, refreshToken: newRefreshToken);

    return newAccessToken;
  }
}

final authRefreshCoordinatorProvider = Provider<AuthRefreshCoordinator>((ref) {
  return AuthRefreshCoordinator(ref.watch(tokenStorageProvider));
});
