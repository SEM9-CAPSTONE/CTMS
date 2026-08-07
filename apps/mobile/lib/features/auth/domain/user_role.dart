import 'package:json_annotation/json_annotation.dart';

/// Matches the UserRole union in apps/web/src/features/auth/types.ts.
/// Parsing is case-insensitive to tolerate backend casing, same as
/// apps/web/src/shared/types/index.ts.
enum UserRole {
  camper,
  host,
  porter,
  admin;

  static UserRole fromWire(String raw) {
    return switch (raw.toLowerCase()) {
      'camper' => UserRole.camper,
      'host' => UserRole.host,
      'porter' => UserRole.porter,
      'admin' => UserRole.admin,
      _ => throw ArgumentError('Unknown role: $raw'),
    };
  }
}

class UserRoleConverter extends JsonConverter<UserRole, String> {
  const UserRoleConverter();

  @override
  UserRole fromJson(String json) => UserRole.fromWire(json);

  @override
  String toJson(UserRole object) => object.name;
}
