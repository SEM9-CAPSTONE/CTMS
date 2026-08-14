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

  Future<void> logout({bool allDevices = false}) async {
  final refreshToken = await _tokenStorage.readRefreshToken();

  if (refreshToken == null) {
    await _tokenStorage.clear();
    return;
  }

  await _api.logout(
    refreshToken: refreshToken,
    allDevices: allDevices,
  );

  await _tokenStorage.clear();
}

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
