import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/auth_user.dart';
import '../domain/register_models.dart';
import '../domain/user_role.dart';

/// CTMS-02 [Mobile]. Mirrors Web's `OtpChannel` (`apps/web/src/features/auth/types.ts`)
/// and the backend's `SendOtpDto.OtpChannel` enum exactly -- the channel is
/// always chosen explicitly by the user on the Verify screen, never inferred.
enum OtpChannel {
  phone('phone'),
  email('email');

  const OtpChannel(this.wireValue);

  final String wireValue;
}

class LoginResult {
  const LoginResult({
    required this.accessToken,
    this.refreshToken,
    required this.user,
  });

  final String accessToken;
  final String? refreshToken;
  final AuthUser user;
}

class RegisterResult {
  const RegisterResult({
    required this.id,
    required this.email,
    required this.phone,
    required this.role,
    this.roles = const [],
    required this.status,
  });

  factory RegisterResult.fromJson(Map<String, dynamic> json) {
    return RegisterResult(
      id: json['id'] as String,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      role: UserRole.fromWire(json['role'] as String),
      roles: const UserRolesConverter().fromJson(json['roles'] as List<dynamic>?),
      status: json['status'] as String,
    );
  }

  final String id;
  final String? email;
  final String? phone;
  final UserRole role;
  final List<UserRole> roles;
  final String status;
}

class AuthApi {
  AuthApi(this._client);

  final ApiClient _client;

  Future<LoginResult> login({
    required String identifier,
    required String password,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.auth.login,
      data: {'identifier': identifier, 'password': password},
    );
    final data = response.data ?? const {};
    final user = _withRoleFallback(AuthUser.fromJson(data['user'] as Map<String, dynamic>));
    return LoginResult(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String?,
      user: user,
    );
  }

  Future<AuthUser> me() async {
    final response = await _client.get<Map<String, dynamic>>(
      ApiEndpoints.auth.me,
    );
    return _withRoleFallback(AuthUser.fromJson(response.data ?? const {}));
  }

  Future<RegisterResult> register(RegisterFormData data) async {
    final payload = <String, dynamic>{
      'email': data.email,
      'phone': data.phone,
      'password': data.password,
      'role': data.role?.name,
    };

    final response = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.auth.register,
      data: payload,
    );
    return RegisterResult.fromJson(response.data ?? const {});
  }

  /// CTMS-02 [Mobile]. First OTP issuance for a `pending_verification`
  /// account created by [register] -- identified by [userId] (the `id`
  /// [RegisterResult] returns), same as Web. Distinct route from
  /// [resendOtp] for REST clarity; identical body shape and backend method
  /// (`services/api`'s `SendOtpDto` docstring: the first call for a user
  /// always succeeds and isn't counted as a resend).
  Future<RegisterResult> sendOtp({
    required String userId,
    required OtpChannel channel,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.auth.sendOtp,
      data: {'userId': userId, 'channel': channel.wireValue},
    );
    return RegisterResult.fromJson(response.data ?? const {});
  }

  /// CTMS-02 [Mobile]. Same payload/response shape as [sendOtp] -- the
  /// backend's `/auth/resend` route calls the identical service method,
  /// see [sendOtp]'s docstring.
  Future<RegisterResult> resendOtp({
    required String userId,
    required OtpChannel channel,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.auth.resendOtp,
      data: {'userId': userId, 'channel': channel.wireValue},
    );
    return RegisterResult.fromJson(response.data ?? const {});
  }

  /// CTMS-02 [Mobile]. On success, flips the account from
  /// `pending_verification` to `active` server-side -- no session is
  /// adopted here (same as [register]; a real login still follows).
  Future<RegisterResult> verifyOtp({
    required String userId,
    required String code,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.auth.verifyOtp,
      data: {'userId': userId, 'code': code},
    );
    return RegisterResult.fromJson(response.data ?? const {});
  }

  Future<void> forgotPassword({
    required String identifier,
    required String channel,
  }) async {
    await _client.post<Map<String, dynamic>>(
      ApiEndpoints.auth.forgotPassword,
      data: {'identifier': identifier, 'channel': channel},
    );
  }

  Future<void> resetPassword({
    required String identifier,
    required String code,
    required String newPassword,
  }) async {
    await _client.post<Map<String, dynamic>>(
      ApiEndpoints.auth.resetPassword,
      data: {
        'identifier': identifier,
        'code': code,
        'newPassword': newPassword,
      },
    );
  }

  Future<void> logout({
  required String refreshToken,
  required bool allDevices,
}) async {
  await _client.post<Map<String, dynamic>>(
    ApiEndpoints.auth.logout,
    data: {
      'refreshToken': refreshToken,
      'allDevices': allDevices,
    },
  );
}
}

final authApiProvider = Provider<AuthApi>(
  (ref) => AuthApi(ref.watch(apiClientProvider)),
);

AuthUser _withRoleFallback(AuthUser user) {
  return user.roles.isEmpty ? user.copyWith(roles: [user.role]) : user;
}
