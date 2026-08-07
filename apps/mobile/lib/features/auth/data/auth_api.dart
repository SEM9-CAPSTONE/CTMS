import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/auth_user.dart';
import '../domain/register_models.dart';
import '../domain/user_role.dart';

class LoginResult {
  const LoginResult({required this.accessToken, this.refreshToken, required this.user});

  final String accessToken;
  final String? refreshToken;
  final AuthUser user;
}

/// Response of `POST /auth/register` (CTMS-01-T01's `UserProfileDto`) — a
/// distinct shape from [LoginResult] on purpose. Registration does NOT log
/// the user in: no `accessToken`/`refreshToken` is returned, and the
/// account's `status` starts as `pending_verification` (the account only
/// becomes usable after CTMS-02's OTP verification). Deliberately not
/// [AuthUser] either — [AuthUser] models an authenticated session and has
/// no `status` field; conflating the two would make an unverified account
/// look signed-in.
class RegisterResult {
  const RegisterResult({
    required this.id,
    required this.email,
    required this.phone,
    required this.role,
    required this.status,
  });

  factory RegisterResult.fromJson(Map<String, dynamic> json) {
    return RegisterResult(
      id: json['id'] as String,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      role: UserRole.fromWire(json['role'] as String),
      status: json['status'] as String,
    );
  }

  final String id;
  final String? email;
  final String? phone;
  final UserRole role;
  final String status;
}

class AuthApi {
  AuthApi(this._client);

  final ApiClient _client;

  Future<LoginResult> login({required String email, required String password}) async {
    final response = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.auth.login,
      data: {'email': email, 'password': password},
    );
    final data = response.data ?? const {};
    return LoginResult(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String?,
      user: AuthUser.fromJson(data['user'] as Map<String, dynamic>),
    );
  }

  Future<AuthUser> me() async {
    final response = await _client.get<Map<String, dynamic>>(ApiEndpoints.auth.me);
    return AuthUser.fromJson(response.data ?? const {});
  }

  /// Sends exactly the 4 fields `RegisterDto` (CTMS-01-T01, services/api)
  /// accepts — nothing else. The backend's global `ValidationPipe` has
  /// `forbidNonWhitelisted: true`, so any extra property (fullName,
  /// dateOfBirth, ...) makes the whole request fail with 422, not just get
  /// ignored. [RegisterFormData.fullName] is UI-only for exactly this
  /// reason — see its doc comment.
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
}

final authApiProvider = Provider<AuthApi>((ref) => AuthApi(ref.watch(apiClientProvider)));
