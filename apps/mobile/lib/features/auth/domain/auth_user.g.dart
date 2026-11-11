// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_AuthUser _$AuthUserFromJson(Map<String, dynamic> json) => _AuthUser(
  id: json['id'] as String,
  fullName: json['fullName'] as String?,
  email: json['email'] as String,
  phone: json['phone'] as String?,
  role: const UserRoleConverter().fromJson(json['role'] as String),
  roles: const UserRolesConverter().fromJson(json['roles'] as List<dynamic>?),
);

Map<String, dynamic> _$AuthUserToJson(_AuthUser instance) => <String, dynamic>{
  'id': instance.id,
  'fullName': instance.fullName,
  'email': instance.email,
  'phone': instance.phone,
  'role': const UserRoleConverter().toJson(instance.role),
  'roles': const UserRolesConverter().toJson(instance.roles),
};
