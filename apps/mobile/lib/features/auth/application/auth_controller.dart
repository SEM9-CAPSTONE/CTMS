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

  /// CTMS-04-T03, DG-M1: the one shared primitive for "this local session
  /// is over now" -- clears secure storage and flips auth state to
  /// unauthenticated. [logout] is the user-initiated call to this; the
  /// other caller is `ApiClient`'s `onSessionExpired` callback (wired in
  /// `main.dart`), invoked when the refresh-token interceptor's rotation
  /// attempt fails, expires, or the token was revoked. Both paths must land
  /// in the exact same state -- there is deliberately no second way to
  /// clear a session locally. Safe to call more than once concurrently
  /// (`TokenStorage.clear()` on already-cleared keys is a no-op, and
  /// re-setting `AsyncData(null)` when already `AsyncData(null)` is
  /// harmless) -- relevant once multiple requests can independently land
  /// here after a shared failed refresh (Step 4).
  ///
  /// Deliberately does NOT touch `BuildContext`/navigation -- it only
  /// changes state. `app_router.dart`'s existing `redirect` callback reacts
  /// to `authControllerProvider` and bounces to `/login` on its own; the
  /// HTTP layer (`ApiClient`) never calls `context.go()` or knows the
  /// router exists.
  Future<void> clearSession() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(null);
  }

  Future<void> logout() => clearSession();

  /// Adopts an already-authenticated [user] without hitting the network —
  /// used by [RegisterController.submit] once registration itself has
  /// succeeded and saved the session token.
  void setSession(AuthUser user) => state = AsyncData(user);
}

final authControllerProvider = AsyncNotifierProvider<AuthController, AuthUser?>(
  AuthController.new,
);
