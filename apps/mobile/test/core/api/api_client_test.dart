import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/api/auth_refresh_coordinator.dart';
import 'package:mobile/core/storage/token_storage.dart';

/// CTMS-04-T03, Step 7. Real `ApiClient` (real `onRequest`/`onError`
/// interceptors) with only the network boundary faked (`dio.httpClientAdapter`,
/// a public field -- see api_client.dart), the same "fake the edge, keep the
/// real code under test" approach as apps/web/src/core/api/httpClient.test.ts.
/// Fully in-memory -- overrides every method any code path under test
/// touches (`FlutterSecureStorage` itself has no platform channel under
/// `flutter_test`; the real methods would throw `MissingPluginException`).
class _FakeTokenStorage extends TokenStorage {
  _FakeTokenStorage({this.accessToken, this.refreshToken}) : super(const FlutterSecureStorage());

  String? accessToken;
  String? refreshToken;

  @override
  Future<String?> readAccessToken() async => accessToken;

  @override
  Future<String?> readRefreshToken() async => refreshToken;

  @override
  Future<void> saveTokens({required String accessToken, required String refreshToken}) async {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
}

/// Isolated double for [AuthRefreshCoordinator] -- used by the tests that
/// only care about *how ApiClient reacts* to refresh success/failure, not
/// the coordinator's own single-flight mechanics (that is
/// auth_refresh_coordinator_test.dart's job). Extends the real class so
/// `ApiClient`'s `AuthRefreshCoordinator?` parameter type is satisfied
/// without widening it to an interface just for tests.
///
/// Shares [tokenStorage] with the `ApiClient` under test and updates its
/// `accessToken` on a successful "refresh", exactly like the real
/// coordinator's `TokenStorage.saveTokens()` call would -- otherwise
/// `ApiClient`'s own `onRequest` interceptor re-reads the OLD token on the
/// retry (it always reads fresh from `TokenStorage`, never trusts a header
/// this class set manually) and the retry fails for a reason that has
/// nothing to do with the interceptor logic under test.
class _FakeCoordinator extends AuthRefreshCoordinator {
  _FakeCoordinator(this.tokenStorage) : super(tokenStorage);

  final _FakeTokenStorage tokenStorage;
  int callCount = 0;
  String? nextAccessToken;
  Object? nextError;

  @override
  Future<String> refresh() async {
    callCount++;
    if (nextError != null) throw nextError!;
    tokenStorage.accessToken = nextAccessToken;
    return nextAccessToken!;
  }
}

class _FakeAdapter implements HttpClientAdapter {
  final List<RequestOptions> requests = [];

  /// `ApiClient._handleError` mutates `err.requestOptions` IN PLACE before
  /// retrying (`dio.fetch(err.requestOptions)` reuses the same object, the
  /// standard Dio idiom) -- so `requests[n].headers` reflects whatever the
  /// header looks like NOW, not at the moment request #n was actually
  /// sent. A snapshot taken at `fetch()`-time is the only reliable way to
  /// tell what Authorization header a given attempt was really sent with.
  final List<String?> authHeaderSnapshots = [];

  /// Decides the response for every request that reaches this adapter --
  /// content/header-based rather than a positional queue, so it stays
  /// correct regardless of how 2 concurrent requests happen to interleave.
  late ResponseBody Function(RequestOptions options) onFetch;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    authHeaderSnapshots.add(options.headers['Authorization'] as String?);
    return onFetch(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _jsonResponse(Map<String, dynamic> data, int statusCode) {
  return ResponseBody.fromString(
    jsonEncode(data),
    statusCode,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}

ResponseBody _errorResponse(int statusCode, String message) => _jsonResponse({'message': message}, statusCode);

void main() {
  late _FakeAdapter adapter;
  late _FakeTokenStorage tokenStorage;
  late _FakeCoordinator coordinator;
  late int onSessionExpiredCallCount;
  late ApiClient client;

  setUp(() {
    adapter = _FakeAdapter();
    tokenStorage = _FakeTokenStorage();
    coordinator = _FakeCoordinator(tokenStorage);
    onSessionExpiredCallCount = 0;
    client = ApiClient(
      tokenStorage,
      refreshCoordinator: coordinator,
      onSessionExpired: () async {
        onSessionExpiredCallCount++;
      },
    );
    client.dio.httpClientAdapter = adapter;
  });

  group('ApiClient -- public (unauthenticated) requests', () {
    test('a 401 with no Authorization header is never sent to the refresh coordinator', () async {
      // No access token stored -- onRequest attaches no Authorization
      // header (DG-M4's exact definition of "not a protected request").
      adapter.onFetch = (_) => _errorResponse(401, 'Invalid credentials');

      await expectLater(
        client.get<Map<String, dynamic>>('/auth/login'),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Invalid credentials')),
      );

      expect(coordinator.callCount, 0);
      expect(onSessionExpiredCallCount, 0);
      expect(adapter.requests, hasLength(1));
    });
  });

  group('ApiClient -- protected requests, retry-once (DG-M4)', () {
    test('401 -> refresh -> retry with the NEW token -> success, exactly once', () async {
      tokenStorage.accessToken = 'old-token';
      coordinator.nextAccessToken = 'new-token';
      adapter.onFetch = (options) {
        final auth = options.headers['Authorization'];
        if (auth == 'Bearer old-token') return _errorResponse(401, 'jwt expired');
        if (auth == 'Bearer new-token') return _jsonResponse({'ok': true}, 200);
        throw StateError('unexpected Authorization: $auth');
      };

      final response = await client.get<Map<String, dynamic>>('/profiles/me');

      expect(response.data, {'ok': true});
      expect(coordinator.callCount, 1);
      expect(adapter.requests, hasLength(2));
      expect(adapter.authHeaderSnapshots[0], 'Bearer old-token');
      expect(adapter.authHeaderSnapshots[1], 'Bearer new-token');
      expect(adapter.requests[1].extra['isRetryAfterRefresh'], isTrue);
    });

    test('the retried request failing again (even with a fresh 401) does NOT trigger a second refresh', () async {
      tokenStorage.accessToken = 'old-token';
      coordinator.nextAccessToken = 'new-token';
      var callCount = 0;
      adapter.onFetch = (_) {
        callCount++;
        return _errorResponse(401, callCount == 1 ? 'jwt expired' : 'still unauthorized after retry');
      };

      await expectLater(
        client.get<Map<String, dynamic>>('/profiles/me'),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', 'still unauthorized after retry')),
      );

      // Exactly 1 refresh call, not 2 -- DG-M4's "no loop" invariant. The
      // retry's own failure surfaces with the BACKEND's message, not the
      // session-expired one -- only a failed *refresh* means that.
      expect(coordinator.callCount, 1);
      expect(onSessionExpiredCallCount, 0);
      expect(adapter.requests, hasLength(2));
    });
  });

  group('ApiClient -- refresh failure (DG-M1/DG-M2)', () {
    test('onSessionExpired fires exactly once and the shared generic message is surfaced, not a backend detail', () async {
      tokenStorage.accessToken = 'old-token';
      coordinator.nextError = StateError('refresh token revoked');
      adapter.onFetch = (_) => _errorResponse(401, 'jwt expired');

      await expectLater(
        client.get<Map<String, dynamic>>('/profiles/me'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            // Must match `_sessionExpiredMessage` in api_client.dart
            // exactly -- intentionally private (mirrors
            // apps/web/src/core/api/httpClient.ts's SESSION_EXPIRED_MESSAGE),
            // so this string is duplicated here rather than imported.
            'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          ),
        ),
      );

      expect(onSessionExpiredCallCount, 1);
      expect(coordinator.callCount, 1);
      // Never retried -- there is no new token to retry with.
      expect(adapter.requests, hasLength(1));
    });

    test('a failed refresh never surfaces the backend-specific revocation reason', () async {
      tokenStorage.accessToken = 'old-token';
      coordinator.nextError = StateError('refresh token revoked');
      adapter.onFetch = (_) => _errorResponse(401, 'jwt expired');

      ApiException? error;
      try {
        await client.get<Map<String, dynamic>>('/profiles/me');
      } on ApiException catch (e) {
        error = e;
      }

      expect(error, isNotNull);
      expect(error!.message, isNot(contains('revoked')));
    });
  });

  group('ApiClient + real AuthRefreshCoordinator -- concurrent protected 401s (DG-M3)', () {
    test('2 simultaneous 401s collapse into exactly 1 /auth/refresh call, both requests succeed after retry', () async {
      final refreshAdapter = _FakeAdapter()
        ..onFetch = (_) => _jsonResponse({'accessToken': 'new-token', 'refreshToken': 'new-refresh'}, 200);
      final refreshDio = Dio(BaseOptions(baseUrl: 'http://test.local'))..httpClientAdapter = refreshAdapter;
      final realTokenStorage = _FakeTokenStorage(accessToken: 'old-token', refreshToken: 'old-refresh');
      final realCoordinator = AuthRefreshCoordinator(realTokenStorage, refreshDio: refreshDio);

      final concurrentClient = ApiClient(realTokenStorage, refreshCoordinator: realCoordinator);
      final clientAdapter = _FakeAdapter()
        ..onFetch = (options) {
          final auth = options.headers['Authorization'];
          if (auth == 'Bearer old-token') return _errorResponse(401, 'jwt expired');
          if (auth == 'Bearer new-token') return _jsonResponse({'ok': true}, 200);
          throw StateError('unexpected Authorization: $auth');
        };
      concurrentClient.dio.httpClientAdapter = clientAdapter;

      final results = await Future.wait([
        concurrentClient.get<Map<String, dynamic>>('/profiles/me'),
        concurrentClient.get<Map<String, dynamic>>('/profiles/me'),
      ]);

      expect(results.map((r) => r.data), [
        {'ok': true},
        {'ok': true},
      ]);
      // The proof that matters: however many protected requests 401'd at
      // once, exactly 1 POST /auth/refresh was actually sent.
      expect(refreshAdapter.requests, hasLength(1));
    });
  });
}
