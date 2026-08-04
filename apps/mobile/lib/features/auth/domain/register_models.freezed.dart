// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'register_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$RegisterFormData {

 UserRole? get role; String get email; String get password; String get fullName; String get phone;// Trekker-only (all optional, mirrors CamperRegisterFormData on web).
 String? get bloodType; String? get fitnessLevel; String? get emergencyContactName; String? get emergencyContactPhone;// Porter-only — Step 3 "Thông tin cá nhân & xác thực". Every field
// here maps 1:1 to a `users` column (dateOfBirth -> dob, gender ->
// gender, phoneVerifiedAt -> phone_verified_at) — current business
// rules keep CCCD/OCR/selfie/emergency-contact/avatar out of signup
// entirely (avatar is set later, from the profile screen).
 DateTime? get dateOfBirth; String? get gender; DateTime? get phoneVerifiedAt;// Porter-only — Step 4 "Kinh nghiệm & phạm vi hỗ trợ". A Porter isn't
// tied to one campsite — they cover whichever Host-managed locations
// they know the terrain for, within one district at a time (see
// PorterCoverageRepository).
 int? get experienceYears; String? get operatingDistrictId; List<String> get preferredCampsiteIds; String? get certificationCode; bool get acceptedTerms;
/// Create a copy of RegisterFormData
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RegisterFormDataCopyWith<RegisterFormData> get copyWith => _$RegisterFormDataCopyWithImpl<RegisterFormData>(this as RegisterFormData, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RegisterFormData&&(identical(other.role, role) || other.role == role)&&(identical(other.email, email) || other.email == email)&&(identical(other.password, password) || other.password == password)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.phone, phone) || other.phone == phone)&&(identical(other.bloodType, bloodType) || other.bloodType == bloodType)&&(identical(other.fitnessLevel, fitnessLevel) || other.fitnessLevel == fitnessLevel)&&(identical(other.emergencyContactName, emergencyContactName) || other.emergencyContactName == emergencyContactName)&&(identical(other.emergencyContactPhone, emergencyContactPhone) || other.emergencyContactPhone == emergencyContactPhone)&&(identical(other.dateOfBirth, dateOfBirth) || other.dateOfBirth == dateOfBirth)&&(identical(other.gender, gender) || other.gender == gender)&&(identical(other.phoneVerifiedAt, phoneVerifiedAt) || other.phoneVerifiedAt == phoneVerifiedAt)&&(identical(other.experienceYears, experienceYears) || other.experienceYears == experienceYears)&&(identical(other.operatingDistrictId, operatingDistrictId) || other.operatingDistrictId == operatingDistrictId)&&const DeepCollectionEquality().equals(other.preferredCampsiteIds, preferredCampsiteIds)&&(identical(other.certificationCode, certificationCode) || other.certificationCode == certificationCode)&&(identical(other.acceptedTerms, acceptedTerms) || other.acceptedTerms == acceptedTerms));
}


@override
int get hashCode => Object.hash(runtimeType,role,email,password,fullName,phone,bloodType,fitnessLevel,emergencyContactName,emergencyContactPhone,dateOfBirth,gender,phoneVerifiedAt,experienceYears,operatingDistrictId,const DeepCollectionEquality().hash(preferredCampsiteIds),certificationCode,acceptedTerms);

@override
String toString() {
  return 'RegisterFormData(role: $role, email: $email, password: $password, fullName: $fullName, phone: $phone, bloodType: $bloodType, fitnessLevel: $fitnessLevel, emergencyContactName: $emergencyContactName, emergencyContactPhone: $emergencyContactPhone, dateOfBirth: $dateOfBirth, gender: $gender, phoneVerifiedAt: $phoneVerifiedAt, experienceYears: $experienceYears, operatingDistrictId: $operatingDistrictId, preferredCampsiteIds: $preferredCampsiteIds, certificationCode: $certificationCode, acceptedTerms: $acceptedTerms)';
}


}

/// @nodoc
abstract mixin class $RegisterFormDataCopyWith<$Res>  {
  factory $RegisterFormDataCopyWith(RegisterFormData value, $Res Function(RegisterFormData) _then) = _$RegisterFormDataCopyWithImpl;
@useResult
$Res call({
 UserRole? role, String email, String password, String fullName, String phone, String? bloodType, String? fitnessLevel, String? emergencyContactName, String? emergencyContactPhone, DateTime? dateOfBirth, String? gender, DateTime? phoneVerifiedAt, int? experienceYears, String? operatingDistrictId, List<String> preferredCampsiteIds, String? certificationCode, bool acceptedTerms
});




}
/// @nodoc
class _$RegisterFormDataCopyWithImpl<$Res>
    implements $RegisterFormDataCopyWith<$Res> {
  _$RegisterFormDataCopyWithImpl(this._self, this._then);

  final RegisterFormData _self;
  final $Res Function(RegisterFormData) _then;

/// Create a copy of RegisterFormData
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? role = freezed,Object? email = null,Object? password = null,Object? fullName = null,Object? phone = null,Object? bloodType = freezed,Object? fitnessLevel = freezed,Object? emergencyContactName = freezed,Object? emergencyContactPhone = freezed,Object? dateOfBirth = freezed,Object? gender = freezed,Object? phoneVerifiedAt = freezed,Object? experienceYears = freezed,Object? operatingDistrictId = freezed,Object? preferredCampsiteIds = null,Object? certificationCode = freezed,Object? acceptedTerms = null,}) {
  return _then(_self.copyWith(
role: freezed == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as UserRole?,email: null == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String,password: null == password ? _self.password : password // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,phone: null == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String,bloodType: freezed == bloodType ? _self.bloodType : bloodType // ignore: cast_nullable_to_non_nullable
as String?,fitnessLevel: freezed == fitnessLevel ? _self.fitnessLevel : fitnessLevel // ignore: cast_nullable_to_non_nullable
as String?,emergencyContactName: freezed == emergencyContactName ? _self.emergencyContactName : emergencyContactName // ignore: cast_nullable_to_non_nullable
as String?,emergencyContactPhone: freezed == emergencyContactPhone ? _self.emergencyContactPhone : emergencyContactPhone // ignore: cast_nullable_to_non_nullable
as String?,dateOfBirth: freezed == dateOfBirth ? _self.dateOfBirth : dateOfBirth // ignore: cast_nullable_to_non_nullable
as DateTime?,gender: freezed == gender ? _self.gender : gender // ignore: cast_nullable_to_non_nullable
as String?,phoneVerifiedAt: freezed == phoneVerifiedAt ? _self.phoneVerifiedAt : phoneVerifiedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,experienceYears: freezed == experienceYears ? _self.experienceYears : experienceYears // ignore: cast_nullable_to_non_nullable
as int?,operatingDistrictId: freezed == operatingDistrictId ? _self.operatingDistrictId : operatingDistrictId // ignore: cast_nullable_to_non_nullable
as String?,preferredCampsiteIds: null == preferredCampsiteIds ? _self.preferredCampsiteIds : preferredCampsiteIds // ignore: cast_nullable_to_non_nullable
as List<String>,certificationCode: freezed == certificationCode ? _self.certificationCode : certificationCode // ignore: cast_nullable_to_non_nullable
as String?,acceptedTerms: null == acceptedTerms ? _self.acceptedTerms : acceptedTerms // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [RegisterFormData].
extension RegisterFormDataPatterns on RegisterFormData {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RegisterFormData value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RegisterFormData() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RegisterFormData value)  $default,){
final _that = this;
switch (_that) {
case _RegisterFormData():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RegisterFormData value)?  $default,){
final _that = this;
switch (_that) {
case _RegisterFormData() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( UserRole? role,  String email,  String password,  String fullName,  String phone,  String? bloodType,  String? fitnessLevel,  String? emergencyContactName,  String? emergencyContactPhone,  DateTime? dateOfBirth,  String? gender,  DateTime? phoneVerifiedAt,  int? experienceYears,  String? operatingDistrictId,  List<String> preferredCampsiteIds,  String? certificationCode,  bool acceptedTerms)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RegisterFormData() when $default != null:
return $default(_that.role,_that.email,_that.password,_that.fullName,_that.phone,_that.bloodType,_that.fitnessLevel,_that.emergencyContactName,_that.emergencyContactPhone,_that.dateOfBirth,_that.gender,_that.phoneVerifiedAt,_that.experienceYears,_that.operatingDistrictId,_that.preferredCampsiteIds,_that.certificationCode,_that.acceptedTerms);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( UserRole? role,  String email,  String password,  String fullName,  String phone,  String? bloodType,  String? fitnessLevel,  String? emergencyContactName,  String? emergencyContactPhone,  DateTime? dateOfBirth,  String? gender,  DateTime? phoneVerifiedAt,  int? experienceYears,  String? operatingDistrictId,  List<String> preferredCampsiteIds,  String? certificationCode,  bool acceptedTerms)  $default,) {final _that = this;
switch (_that) {
case _RegisterFormData():
return $default(_that.role,_that.email,_that.password,_that.fullName,_that.phone,_that.bloodType,_that.fitnessLevel,_that.emergencyContactName,_that.emergencyContactPhone,_that.dateOfBirth,_that.gender,_that.phoneVerifiedAt,_that.experienceYears,_that.operatingDistrictId,_that.preferredCampsiteIds,_that.certificationCode,_that.acceptedTerms);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( UserRole? role,  String email,  String password,  String fullName,  String phone,  String? bloodType,  String? fitnessLevel,  String? emergencyContactName,  String? emergencyContactPhone,  DateTime? dateOfBirth,  String? gender,  DateTime? phoneVerifiedAt,  int? experienceYears,  String? operatingDistrictId,  List<String> preferredCampsiteIds,  String? certificationCode,  bool acceptedTerms)?  $default,) {final _that = this;
switch (_that) {
case _RegisterFormData() when $default != null:
return $default(_that.role,_that.email,_that.password,_that.fullName,_that.phone,_that.bloodType,_that.fitnessLevel,_that.emergencyContactName,_that.emergencyContactPhone,_that.dateOfBirth,_that.gender,_that.phoneVerifiedAt,_that.experienceYears,_that.operatingDistrictId,_that.preferredCampsiteIds,_that.certificationCode,_that.acceptedTerms);case _:
  return null;

}
}

}

/// @nodoc


class _RegisterFormData implements RegisterFormData {
  const _RegisterFormData({this.role, this.email = '', this.password = '', this.fullName = '', this.phone = '', this.bloodType, this.fitnessLevel, this.emergencyContactName, this.emergencyContactPhone, this.dateOfBirth, this.gender, this.phoneVerifiedAt, this.experienceYears, this.operatingDistrictId, final  List<String> preferredCampsiteIds = const <String>[], this.certificationCode, this.acceptedTerms = false}): _preferredCampsiteIds = preferredCampsiteIds;
  

@override final  UserRole? role;
@override@JsonKey() final  String email;
@override@JsonKey() final  String password;
@override@JsonKey() final  String fullName;
@override@JsonKey() final  String phone;
// Trekker-only (all optional, mirrors CamperRegisterFormData on web).
@override final  String? bloodType;
@override final  String? fitnessLevel;
@override final  String? emergencyContactName;
@override final  String? emergencyContactPhone;
// Porter-only — Step 3 "Thông tin cá nhân & xác thực". Every field
// here maps 1:1 to a `users` column (dateOfBirth -> dob, gender ->
// gender, phoneVerifiedAt -> phone_verified_at) — current business
// rules keep CCCD/OCR/selfie/emergency-contact/avatar out of signup
// entirely (avatar is set later, from the profile screen).
@override final  DateTime? dateOfBirth;
@override final  String? gender;
@override final  DateTime? phoneVerifiedAt;
// Porter-only — Step 4 "Kinh nghiệm & phạm vi hỗ trợ". A Porter isn't
// tied to one campsite — they cover whichever Host-managed locations
// they know the terrain for, within one district at a time (see
// PorterCoverageRepository).
@override final  int? experienceYears;
@override final  String? operatingDistrictId;
 final  List<String> _preferredCampsiteIds;
@override@JsonKey() List<String> get preferredCampsiteIds {
  if (_preferredCampsiteIds is EqualUnmodifiableListView) return _preferredCampsiteIds;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_preferredCampsiteIds);
}

@override final  String? certificationCode;
@override@JsonKey() final  bool acceptedTerms;

/// Create a copy of RegisterFormData
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RegisterFormDataCopyWith<_RegisterFormData> get copyWith => __$RegisterFormDataCopyWithImpl<_RegisterFormData>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RegisterFormData&&(identical(other.role, role) || other.role == role)&&(identical(other.email, email) || other.email == email)&&(identical(other.password, password) || other.password == password)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.phone, phone) || other.phone == phone)&&(identical(other.bloodType, bloodType) || other.bloodType == bloodType)&&(identical(other.fitnessLevel, fitnessLevel) || other.fitnessLevel == fitnessLevel)&&(identical(other.emergencyContactName, emergencyContactName) || other.emergencyContactName == emergencyContactName)&&(identical(other.emergencyContactPhone, emergencyContactPhone) || other.emergencyContactPhone == emergencyContactPhone)&&(identical(other.dateOfBirth, dateOfBirth) || other.dateOfBirth == dateOfBirth)&&(identical(other.gender, gender) || other.gender == gender)&&(identical(other.phoneVerifiedAt, phoneVerifiedAt) || other.phoneVerifiedAt == phoneVerifiedAt)&&(identical(other.experienceYears, experienceYears) || other.experienceYears == experienceYears)&&(identical(other.operatingDistrictId, operatingDistrictId) || other.operatingDistrictId == operatingDistrictId)&&const DeepCollectionEquality().equals(other._preferredCampsiteIds, _preferredCampsiteIds)&&(identical(other.certificationCode, certificationCode) || other.certificationCode == certificationCode)&&(identical(other.acceptedTerms, acceptedTerms) || other.acceptedTerms == acceptedTerms));
}


@override
int get hashCode => Object.hash(runtimeType,role,email,password,fullName,phone,bloodType,fitnessLevel,emergencyContactName,emergencyContactPhone,dateOfBirth,gender,phoneVerifiedAt,experienceYears,operatingDistrictId,const DeepCollectionEquality().hash(_preferredCampsiteIds),certificationCode,acceptedTerms);

@override
String toString() {
  return 'RegisterFormData(role: $role, email: $email, password: $password, fullName: $fullName, phone: $phone, bloodType: $bloodType, fitnessLevel: $fitnessLevel, emergencyContactName: $emergencyContactName, emergencyContactPhone: $emergencyContactPhone, dateOfBirth: $dateOfBirth, gender: $gender, phoneVerifiedAt: $phoneVerifiedAt, experienceYears: $experienceYears, operatingDistrictId: $operatingDistrictId, preferredCampsiteIds: $preferredCampsiteIds, certificationCode: $certificationCode, acceptedTerms: $acceptedTerms)';
}


}

/// @nodoc
abstract mixin class _$RegisterFormDataCopyWith<$Res> implements $RegisterFormDataCopyWith<$Res> {
  factory _$RegisterFormDataCopyWith(_RegisterFormData value, $Res Function(_RegisterFormData) _then) = __$RegisterFormDataCopyWithImpl;
@override @useResult
$Res call({
 UserRole? role, String email, String password, String fullName, String phone, String? bloodType, String? fitnessLevel, String? emergencyContactName, String? emergencyContactPhone, DateTime? dateOfBirth, String? gender, DateTime? phoneVerifiedAt, int? experienceYears, String? operatingDistrictId, List<String> preferredCampsiteIds, String? certificationCode, bool acceptedTerms
});




}
/// @nodoc
class __$RegisterFormDataCopyWithImpl<$Res>
    implements _$RegisterFormDataCopyWith<$Res> {
  __$RegisterFormDataCopyWithImpl(this._self, this._then);

  final _RegisterFormData _self;
  final $Res Function(_RegisterFormData) _then;

/// Create a copy of RegisterFormData
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? role = freezed,Object? email = null,Object? password = null,Object? fullName = null,Object? phone = null,Object? bloodType = freezed,Object? fitnessLevel = freezed,Object? emergencyContactName = freezed,Object? emergencyContactPhone = freezed,Object? dateOfBirth = freezed,Object? gender = freezed,Object? phoneVerifiedAt = freezed,Object? experienceYears = freezed,Object? operatingDistrictId = freezed,Object? preferredCampsiteIds = null,Object? certificationCode = freezed,Object? acceptedTerms = null,}) {
  return _then(_RegisterFormData(
role: freezed == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as UserRole?,email: null == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String,password: null == password ? _self.password : password // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,phone: null == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String,bloodType: freezed == bloodType ? _self.bloodType : bloodType // ignore: cast_nullable_to_non_nullable
as String?,fitnessLevel: freezed == fitnessLevel ? _self.fitnessLevel : fitnessLevel // ignore: cast_nullable_to_non_nullable
as String?,emergencyContactName: freezed == emergencyContactName ? _self.emergencyContactName : emergencyContactName // ignore: cast_nullable_to_non_nullable
as String?,emergencyContactPhone: freezed == emergencyContactPhone ? _self.emergencyContactPhone : emergencyContactPhone // ignore: cast_nullable_to_non_nullable
as String?,dateOfBirth: freezed == dateOfBirth ? _self.dateOfBirth : dateOfBirth // ignore: cast_nullable_to_non_nullable
as DateTime?,gender: freezed == gender ? _self.gender : gender // ignore: cast_nullable_to_non_nullable
as String?,phoneVerifiedAt: freezed == phoneVerifiedAt ? _self.phoneVerifiedAt : phoneVerifiedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,experienceYears: freezed == experienceYears ? _self.experienceYears : experienceYears // ignore: cast_nullable_to_non_nullable
as int?,operatingDistrictId: freezed == operatingDistrictId ? _self.operatingDistrictId : operatingDistrictId // ignore: cast_nullable_to_non_nullable
as String?,preferredCampsiteIds: null == preferredCampsiteIds ? _self._preferredCampsiteIds : preferredCampsiteIds // ignore: cast_nullable_to_non_nullable
as List<String>,certificationCode: freezed == certificationCode ? _self.certificationCode : certificationCode // ignore: cast_nullable_to_non_nullable
as String?,acceptedTerms: null == acceptedTerms ? _self.acceptedTerms : acceptedTerms // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
