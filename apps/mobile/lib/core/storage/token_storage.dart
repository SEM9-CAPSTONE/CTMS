import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../features/auth/domain/auth_user.dart';

class TokenStorage {
  TokenStorage(this._storage);

  final FlutterSecureStorage _storage;

  static const _accessTokenKey = 'accessToken';
  static const _refreshTokenKey = 'refreshToken';
  static const _userKey = 'cachedUser';

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);

  /// CTMS-04-T03: read by [AuthRefreshCoordinator] to build the
  /// `POST /auth/refresh` request body. Flagged in Step 1's review as
  /// needed once the coordinator (Step 3) exists -- added here rather than
  /// speculatively earlier. (CTMS-08/develop independently added the same
  /// accessor for logout -- identical signature, merged into this one.)
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  /// Persists the token pair and the user profile from a successful login
  /// in one call, so the two can never end up saved out of sync.
  Future<void> saveSession({
    required String accessToken,
    String? refreshToken,
    required AuthUser user,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    if (refreshToken != null) {
      await _storage.write(key: _refreshTokenKey, value: refreshToken);
    }
    await _storage.write(key: _userKey, value: jsonEncode(user.toJson()));
  }

  Future<AuthUser?> readCachedUser() async {
    final raw = await _storage.read(key: _userKey);
    if (raw == null) return null;
    try {
      return AuthUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  /// CTMS-04-T03: persists a rotated token pair from a successful
  /// `POST /auth/refresh` call. Deliberately separate from [saveSession] --
  /// that method is for login (a fresh pair, no prior refresh token to
  /// worry about); this one is for rotation, where the old refresh token
  /// is already revoked server-side in the same transaction that issued
  /// this new pair (see CTMS-04-T01's `AuthService.refresh()`).
  ///
  /// Write order is refreshToken THEN accessToken -- the reverse of
  /// [saveSession]'s accessToken-then-refreshToken order, on purpose. Do
  /// NOT "fix" this to match [saveSession]. `flutter_secure_storage` has no
  /// cross-key transaction, so a write failing between the two is a real
  /// possibility; trace both orders for what a mid-write failure leaves
  /// behind:
  /// - accessToken first: a failure leaves NEW accessToken + OLD
  ///   refreshToken. The OLD refresh token is already revoked server-side,
  ///   so the next refresh attempt 401s and forces a full re-login --
  ///   session lost for no real reason.
  /// - refreshToken first (this order): a failure leaves NEW refreshToken +
  ///   OLD accessToken. The next protected request 401s on the stale
  ///   access token, the interceptor refreshes using the (valid, already
  ///   saved) new refresh token, and the session continues -- one extra
  ///   round trip, nothing lost.
  ///
  /// This is best-effort sequential persistence, not a transactional
  /// atomicity guarantee -- `flutter_secure_storage` does not offer one.
  Future<void> saveTokens({required String accessToken, required String refreshToken}) async {
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
    await _storage.write(key: _accessTokenKey, value: accessToken);
  }

  Future<void> clear() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _userKey);
  }
}

final tokenStorageProvider = Provider<TokenStorage>((ref) {
  return TokenStorage(const FlutterSecureStorage());
});
