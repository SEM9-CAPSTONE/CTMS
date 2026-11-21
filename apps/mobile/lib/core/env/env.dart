import 'package:flutter/foundation.dart';

class Env {
  Env._();

  static const _configuredApiBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// Web OAuth client id the backend accepts for "Đăng nhập bằng Google"
  /// (`--dart-define=GOOGLE_SERVER_CLIENT_ID=...`); empty hides the button.
  static const googleServerClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

  static String get apiBaseUrl {
    if (_configuredApiBaseUrl.isNotEmpty) return _configuredApiBaseUrl;
    return !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS
        ? 'https://ditrek.io.vn/api'
        : 'http://localhost:3000/api';
  }
}
