import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/application/auth_controller.dart';
import 'package:mobile/features/auth/data/auth_api.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/auth/domain/user_role.dart';

const _user = AuthUser(
  id: 'user-1',
  fullName: 'Nguyễn Văn A',
  email: 'camper@example.com',
  phone: '0912345678',
  role: UserRole.camper,
);

/// Records what identifier/password [AuthApi.login] would have been called
/// with, and either resolves with [_user] or throws [failure]. No network,
/// same pattern as the register-side recording fakes.
class _RecordingAuthRepository extends AuthRepository {
  _RecordingAuthRepository({this.failure, this.logoutFailure})
    : super(
        AuthApi(ApiClient(TokenStorage(const FlutterSecureStorage()))),
        TokenStorage(const FlutterSecureStorage()),
      );

  /// login()'s own failure -- kept separate from [logoutFailure] so a test
  /// can make `logout()` fail without also breaking `loggedInContainer()`'s
  /// own prerequisite login call.
  final Object? failure;
  final Object? logoutFailure;
  int loginCallCount = 0;
  int logoutCallCount = 0;
  int clearLocalSessionCallCount = 0;
  bool? lastAllDevices;
  String? lastIdentifier;

  @override
  Future<AuthUser> login({required String identifier, required String password}) async {
    loginCallCount++;
    lastIdentifier = identifier;
    if (failure != null) throw failure!;
    return _user;
  }

  @override
  Future<AuthUser?> tryRestoreSession() async => null;

  /// CTMS-08: the real, API-backed, user-initiated logout -- can fail.
  @override
  Future<void> logout({bool allDevices = false}) async {
    logoutCallCount++;
    lastAllDevices = allDevices;
    if (logoutFailure != null) throw logoutFailure!;
  }

  /// CTMS-04-T03: the local-only primitive `clearSession()` actually calls
  /// -- deliberately a DIFFERENT method from [logout] above (see
  /// AuthController.clearSession's doc comment for why), so it needs its
  /// own counter, not `logoutCallCount`.
  @override
  Future<void> clearLocalSession() async {
    clearLocalSessionCallCount++;
  }
}

void main() {
  group('AuthController.login', () {
    test('sends the typed value as identifier, never as email', () async {
      final repository = _RecordingAuthRepository();
      final container = ProviderContainer(
        overrides: [authRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await container
          .read(authControllerProvider.notifier)
          .login(identifier: '0912345678', password: 's3cretPass');

      expect(repository.lastIdentifier, '0912345678');
    });

    test('a second concurrent call while loading is a no-op (BR-241 guard)', () async {
      final repository = _RecordingAuthRepository();
      final container = ProviderContainer(
        overrides: [authRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      final notifier = container.read(authControllerProvider.notifier);
      // Fire 3 near-simultaneous taps before any of them resolve.
      final first = notifier.login(identifier: 'camper@example.com', password: 's3cretPass');
      final second = notifier.login(identifier: 'camper@example.com', password: 's3cretPass');
      final third = notifier.login(identifier: 'camper@example.com', password: 's3cretPass');
      await Future.wait([first, second, third]);

      expect(repository.loginCallCount, 1);
    });

    test('on success, state holds the authenticated user', () async {
      final repository = _RecordingAuthRepository();
      final container = ProviderContainer(
        overrides: [authRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await container
          .read(authControllerProvider.notifier)
          .login(identifier: 'camper@example.com', password: 's3cretPass');

      expect(container.read(authControllerProvider).value, _user);
    });

    test('on failure, state carries the error and stays unauthenticated', () async {
      final repository = _RecordingAuthRepository(
        failure: ApiException('Invalid credentials', statusCode: 401),
      );
      final container = ProviderContainer(
        overrides: [authRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await container
          .read(authControllerProvider.notifier)
          .login(identifier: 'camper@example.com', password: 'wrong-password');

      final state = container.read(authControllerProvider);
      expect(state.hasError, isTrue);
      expect(state.value, isNull);
    });
  });

  group('AuthController.clearSession / logout (CTMS-04-T03, DG-M1)', () {
    Future<ProviderContainer> loggedInContainer(_RecordingAuthRepository repository) async {
      final container = ProviderContainer(
        overrides: [authRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      await container
          .read(authControllerProvider.notifier)
          .login(identifier: 'camper@example.com', password: 's3cretPass');
      expect(container.read(authControllerProvider).value, _user);
      return container;
    }

    test('clearSession() clears LOCAL state only -- never calls the real logout() API', () async {
      final repository = _RecordingAuthRepository();
      final container = await loggedInContainer(repository);

      await container.read(authControllerProvider.notifier).clearSession();

      expect(repository.clearLocalSessionCallCount, 1);
      expect(repository.logoutCallCount, 0); // CTMS-08's API-backed logout is a different path
      expect(container.read(authControllerProvider).value, isNull);
    });

    test('is safe to call more than once concurrently -- relevant once multiple failed '
        'requests independently reach onSessionExpired after one shared failed refresh', () async {
      final repository = _RecordingAuthRepository();
      final container = await loggedInContainer(repository);
      final notifier = container.read(authControllerProvider.notifier);

      await Future.wait([notifier.clearSession(), notifier.clearSession(), notifier.clearSession()]);

      expect(repository.clearLocalSessionCallCount, 3); // each call still reaches the repository...
      expect(container.read(authControllerProvider).value, isNull); // ...but state ends up consistent either way
    });

    // CTMS-08: logout() is the real, API-backed, user-initiated action --
    // a different code path from clearSession() above. Full behavioral
    // coverage lives in CTMS-08's own auth_repository_logout_test.dart;
    // these two only confirm AuthController's side of the split.
    test('logout() calls the real logout() API, not clearLocalSession()', () async {
      final repository = _RecordingAuthRepository();
      final container = await loggedInContainer(repository);

      await container.read(authControllerProvider.notifier).logout(allDevices: true);

      expect(repository.logoutCallCount, 1);
      expect(repository.lastAllDevices, isTrue);
      expect(repository.clearLocalSessionCallCount, 0);
      expect(container.read(authControllerProvider).value, isNull);
    });

    test('logout() failure surfaces as AsyncError and rethrows, session stays as-is', () async {
      final repository = _RecordingAuthRepository(
        logoutFailure: ApiException('Network error', kind: ApiExceptionKind.network),
      );
      final container = await loggedInContainer(repository);

      await expectLater(
        container.read(authControllerProvider.notifier).logout(),
        throwsA(isA<ApiException>()),
      );

      expect(container.read(authControllerProvider).hasError, isTrue);
    });
  });

  group('AuthRepository.tryRestoreSession (local-only, no /auth/me)', () {
    test('returns null when no token is stored', () async {
      final tokenStorage = _FakeTokenStorage();
      final repository = AuthRepository(
        AuthApi(ApiClient(tokenStorage)),
        tokenStorage,
      );

      expect(await repository.tryRestoreSession(), isNull);
    });

    test('returns the cached user when both a token and a valid profile exist', () async {
      final tokenStorage = _FakeTokenStorage()
        ..access = 'valid-access-token'
        ..cachedUser = _user;
      final repository = AuthRepository(AuthApi(ApiClient(tokenStorage)), tokenStorage);

      expect(await repository.tryRestoreSession(), _user);
    });

    test(
      'treats a token with no decodable cached profile as failed session-initialization',
      () async {
        // CTMS-03-T03's explicit test case: "Simulate a failed secure-storage
        // or session-initialization operation and return to a safe
        // unauthenticated state" -- a token surviving while its paired
        // profile is missing/corrupt (partial write, format change across
        // an app update) must not be treated as "logged in".
        final tokenStorage = _FakeTokenStorage()..access = 'valid-access-token';
        final repository = AuthRepository(AuthApi(ApiClient(tokenStorage)), tokenStorage);

        expect(await repository.tryRestoreSession(), isNull);
        // The safe-unauthenticated-state part: the stale token must not be
        // left behind for the next restore attempt to trip over again.
        expect(tokenStorage.cleared, isTrue);
      },
    );
  });
}

/// In-memory [TokenStorage] double — [FlutterSecureStorage] has no platform
/// channel under `flutter_test`, so this is the only way to exercise
/// [AuthRepository.tryRestoreSession]'s branches without a real device.
class _FakeTokenStorage extends TokenStorage {
  _FakeTokenStorage() : super(const FlutterSecureStorage());

  String? access;
  AuthUser? cachedUser;
  bool cleared = false;

  @override
  Future<String?> readAccessToken() async => access;

  @override
  Future<AuthUser?> readCachedUser() async => cachedUser;

  @override
  Future<void> clear() async {
    cleared = true;
    access = null;
    cachedUser = null;
  }
}
