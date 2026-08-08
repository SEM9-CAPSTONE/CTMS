import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/token_storage.dart';
import '../domain/auth_user.dart';
import '../domain/register_models.dart';
import 'auth_api.dart';

class AuthRepository {
  AuthRepository(this._api, this._tokenStorage);

  final AuthApi _api;
  final TokenStorage _tokenStorage;

  Future<AuthUser> login({
    required String identifier,
    required String password,
  }) async {
    final result = await _api.login(identifier: identifier, password: password);
    await _tokenStorage.saveSession(
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    );
    return result.user;
  }

  /// Called once at startup. Local-only by necessity — see TokenStorage's
  /// class doc for why (no `/auth/me` to validate against yet). "Session
  /// restored" means both a token AND a decodable cached profile exist;
  /// either missing/corrupt is treated as "failed session-initialization"
  /// (CTMS-03-T03's explicit test case) and clears whatever partial state
  /// is left, the same as an expired/invalid session would.
  Future<AuthUser?> tryRestoreSession() async {
    final token = await _tokenStorage.readAccessToken();
    if (token == null) return null;

    final cachedUser = await _tokenStorage.readCachedUser();
    if (cachedUser == null) {
      await _tokenStorage.clear();
      return null;
    }
    return cachedUser;
  }

  Future<void> logout() => _tokenStorage.clear();

  /// Registration does NOT sign the account in — `POST /auth/register`
  /// returns no token pair (see [RegisterResult]'s doc comment), and the
  /// created account starts as `pending_verification`. Nothing is saved to
  /// [TokenStorage] here; [RegisterController.submit] navigates to
  /// `/verify` instead of adopting a session.
  Future<RegisterResult> register(RegisterFormData data) => _api.register(data);

  Future<void> forgotPassword({
    required String identifier,
    required String channel,
  }) => _api.forgotPassword(identifier: identifier, channel: channel);

  Future<void> resetPassword({
    required String identifier,
    required String code,
    required String newPassword,
  }) => _api.resetPassword(
    identifier: identifier,
    code: code,
    newPassword: newPassword,
  );
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.watch(authApiProvider),
    ref.watch(tokenStorageProvider),
  );
});
