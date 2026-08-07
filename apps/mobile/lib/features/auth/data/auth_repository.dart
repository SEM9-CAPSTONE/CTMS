import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/token_storage.dart';
import '../domain/auth_user.dart';
import '../domain/register_models.dart';
import 'auth_api.dart';

class AuthRepository {
  AuthRepository(this._api, this._tokenStorage);

  final AuthApi _api;
  final TokenStorage _tokenStorage;

  Future<AuthUser> login({required String email, required String password}) async {
    final result = await _api.login(email: email, password: password);
    await _tokenStorage.saveTokens(
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    );
    return result.user;
  }

  /// Called once at startup. Returns null (without hitting the network) when
  /// there is no stored token, otherwise re-validates it against `/auth/me`.
  Future<AuthUser?> tryRestoreSession() async {
    final token = await _tokenStorage.readAccessToken();
    if (token == null) return null;

    try {
      return await _api.me();
    } catch (_) {
      await _tokenStorage.clear();
      return null;
    }
  }

  Future<void> logout() => _tokenStorage.clear();

  /// Registration does NOT sign the account in — `POST /auth/register`
  /// returns no token pair (see [RegisterResult]'s doc comment), and the
  /// created account starts as `pending_verification`. Nothing is saved to
  /// [TokenStorage] here; [RegisterController.submit] navigates to
  /// `/verify` instead of adopting a session.
  Future<RegisterResult> register(RegisterFormData data) => _api.register(data);
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(authApiProvider), ref.watch(tokenStorageProvider));
});
