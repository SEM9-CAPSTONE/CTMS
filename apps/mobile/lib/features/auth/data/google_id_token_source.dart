import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../../core/env/env.dart';

/// Gets a Google ID token for "Đăng nhập bằng Google". `null` means the user
/// closed the Google sheet (not an error). Replaced in tests.
abstract interface class GoogleIdTokenSource {
  bool get isEnabled;
  Future<String?> signIn();
}

/// google_sign_in 7.x. The ID token is requested for the backend's web OAuth
/// client ([Env.googleServerClientId]), the audience `POST /auth/google` checks.
class PluginGoogleIdTokenSource implements GoogleIdTokenSource {
  PluginGoogleIdTokenSource(this._serverClientId);

  final String _serverClientId;
  Future<void>? _initialized;

  @override
  bool get isEnabled => _serverClientId.isNotEmpty;

  @override
  Future<String?> signIn() async {
    final google = GoogleSignIn.instance;
    await (_initialized ??= google.initialize(serverClientId: _serverClientId));
    try {
      final account = await google.authenticate();
      return account.authentication.idToken;
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled ||
          error.code == GoogleSignInExceptionCode.interrupted) {
        return null;
      }
      rethrow;
    }
  }
}

final googleIdTokenSourceProvider = Provider<GoogleIdTokenSource>(
  (ref) => PluginGoogleIdTokenSource(Env.googleServerClientId),
);
