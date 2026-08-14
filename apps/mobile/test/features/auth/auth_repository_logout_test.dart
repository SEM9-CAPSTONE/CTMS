import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/data/auth_api.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';

class _FakeAuthApi extends AuthApi {
  _FakeAuthApi({
    this.failure,
  }) : super(
          ApiClient(
            TokenStorage(
              const FlutterSecureStorage(),
            ),
          ),
        );

  final Object? failure;

  int logoutCallCount = 0;
  String? receivedRefreshToken;
  bool? receivedAllDevices;

  @override
  Future<void> logout({
    required String refreshToken,
    required bool allDevices,
  }) async {
    logoutCallCount++;
    receivedRefreshToken = refreshToken;
    receivedAllDevices = allDevices;

    if (failure != null) {
      throw failure!;
    }
  }
}

class _FakeTokenStorage extends TokenStorage {
  _FakeTokenStorage({
    this.refreshToken = 'refresh-token-test',
  }) : super(
          const FlutterSecureStorage(),
        );

  String? refreshToken;

  int readRefreshTokenCallCount = 0;
  int clearCallCount = 0;

  @override
  Future<String?> readRefreshToken() async {
    readRefreshTokenCallCount++;
    return refreshToken;
  }

  @override
  Future<void> clear() async {
    clearCallCount++;
  }
}

void main() {
  group('AuthRepository.logout - CTMS-08-T02', () {
    test(
      'API success clears local auth session',
      () async {
        final api = _FakeAuthApi();

        final storage = _FakeTokenStorage(
          refreshToken: 'refresh-current',
        );

        final repository = AuthRepository(
          api,
          storage,
        );

        await repository.logout();

        expect(
          storage.readRefreshTokenCallCount,
          1,
        );

        expect(
          api.logoutCallCount,
          1,
        );

        expect(
          api.receivedRefreshToken,
          'refresh-current',
        );

        expect(
          api.receivedAllDevices,
          isFalse,
        );

        expect(
          storage.clearCallCount,
          1,
        );
      },
    );

    test(
      'all-device logout sends allDevices true then clears local session',
      () async {
        final api = _FakeAuthApi();

        final storage = _FakeTokenStorage(
          refreshToken: 'refresh-all',
        );

        final repository = AuthRepository(
          api,
          storage,
        );

        await repository.logout(
          allDevices: true,
        );

        expect(
          api.logoutCallCount,
          1,
        );

        expect(
          api.receivedRefreshToken,
          'refresh-all',
        );

        expect(
          api.receivedAllDevices,
          isTrue,
        );

        expect(
          storage.clearCallCount,
          1,
        );
      },
    );

    test(
      'API failure does not clear local auth session',
      () async {
        final failure = Exception(
          'logout backend failed',
        );

        final api = _FakeAuthApi(
          failure: failure,
        );

        final storage = _FakeTokenStorage(
          refreshToken: 'refresh-failure',
        );

        final repository = AuthRepository(
          api,
          storage,
        );

        await expectLater(
          repository.logout(),
          throwsA(
            same(failure),
          ),
        );

        expect(
          api.logoutCallCount,
          1,
        );

        expect(
          api.receivedRefreshToken,
          'refresh-failure',
        );
        expect(
          storage.clearCallCount,
          0,
        );
      },
    );

    test(
      'all-device API failure also keeps local auth session',
      () async {
        final failure = Exception(
          'logout all failed',
        );

        final api = _FakeAuthApi(
          failure: failure,
        );

        final storage = _FakeTokenStorage(
          refreshToken: 'refresh-all-failure',
        );

        final repository = AuthRepository(
          api,
          storage,
        );

        await expectLater(
          repository.logout(
            allDevices: true,
          ),
          throwsA(
            same(failure),
          ),
        );

        expect(
          api.logoutCallCount,
          1,
        );

        expect(
          api.receivedAllDevices,
          isTrue,
        );

        expect(
          storage.clearCallCount,
          0,
        );
      },
    );

    test(
      'missing refresh token clears stale local session without calling API',
      () async {
        final api = _FakeAuthApi();

        final storage = _FakeTokenStorage(
          refreshToken: null,
        );

        final repository = AuthRepository(
          api,
          storage,
        );

        await repository.logout();

        expect(
          storage.readRefreshTokenCallCount,
          1,
        );

        expect(
          api.logoutCallCount,
          0,
        );

        expect(
          storage.clearCallCount,
          1,
        );
      },
    );

    test(
      'current-device logout defaults allDevices to false',
      () async {
        final api = _FakeAuthApi();

        final storage = _FakeTokenStorage();

        final repository = AuthRepository(
          api,
          storage,
        );

        await repository.logout();

        expect(
          api.receivedAllDevices,
          isFalse,
        );
      },
    );
  });
}