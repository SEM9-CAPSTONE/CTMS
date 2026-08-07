import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_repository.dart';
import '../domain/auth_user.dart';

/// null user = unauthenticated; loading/error surface through AsyncValue —
/// consumed directly by [core/router/app_router.dart] for role-based
/// redirects.
class AuthController extends AsyncNotifier<AuthUser?> {
  // Deliberately NOT `state.isLoading` -- that's also true while build()'s
  // initial tryRestoreSession() is still in flight (cold start), which is
  // unrelated to a login submission being in progress. Conflating the two
  // would silently drop a login tap that happens to land before the
  // restore-session Future has settled.
  bool _isLoggingIn = false;

  @override
  Future<AuthUser?> build() {
    return ref.watch(authRepositoryProvider).tryRestoreSession();
  }

  /// `identifier` -- email or phone, never assumed to be one or the
  /// other -- matches `AuthApi.login`'s naming (see its doc comment for
  /// why). BR-241-style guard: `state.isLoading` already disables the
  /// submit button in LoginScreen, but that's a UI-frame away from this
  /// call — this stops a second tap from ever reaching AuthRepository.login
  /// even inside that gap.
  Future<void> login({required String identifier, required String password}) async {
    if (_isLoggingIn) return;
    _isLoggingIn = true;

    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(authRepositoryProvider).login(identifier: identifier, password: password),
    );

    _isLoggingIn = false;
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
