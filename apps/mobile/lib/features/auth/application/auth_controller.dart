import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_repository.dart';
import '../domain/auth_user.dart';

/// null user = unauthenticated; loading/error surface through AsyncValue —
/// consumed directly by [core/router/app_router.dart] for role-based
/// redirects.
class AuthController extends AsyncNotifier<AuthUser?> {
  @override
  Future<AuthUser?> build() {
    return ref.watch(authRepositoryProvider).tryRestoreSession();
  }

  Future<void> login({required String email, required String password}) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(authRepositoryProvider).login(email: email, password: password),
    );
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(null);
  }

  /// Adopts an already-authenticated [user] without hitting the network —
  /// used by [RegisterController.submit] once registration itself has
  /// succeeded and saved the session token.
  void setSession(AuthUser user) => state = AsyncData(user);
}

final authControllerProvider = AsyncNotifierProvider<AuthController, AuthUser?>(
  AuthController.new,
);
