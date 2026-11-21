import 'package:flutter/foundation.dart';

class Env {
  Env._();

  static const _configuredApiBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// SMS codes go through Twilio, still a trial account that cannot reach
  /// unverified numbers; the SMS option is hidden unless built with
  /// `--dart-define=OTP_SMS_ENABLED=true`.
  static const otpSmsEnabled = bool.fromEnvironment('OTP_SMS_ENABLED');

  static String get apiBaseUrl {
    if (_configuredApiBaseUrl.isNotEmpty) return _configuredApiBaseUrl;
    return !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS
        ? 'https://ditrek.io.vn/api'
        : 'http://localhost:3000/api';
  }
}
