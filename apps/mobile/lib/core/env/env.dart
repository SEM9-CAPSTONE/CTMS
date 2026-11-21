import 'package:flutter/foundation.dart';

class Env {
  Env._();

  static const _configuredApiBaseUrl = String.fromEnvironment('API_BASE_URL');

  static String get apiBaseUrl {
    if (_configuredApiBaseUrl.isNotEmpty) return _configuredApiBaseUrl;
    return !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS
        ? 'https://ditrek.io.vn/api'
        : 'http://localhost:3000/api';
  }
}
