import 'package:freezed_annotation/freezed_annotation.dart';

import 'user_role.dart';

part 'auth_user.freezed.dart';
part 'auth_user.g.dart';

@freezed
abstract class AuthUser with _$AuthUser {
  const factory AuthUser({
    required String id,
    required String fullName,
    required String email,
    @UserRoleConverter() required UserRole role,
  }) = _AuthUser;

  factory AuthUser.fromJson(Map<String, dynamic> json) => _$AuthUserFromJson(json);
}
