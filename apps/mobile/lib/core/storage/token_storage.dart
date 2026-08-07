import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../features/auth/domain/auth_user.dart';

/// CTMS-03-T03 Decision Gate (resolved): the backend has no `GET /auth/me`
/// yet (and `JwtAuthGuard` isn't attached to any route), so there is no way
/// to actually validate a stored token against the server on app restart.
/// The chosen tradeoff is a local-only session restore: the user profile
/// returned by a successful login is cached here alongside the tokens, and
/// "is there a valid token + a decodable cached profile" is treated as
/// "session restored" with no network round-trip. A revoked/expired token
/// is only discovered the next time a real authenticated request 401s
/// (out of scope here — no endpoint is guarded yet either). Revisit this
/// once `/auth/me` exists.
class TokenStorage {
  TokenStorage(this._storage);

  final FlutterSecureStorage _storage;

  static const _accessTokenKey = 'accessToken';
  static const _refreshTokenKey = 'refreshToken';
  static const _userKey = 'cachedUser';

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);

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

  /// Returns null if nothing is cached, or if what's cached fails to decode
  /// (corrupt/partial write, format change across an app update, ...) --
  /// this is the "failed session-initialization" case CTMS-03-T03 asks to
  /// handle: treat it the same as "no session", never throw past this call.
  Future<AuthUser?> readCachedUser() async {
    final raw = await _storage.read(key: _userKey);
    if (raw == null) return null;
    try {
      return AuthUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
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
