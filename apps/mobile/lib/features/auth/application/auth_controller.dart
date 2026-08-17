import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_repository.dart';
import '../domain/auth_user.dart';

class AuthController extends AsyncNotifier<AuthUser?> {
  bool _isLoggingIn = false;
  bool _isLoggingOut = false;

  @override
  Future<AuthUser?> build() {
    return ref.watch(authRepositoryProvider).tryRestoreSession();
  }

  Future<void> login({required String identifier, required String password}) async {
    if (_isLoggingIn) return;
    _isLoggingIn = true;

    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(authRepositoryProvider).login(identifier: identifier, password: password),
    );

    _isLoggingIn = false;
  }

  /// CTMS-08: user-initiated logout -- calls the real `POST /auth/logout`
  /// API (optionally revoking every session via [allDevices]) and only
  /// clears local state after that call succeeds. On failure, surfaces the
  /// error to the UI (state becomes `AsyncError`, and the call rethrows) so
  /// a failed logout is visibly a failure, not a silent no-op.
  ///
  /// Deliberately a different code path from [clearSession] (CTMS-04-T03,
  /// below): this one hits the network and can fail; `clearSession()` is
  /// the local-only, always-succeeding primitive the refresh-token
  /// interceptor needs when the session is already known to be dead --
  /// see that method's doc comment for why it must never throw.
  Future<void> logout({bool allDevices = false}) async {
    if (_isLoggingOut) return;

    _isLoggingOut = true;

    try {
      await ref.read(authRepositoryProvider).logout(
        allDevices: allDevices,
      );

      state = const AsyncData(null);
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    } finally {
      _isLoggingOut = false;
    }
  }

  /// CTMS-04-T03, DG-M1: the local-only, always-succeeding primitive for
  /// "this session is over now, right now, no network round-trip" --
  /// clears secure storage and flips auth state to unauthenticated. The
  /// only caller is `ApiClient`'s `onSessionExpired` callback (wired in
  /// `main.dart`), invoked when the refresh-token interceptor's rotation
  /// attempt fails, expires, or the token was revoked -- at that point the
  /// refresh token is already dead server-side, so [logout]'s real
  /// `/auth/logout` call (CTMS-08) would be redundant, and this path
  /// cannot afford to throw (it runs inside an interceptor's own catch
  /// block with no outer handler). Safe to call more than once
  /// concurrently (`TokenStorage.clear()` on already-cleared keys is a
  /// no-op, and re-setting `AsyncData(null)` when already `AsyncData(null)`
  /// is harmless) -- relevant once multiple requests can independently
  /// land here after a shared failed refresh (Step 4).
  ///
  /// Deliberately does NOT touch `BuildContext`/navigation -- it only
  /// changes state. `app_router.dart`'s existing `redirect` callback reacts
  /// to `authControllerProvider` and bounces to `/login` on its own; the
  /// HTTP layer (`ApiClient`) never calls `context.go()` or knows the
  /// router exists.
  Future<void> clearSession() async {
    await ref.read(authRepositoryProvider).clearLocalSession();
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
