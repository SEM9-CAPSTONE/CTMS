import 'package:freezed_annotation/freezed_annotation.dart';

import 'user_role.dart';

part 'auth_user.freezed.dart';
part 'auth_user.g.dart';

/// [fullName] and [phone] are nullable because the real `UserProfileDto`
/// (services/api, returned by both `POST /auth/login`'s `user` field and
/// registration) has no `fullName` column at all, and `phone` can in
/// principle be absent. Do not assume either is present — see
/// `camper_overview_screen.dart`/`camper_profile_screen.dart`/
/// `porter_settings_screen.dart` for the null-safe fallbacks already in
/// place at every display site.
@freezed
abstract class AuthUser with _$AuthUser {
  const factory AuthUser({
    required String id,
    String? fullName,
    required String email,
    String? phone,
    @UserRoleConverter() required UserRole role,
  }) = _AuthUser;

  factory AuthUser.fromJson(Map<String, dynamic> json) => _$AuthUserFromJson(json);
}
