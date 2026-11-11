import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/auth_refresh_coordinator.dart';
import 'package:mobile/core/storage/token_storage.dart';

/// In-memory fake of `TokenStorage` -- same technique as the existing
/// `_FakeTokenStorage` in auth_controller_test.dart (extends the real
/// class, overrides individual methods; `FlutterSecureStorage` has no
/// platform channel under `flutter_test`).
class _FakeTokenStorage extends TokenStorage {
  _FakeTokenStorage({this.refreshToken}) : super(const FlutterSecureStorage());

  String? refreshToken;
  String? savedAccessToken;
  String? savedRefreshToken;
  int saveTokensCallCount = 0;

  @override
  Future<String?> readRefreshToken() async => refreshToken;

  @override
  Future<void> saveTokens({required String accessToken, required String refreshToken}) async {
    saveTokensCallCount++;
    savedAccessToken = accessToken;
    savedRefreshToken = refreshToken;
  }
}

/// Fake `HttpClientAdapter` -- Dio's own extension point, no mocking
/// package needed. Records every request and either resolves immediately
/// via [onFetch] or waits on a manually-controlled [Completer] when
/// [holdResponse] is set, letting tests prove genuine concurrency (2
/// requests both in flight before either resolves) the same way
/// apps/web/src/core/api/httpClient.test.ts does for the JS side.
class _FakeAdapter implements HttpClientAdapter {
  int callCount = 0;
  final List<RequestOptions> requests = [];
  ResponseBody Function(RequestOptions options)? onFetch;
  Completer<ResponseBody>? holdResponse;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    callCount++;
    requests.add(options);
    if (holdResponse != null) return holdResponse!.future;
    return Future.value(onFetch!(options));
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

void main() {
  late _FakeAdapter adapter;
  late _FakeTokenStorage tokenStorage;
  late AuthRefreshCoordinator coordinator;

  setUp(() {
    adapter = _FakeAdapter();
    tokenStorage = _FakeTokenStorage(refreshToken: 'old-refresh-token');
    final dio = Dio(BaseOptions(baseUrl: 'http://test.local'))..httpClientAdapter = adapter;
    coordinator = AuthRefreshCoordinator(tokenStorage, refreshDio: dio);
  });

  group('AuthRefreshCoordinator.refresh -- success', () {
    test('resolves with the new access token', () async {
      adapter.onFetch = (_) => _jsonResponse({'accessToken': 'new-access', 'refreshToken': 'new-refresh'}, 200);

      final result = await coordinator.refresh();

      expect(result, 'new-access');
    });

    test('persists the rotated pair via TokenStorage.saveTokens', () async {
      adapter.onFetch = (_) => _jsonResponse({'accessToken': 'new-access', 'refreshToken': 'new-refresh'}, 200);

      await coordinator.refresh();

      expect(tokenStorage.saveTokensCallCount, 1);
      expect(tokenStorage.savedAccessToken, 'new-access');
      expect(tokenStorage.savedRefreshToken, 'new-refresh');
    });

    test('sends the current refresh token in the request body, not a header', () async {
      adapter.onFetch = (_) => _jsonResponse({'accessToken': 'new-access', 'refreshToken': 'new-refresh'}, 200);

      await coordinator.refresh();

      expect(adapter.requests, hasLength(1));
      expect(adapter.requests.single.data, {'refreshToken': 'old-refresh-token'});
      expect(adapter.requests.single.path, '/auth/refresh');
    });

    test(
      'DG-M3 isolation: the refresh request never carries an Authorization header '
      '-- no onRequest interceptor is attached to refreshDio',
      () async {
        adapter.onFetch = (_) => _jsonResponse({'accessToken': 'new-access', 'refreshToken': 'new-refresh'}, 200);

        await coordinator.refresh();

        expect(adapter.requests.single.headers.containsKey('Authorization'), isFalse);
      },
    );
  });

  group('AuthRefreshCoordinator.refresh -- failure', () {
    test('rejects without ever calling the network when no refresh token is stored', () async {
      tokenStorage.refreshToken = null;

      await expectLater(coordinator.refresh(), throwsA(isA<StateError>()));
      expect(adapter.callCount, 0);
    });

    test('rejects when the backend returns a non-2xx response (Dio throws on its own)', () async {
      adapter.onFetch = (_) => _jsonResponse({'message': 'Invalid refresh token'}, 401);

      await expectLater(coordinator.refresh(), throwsA(isA<DioException>()));
      expect(tokenStorage.saveTokensCallCount, 0);
    });

    test('a failed refresh does not call TokenStorage.saveTokens at all', () async {
      adapter.onFetch = (_) => _jsonResponse({'message': 'Invalid refresh token'}, 401);

      await expectLater(coordinator.refresh(), throwsA(isA<DioException>()));

      expect(tokenStorage.saveTokensCallCount, 0);
      expect(tokenStorage.savedAccessToken, isNull);
    });
  });

  group('AuthRefreshCoordinator.refresh -- single-flight (DG-M3)', () {
    test('N concurrent callers collapse into exactly 1 HTTP call and share the same result', () async {
      final completer = Completer<ResponseBody>();
      adapter.holdResponse = completer;

      // No `await` between these 3 calls -- `refresh()`'s `_inFlight ??=`
      // check-and-set runs synchronously, so all 3 observe the same
      // in-flight Future before any of `_performRefresh`'s own internal
      // `await`s (reading the refresh token, calling the network) have had
      // a chance to run.
      final call1 = coordinator.refresh();
      final call2 = coordinator.refresh();
      final call3 = coordinator.refresh();

      // Let the async chain (TokenStorage read, Dio's own internal
      // interceptor/transform pipeline) progress up to -- and pause at --
      // the actual network call, which `completer` is holding open.
      await pumpEventQueue();
      expect(adapter.callCount, 1);

      completer.complete(_jsonResponse({'accessToken': 'new-access', 'refreshToken': 'new-refresh'}, 200));
      final results = await Future.wait([call1, call2, call3]);

      expect(adapter.callCount, 1);
      expect(results, ['new-access', 'new-access', 'new-access']);
      expect(tokenStorage.saveTokensCallCount, 1);
    });

    test('resets after success -- the next refresh() starts a brand-new HTTP call', () async {
      adapter.onFetch = (_) => _jsonResponse({'accessToken': 'first-access', 'refreshToken': 'first-refresh'}, 200);
      await coordinator.refresh();
      expect(adapter.callCount, 1);

      adapter.onFetch = (_) => _jsonResponse({'accessToken': 'second-access', 'refreshToken': 'second-refresh'}, 200);
      final second = await coordinator.refresh();

      expect(adapter.callCount, 2);
      expect(second, 'second-access');
    });

    test('resets after failure -- the next refresh() retries instead of replaying the old rejection', () async {
      adapter.onFetch = (_) => _jsonResponse({'message': 'Invalid refresh token'}, 401);
      await expectLater(coordinator.refresh(), throwsA(isA<DioException>()));
      expect(adapter.callCount, 1);

      adapter.onFetch = (_) => _jsonResponse({'accessToken': 'recovered-access', 'refreshToken': 'recovered-refresh'}, 200);
      final result = await coordinator.refresh();

      expect(adapter.callCount, 2);
      expect(result, 'recovered-access');
    });
  });
}
