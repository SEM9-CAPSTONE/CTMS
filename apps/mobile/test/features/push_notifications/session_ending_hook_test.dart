import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/lifecycle/session_hooks.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/application/auth_controller.dart';
import 'package:mobile/features/auth/data/auth_api.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/auth/domain/user_role.dart';

const _user = AuthUser(
  id: 'camper-1',
  email: 'camper@example.com',
  role: UserRole.camper,
);

class _Repository extends AuthRepository {
  _Repository(this.calls)
    : super(
        AuthApi(ApiClient(TokenStorage(const FlutterSecureStorage()))),
        TokenStorage(const FlutterSecureStorage()),
      );

  final List<String> calls;

  @override
  Future<AuthUser?> tryRestoreSession() async => null;

  @override
  Future<AuthUser> login({
    required String identifier,
    required String password,
  }) async => _user;

  @override
  Future<void> logout({bool allDevices = false}) async => calls.add('logout');
}

Future<ProviderContainer> signedIn(
  List<String> calls,
  SessionEndingHook hook,
) async {
  final container = ProviderContainer(
    overrides: [
      authRepositoryProvider.overrideWithValue(_Repository(calls)),
      sessionEndingHookProvider.overrideWithValue(hook),
    ],
  );
  await container.read(authControllerProvider.future);
  await container
      .read(authControllerProvider.notifier)
      .login(identifier: 'camper@example.com', password: 'secret');
  return container;
}

void main() {
  test(
    'removes the push device while the session is still valid, before signing out (CTMS-090-T02)',
    () async {
      final calls = <String>[];
      final container = await signedIn(calls, () async => calls.add('hook'));
      addTearDown(container.dispose);

      await container.read(authControllerProvider.notifier).logout();

      expect(calls, ['hook', 'logout']);
      expect(container.read(authControllerProvider).valueOrNull, isNull);
    },
  );

  test('a failing push clean-up never blocks the sign-out', () async {
    final calls = <String>[];
    final container = await signedIn(
      calls,
      () async => throw Exception('offline'),
    );
    addTearDown(container.dispose);

    await container.read(authControllerProvider.notifier).logout();

    expect(calls, ['logout']);
    expect(container.read(authControllerProvider).valueOrNull, isNull);
  });
}
