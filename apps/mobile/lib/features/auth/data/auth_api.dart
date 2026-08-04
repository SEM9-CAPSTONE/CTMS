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

  /// Builds the request payload from [data]. Every key maps to a `users`
  /// column — dateOfBirth/gender/phoneVerifiedAt included whenever set
  /// (only the Porter flow collects them today, but they're general
  /// account fields, not Porter-specific ones) — role-specific fields
  /// beyond that are only included for the matching role, keeping the
  /// request lean.
  Future<LoginResult> register(RegisterFormData data) async {
    final payload = <String, dynamic>{
      'role': data.role?.name,
      'fullName': data.fullName,
      'email': data.email,
      'phone': data.phone,
      'password': data.password,
      if (data.dateOfBirth != null) 'dateOfBirth': data.dateOfBirth!.toIso8601String(),
      if (data.gender != null) 'gender': data.gender,
      if (data.phoneVerifiedAt != null)
        'phoneVerifiedAt': data.phoneVerifiedAt!.toIso8601String(),
    };

    switch (data.role) {
      case UserRole.camper:
        payload.addAll({
          if (data.bloodType != null) 'bloodType': data.bloodType,
          if (data.fitnessLevel != null) 'fitnessLevel': data.fitnessLevel,
          if (data.emergencyContactName != null)
            'emergencyContactName': data.emergencyContactName,
          if (data.emergencyContactPhone != null)
            'emergencyContactPhone': data.emergencyContactPhone,
        });
      case UserRole.porter:
        payload.addAll({
          'experienceYears': data.experienceYears,
          'operatingDistrictId': data.operatingDistrictId,
          'preferredCampsiteIds': data.preferredCampsiteIds,
          if (data.certificationCode != null) 'certificationCode': data.certificationCode,
        });
      case UserRole.host:
      case UserRole.admin:
      case null:
        break;
    }

    final response = await _client.post<Map<String, dynamic>>(
      ApiEndpoints.auth.register,
      data: payload,
    );
    final responseData = response.data ?? const {};
    return LoginResult(
      accessToken: responseData['accessToken'] as String,
      refreshToken: responseData['refreshToken'] as String?,
      user: AuthUser.fromJson(responseData['user'] as Map<String, dynamic>),
    );
  }
}

final authApiProvider = Provider<AuthApi>((ref) => AuthApi(ref.watch(apiClientProvider)));
