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

  /// CTMS-04-T03: local-only session clear, deliberately no network call --
  /// used when the session is already known to be dead server-side (a
  /// failed token refresh, via `ApiClient`'s `onSessionExpired`), where a
  /// real `POST /auth/logout` (CTMS-08's [logout] above) would be
  /// redundant -- the refresh token being cleared is already invalid -- and
  /// where the caller (an HTTP interceptor's own failure path, see
  /// `AuthController.clearSession()`) cannot afford this to throw.
  Future<void> clearLocalSession() => _tokenStorage.clear();

  Future<RegisterResult> register(RegisterFormData data) => _api.register(data);

  /// CTMS-02 [Mobile]. No session is adopted by any of these three -- the
  /// account stays `pending_verification` until [verifyOtp] succeeds, and
  /// even then the caller still has to go through a real [login]
  /// afterwards (same as [register]).
  Future<RegisterResult> sendOtp({required String userId, required OtpChannel channel}) =>
      _api.sendOtp(userId: userId, channel: channel);

  Future<RegisterResult> resendOtp({required String userId, required OtpChannel channel}) =>
      _api.resendOtp(userId: userId, channel: channel);

  Future<RegisterResult> verifyOtp({required String userId, required String code}) =>
      _api.verifyOtp(userId: userId, code: code);

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
