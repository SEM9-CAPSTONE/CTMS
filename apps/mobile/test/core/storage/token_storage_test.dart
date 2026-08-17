import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_secure_storage/test/test_flutter_secure_storage_platform.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/auth/domain/user_role.dart';

const _dummyUser = AuthUser(
  id: 'user-1',
  fullName: 'Nguyễn Văn A',
  email: 'camper@example.com',
  phone: '0912345678',
  role: UserRole.camper,
);

/// Records write order (and can be told to throw on a specific key) while
/// delegating everything else to the real in-memory
/// [TestFlutterSecureStoragePlatform] -- `flutter_secure_storage`'s own
/// first-party test hook (`FlutterSecureStorage.setMockInitialValues`),
/// not a new dependency. This is the only way to exercise the *real*
/// [TokenStorage] implementation under `flutter_test` (no platform channel
/// otherwise available -- see the class doc on the existing `_FakeTokenStorage`
/// in auth_controller_test.dart), and the only way to observe write order.
class _RecordingPlatform extends TestFlutterSecureStoragePlatform {
  _RecordingPlatform() : super({});

  final List<String> writeOrder = [];
  String? throwOnKey;

  @override
  Future<void> write({required String key, required String value, required Map<String, String> options}) async {
    writeOrder.add(key);
    if (key == throwOnKey) {
      throw const FlutterSecureStorageWriteFailure();
    }
    await super.write(key: key, value: value, options: options);
  }
}

/// Distinguishable test-only failure -- not a real plugin exception type,
/// just something `expect(..., throwsA(...))` can match on precisely.
class FlutterSecureStorageWriteFailure implements Exception {
  const FlutterSecureStorageWriteFailure();
}

void main() {
  late _RecordingPlatform platform;
  late TokenStorage tokenStorage;

  setUp(() {
    platform = _RecordingPlatform();
    FlutterSecureStoragePlatform.instance = platform;
    tokenStorage = TokenStorage(const FlutterSecureStorage());
  });

  group('TokenStorage.saveTokens (CTMS-04-T03)', () {
    test('persists both tokens, readable back through their own getters', () async {
      await tokenStorage.saveTokens(accessToken: 'new-access', refreshToken: 'new-refresh');

      expect(await tokenStorage.readAccessToken(), 'new-access');
      expect(await tokenStorage.readRefreshToken(), 'new-refresh');
    });

    test('writes refreshToken before accessToken (DG-M5 order)', () async {
      await tokenStorage.saveTokens(accessToken: 'new-access', refreshToken: 'new-refresh');

      expect(platform.writeOrder, ['refreshToken', 'accessToken']);
    });

    test('does not touch the cached-user key -- saveSession is the only writer of it', () async {
      await tokenStorage.saveTokens(accessToken: 'new-access', refreshToken: 'new-refresh');

      expect(platform.writeOrder, isNot(contains('cachedUser')));
    });

    test(
      'a failure writing accessToken (the 2nd write) leaves the already-written '
      'refreshToken persisted -- the coordinator-level failure (Step 3/4) still '
      'treats this as a failed refresh attempt as a whole; this only proves what '
      'is left on disk, not that the attempt "succeeds partially"',
      () async {
        platform.throwOnKey = 'accessToken';

        await expectLater(
          tokenStorage.saveTokens(accessToken: 'new-access', refreshToken: 'new-refresh'),
          throwsA(isA<FlutterSecureStorageWriteFailure>()),
        );

        // refreshToken's write already completed before the throw.
        expect(await tokenStorage.readRefreshToken(), 'new-refresh');
        // accessToken's write never completed.
        expect(await tokenStorage.readAccessToken(), isNull);
      },
    );

    test(
      'a failure writing refreshToken (the 1st write) leaves no new token persisted at all',
      () async {
        platform.throwOnKey = 'refreshToken';

        await expectLater(
          tokenStorage.saveTokens(accessToken: 'new-access', refreshToken: 'new-refresh'),
          throwsA(isA<FlutterSecureStorageWriteFailure>()),
        );

        expect(await tokenStorage.readRefreshToken(), isNull);
        expect(await tokenStorage.readAccessToken(), isNull);
      },
    );

    test('does not modify saveSession -- login still writes accessToken before refreshToken', () async {
      await tokenStorage.saveSession(
        accessToken: 'login-access',
        refreshToken: 'login-refresh',
        user: _dummyUser,
      );

      expect(platform.writeOrder, ['accessToken', 'refreshToken', 'cachedUser']);
    });
  });

  group('TokenStorage.readRefreshToken', () {
    test('returns null when nothing has been saved', () async {
      expect(await tokenStorage.readRefreshToken(), isNull);
    });
  });
}
