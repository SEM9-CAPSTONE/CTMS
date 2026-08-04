// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'camper_overview_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$OverviewNotice {

 String get message; OverviewSeverity get severity;
/// Create a copy of OverviewNotice
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$OverviewNoticeCopyWith<OverviewNotice> get copyWith => _$OverviewNoticeCopyWithImpl<OverviewNotice>(this as OverviewNotice, _$identity);

  /// Serializes this OverviewNotice to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is OverviewNotice&&(identical(other.message, message) || other.message == message)&&(identical(other.severity, severity) || other.severity == severity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,message,severity);

@override
String toString() {
  return 'OverviewNotice(message: $message, severity: $severity)';
}


}

/// @nodoc
abstract mixin class $OverviewNoticeCopyWith<$Res>  {
  factory $OverviewNoticeCopyWith(OverviewNotice value, $Res Function(OverviewNotice) _then) = _$OverviewNoticeCopyWithImpl;
@useResult
$Res call({
 String message, OverviewSeverity severity
});




}
/// @nodoc
class _$OverviewNoticeCopyWithImpl<$Res>
    implements $OverviewNoticeCopyWith<$Res> {
  _$OverviewNoticeCopyWithImpl(this._self, this._then);

  final OverviewNotice _self;
  final $Res Function(OverviewNotice) _then;

/// Create a copy of OverviewNotice
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? message = null,Object? severity = null,}) {
  return _then(_self.copyWith(
message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,severity: null == severity ? _self.severity : severity // ignore: cast_nullable_to_non_nullable
as OverviewSeverity,
  ));
}

}


/// Adds pattern-matching-related methods to [OverviewNotice].
extension OverviewNoticePatterns on OverviewNotice {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _OverviewNotice value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _OverviewNotice() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _OverviewNotice value)  $default,){
final _that = this;
switch (_that) {
case _OverviewNotice():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _OverviewNotice value)?  $default,){
final _that = this;
switch (_that) {
case _OverviewNotice() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String message,  OverviewSeverity severity)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _OverviewNotice() when $default != null:
return $default(_that.message,_that.severity);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String message,  OverviewSeverity severity)  $default,) {final _that = this;
switch (_that) {
case _OverviewNotice():
return $default(_that.message,_that.severity);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String message,  OverviewSeverity severity)?  $default,) {final _that = this;
switch (_that) {
case _OverviewNotice() when $default != null:
return $default(_that.message,_that.severity);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _OverviewNotice implements OverviewNotice {
  const _OverviewNotice({required this.message, required this.severity});
  factory _OverviewNotice.fromJson(Map<String, dynamic> json) => _$OverviewNoticeFromJson(json);

@override final  String message;
@override final  OverviewSeverity severity;

/// Create a copy of OverviewNotice
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$OverviewNoticeCopyWith<_OverviewNotice> get copyWith => __$OverviewNoticeCopyWithImpl<_OverviewNotice>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$OverviewNoticeToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _OverviewNotice&&(identical(other.message, message) || other.message == message)&&(identical(other.severity, severity) || other.severity == severity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,message,severity);

@override
String toString() {
  return 'OverviewNotice(message: $message, severity: $severity)';
}


}

/// @nodoc
abstract mixin class _$OverviewNoticeCopyWith<$Res> implements $OverviewNoticeCopyWith<$Res> {
  factory _$OverviewNoticeCopyWith(_OverviewNotice value, $Res Function(_OverviewNotice) _then) = __$OverviewNoticeCopyWithImpl;
@override @useResult
$Res call({
 String message, OverviewSeverity severity
});




}
/// @nodoc
class __$OverviewNoticeCopyWithImpl<$Res>
    implements _$OverviewNoticeCopyWith<$Res> {
  __$OverviewNoticeCopyWithImpl(this._self, this._then);

  final _OverviewNotice _self;
  final $Res Function(_OverviewNotice) _then;

/// Create a copy of OverviewNotice
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? message = null,Object? severity = null,}) {
  return _then(_OverviewNotice(
message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,severity: null == severity ? _self.severity : severity // ignore: cast_nullable_to_non_nullable
as OverviewSeverity,
  ));
}


}


/// @nodoc
mixin _$UpcomingTrip {

 String get name; String get statusLabel; DateTime get startDate; int get durationDays; int get memberCount; String get difficulty; String get porterName; String get weatherRiskLabel;
/// Create a copy of UpcomingTrip
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$UpcomingTripCopyWith<UpcomingTrip> get copyWith => _$UpcomingTripCopyWithImpl<UpcomingTrip>(this as UpcomingTrip, _$identity);

  /// Serializes this UpcomingTrip to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is UpcomingTrip&&(identical(other.name, name) || other.name == name)&&(identical(other.statusLabel, statusLabel) || other.statusLabel == statusLabel)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.durationDays, durationDays) || other.durationDays == durationDays)&&(identical(other.memberCount, memberCount) || other.memberCount == memberCount)&&(identical(other.difficulty, difficulty) || other.difficulty == difficulty)&&(identical(other.porterName, porterName) || other.porterName == porterName)&&(identical(other.weatherRiskLabel, weatherRiskLabel) || other.weatherRiskLabel == weatherRiskLabel));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,statusLabel,startDate,durationDays,memberCount,difficulty,porterName,weatherRiskLabel);

@override
String toString() {
  return 'UpcomingTrip(name: $name, statusLabel: $statusLabel, startDate: $startDate, durationDays: $durationDays, memberCount: $memberCount, difficulty: $difficulty, porterName: $porterName, weatherRiskLabel: $weatherRiskLabel)';
}


}

/// @nodoc
abstract mixin class $UpcomingTripCopyWith<$Res>  {
  factory $UpcomingTripCopyWith(UpcomingTrip value, $Res Function(UpcomingTrip) _then) = _$UpcomingTripCopyWithImpl;
@useResult
$Res call({
 String name, String statusLabel, DateTime startDate, int durationDays, int memberCount, String difficulty, String porterName, String weatherRiskLabel
});




}
/// @nodoc
class _$UpcomingTripCopyWithImpl<$Res>
    implements $UpcomingTripCopyWith<$Res> {
  _$UpcomingTripCopyWithImpl(this._self, this._then);

  final UpcomingTrip _self;
  final $Res Function(UpcomingTrip) _then;

/// Create a copy of UpcomingTrip
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? statusLabel = null,Object? startDate = null,Object? durationDays = null,Object? memberCount = null,Object? difficulty = null,Object? porterName = null,Object? weatherRiskLabel = null,}) {
  return _then(_self.copyWith(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,statusLabel: null == statusLabel ? _self.statusLabel : statusLabel // ignore: cast_nullable_to_non_nullable
as String,startDate: null == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as DateTime,durationDays: null == durationDays ? _self.durationDays : durationDays // ignore: cast_nullable_to_non_nullable
as int,memberCount: null == memberCount ? _self.memberCount : memberCount // ignore: cast_nullable_to_non_nullable
as int,difficulty: null == difficulty ? _self.difficulty : difficulty // ignore: cast_nullable_to_non_nullable
as String,porterName: null == porterName ? _self.porterName : porterName // ignore: cast_nullable_to_non_nullable
as String,weatherRiskLabel: null == weatherRiskLabel ? _self.weatherRiskLabel : weatherRiskLabel // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [UpcomingTrip].
extension UpcomingTripPatterns on UpcomingTrip {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _UpcomingTrip value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _UpcomingTrip() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _UpcomingTrip value)  $default,){
final _that = this;
switch (_that) {
case _UpcomingTrip():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _UpcomingTrip value)?  $default,){
final _that = this;
switch (_that) {
case _UpcomingTrip() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  String statusLabel,  DateTime startDate,  int durationDays,  int memberCount,  String difficulty,  String porterName,  String weatherRiskLabel)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _UpcomingTrip() when $default != null:
return $default(_that.name,_that.statusLabel,_that.startDate,_that.durationDays,_that.memberCount,_that.difficulty,_that.porterName,_that.weatherRiskLabel);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  String statusLabel,  DateTime startDate,  int durationDays,  int memberCount,  String difficulty,  String porterName,  String weatherRiskLabel)  $default,) {final _that = this;
switch (_that) {
case _UpcomingTrip():
return $default(_that.name,_that.statusLabel,_that.startDate,_that.durationDays,_that.memberCount,_that.difficulty,_that.porterName,_that.weatherRiskLabel);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  String statusLabel,  DateTime startDate,  int durationDays,  int memberCount,  String difficulty,  String porterName,  String weatherRiskLabel)?  $default,) {final _that = this;
switch (_that) {
case _UpcomingTrip() when $default != null:
return $default(_that.name,_that.statusLabel,_that.startDate,_that.durationDays,_that.memberCount,_that.difficulty,_that.porterName,_that.weatherRiskLabel);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _UpcomingTrip implements UpcomingTrip {
  const _UpcomingTrip({required this.name, required this.statusLabel, required this.startDate, required this.durationDays, required this.memberCount, required this.difficulty, required this.porterName, required this.weatherRiskLabel});
  factory _UpcomingTrip.fromJson(Map<String, dynamic> json) => _$UpcomingTripFromJson(json);

@override final  String name;
@override final  String statusLabel;
@override final  DateTime startDate;
@override final  int durationDays;
@override final  int memberCount;
@override final  String difficulty;
@override final  String porterName;
@override final  String weatherRiskLabel;

/// Create a copy of UpcomingTrip
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$UpcomingTripCopyWith<_UpcomingTrip> get copyWith => __$UpcomingTripCopyWithImpl<_UpcomingTrip>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$UpcomingTripToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _UpcomingTrip&&(identical(other.name, name) || other.name == name)&&(identical(other.statusLabel, statusLabel) || other.statusLabel == statusLabel)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.durationDays, durationDays) || other.durationDays == durationDays)&&(identical(other.memberCount, memberCount) || other.memberCount == memberCount)&&(identical(other.difficulty, difficulty) || other.difficulty == difficulty)&&(identical(other.porterName, porterName) || other.porterName == porterName)&&(identical(other.weatherRiskLabel, weatherRiskLabel) || other.weatherRiskLabel == weatherRiskLabel));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,statusLabel,startDate,durationDays,memberCount,difficulty,porterName,weatherRiskLabel);

@override
String toString() {
  return 'UpcomingTrip(name: $name, statusLabel: $statusLabel, startDate: $startDate, durationDays: $durationDays, memberCount: $memberCount, difficulty: $difficulty, porterName: $porterName, weatherRiskLabel: $weatherRiskLabel)';
}


}

/// @nodoc
abstract mixin class _$UpcomingTripCopyWith<$Res> implements $UpcomingTripCopyWith<$Res> {
  factory _$UpcomingTripCopyWith(_UpcomingTrip value, $Res Function(_UpcomingTrip) _then) = __$UpcomingTripCopyWithImpl;
@override @useResult
$Res call({
 String name, String statusLabel, DateTime startDate, int durationDays, int memberCount, String difficulty, String porterName, String weatherRiskLabel
});




}
/// @nodoc
class __$UpcomingTripCopyWithImpl<$Res>
    implements _$UpcomingTripCopyWith<$Res> {
  __$UpcomingTripCopyWithImpl(this._self, this._then);

  final _UpcomingTrip _self;
  final $Res Function(_UpcomingTrip) _then;

/// Create a copy of UpcomingTrip
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? statusLabel = null,Object? startDate = null,Object? durationDays = null,Object? memberCount = null,Object? difficulty = null,Object? porterName = null,Object? weatherRiskLabel = null,}) {
  return _then(_UpcomingTrip(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,statusLabel: null == statusLabel ? _self.statusLabel : statusLabel // ignore: cast_nullable_to_non_nullable
as String,startDate: null == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as DateTime,durationDays: null == durationDays ? _self.durationDays : durationDays // ignore: cast_nullable_to_non_nullable
as int,memberCount: null == memberCount ? _self.memberCount : memberCount // ignore: cast_nullable_to_non_nullable
as int,difficulty: null == difficulty ? _self.difficulty : difficulty // ignore: cast_nullable_to_non_nullable
as String,porterName: null == porterName ? _self.porterName : porterName // ignore: cast_nullable_to_non_nullable
as String,weatherRiskLabel: null == weatherRiskLabel ? _self.weatherRiskLabel : weatherRiskLabel // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$PreparationItem {

 String get label; String get statusLabel; OverviewSeverity get severity;
/// Create a copy of PreparationItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PreparationItemCopyWith<PreparationItem> get copyWith => _$PreparationItemCopyWithImpl<PreparationItem>(this as PreparationItem, _$identity);

  /// Serializes this PreparationItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PreparationItem&&(identical(other.label, label) || other.label == label)&&(identical(other.statusLabel, statusLabel) || other.statusLabel == statusLabel)&&(identical(other.severity, severity) || other.severity == severity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,label,statusLabel,severity);

@override
String toString() {
  return 'PreparationItem(label: $label, statusLabel: $statusLabel, severity: $severity)';
}


}

/// @nodoc
abstract mixin class $PreparationItemCopyWith<$Res>  {
  factory $PreparationItemCopyWith(PreparationItem value, $Res Function(PreparationItem) _then) = _$PreparationItemCopyWithImpl;
@useResult
$Res call({
 String label, String statusLabel, OverviewSeverity severity
});




}
/// @nodoc
class _$PreparationItemCopyWithImpl<$Res>
    implements $PreparationItemCopyWith<$Res> {
  _$PreparationItemCopyWithImpl(this._self, this._then);

  final PreparationItem _self;
  final $Res Function(PreparationItem) _then;

/// Create a copy of PreparationItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? label = null,Object? statusLabel = null,Object? severity = null,}) {
  return _then(_self.copyWith(
label: null == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String,statusLabel: null == statusLabel ? _self.statusLabel : statusLabel // ignore: cast_nullable_to_non_nullable
as String,severity: null == severity ? _self.severity : severity // ignore: cast_nullable_to_non_nullable
as OverviewSeverity,
  ));
}

}


/// Adds pattern-matching-related methods to [PreparationItem].
extension PreparationItemPatterns on PreparationItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PreparationItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PreparationItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PreparationItem value)  $default,){
final _that = this;
switch (_that) {
case _PreparationItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PreparationItem value)?  $default,){
final _that = this;
switch (_that) {
case _PreparationItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String label,  String statusLabel,  OverviewSeverity severity)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PreparationItem() when $default != null:
return $default(_that.label,_that.statusLabel,_that.severity);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String label,  String statusLabel,  OverviewSeverity severity)  $default,) {final _that = this;
switch (_that) {
case _PreparationItem():
return $default(_that.label,_that.statusLabel,_that.severity);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String label,  String statusLabel,  OverviewSeverity severity)?  $default,) {final _that = this;
switch (_that) {
case _PreparationItem() when $default != null:
return $default(_that.label,_that.statusLabel,_that.severity);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PreparationItem implements PreparationItem {
  const _PreparationItem({required this.label, required this.statusLabel, required this.severity});
  factory _PreparationItem.fromJson(Map<String, dynamic> json) => _$PreparationItemFromJson(json);

@override final  String label;
@override final  String statusLabel;
@override final  OverviewSeverity severity;

/// Create a copy of PreparationItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PreparationItemCopyWith<_PreparationItem> get copyWith => __$PreparationItemCopyWithImpl<_PreparationItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PreparationItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PreparationItem&&(identical(other.label, label) || other.label == label)&&(identical(other.statusLabel, statusLabel) || other.statusLabel == statusLabel)&&(identical(other.severity, severity) || other.severity == severity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,label,statusLabel,severity);

@override
String toString() {
  return 'PreparationItem(label: $label, statusLabel: $statusLabel, severity: $severity)';
}


}

/// @nodoc
abstract mixin class _$PreparationItemCopyWith<$Res> implements $PreparationItemCopyWith<$Res> {
  factory _$PreparationItemCopyWith(_PreparationItem value, $Res Function(_PreparationItem) _then) = __$PreparationItemCopyWithImpl;
@override @useResult
$Res call({
 String label, String statusLabel, OverviewSeverity severity
});




}
/// @nodoc
class __$PreparationItemCopyWithImpl<$Res>
    implements _$PreparationItemCopyWith<$Res> {
  __$PreparationItemCopyWithImpl(this._self, this._then);

  final _PreparationItem _self;
  final $Res Function(_PreparationItem) _then;

/// Create a copy of PreparationItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? label = null,Object? statusLabel = null,Object? severity = null,}) {
  return _then(_PreparationItem(
label: null == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String,statusLabel: null == statusLabel ? _self.statusLabel : statusLabel // ignore: cast_nullable_to_non_nullable
as String,severity: null == severity ? _self.severity : severity // ignore: cast_nullable_to_non_nullable
as OverviewSeverity,
  ));
}


}


/// @nodoc
mixin _$WeatherRiskSnapshot {

 String get badgeLabel; int get rainChancePercent; double get windSpeedKmh; String get temperatureRangeLabel; double get visibilityKm; String get note;
/// Create a copy of WeatherRiskSnapshot
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$WeatherRiskSnapshotCopyWith<WeatherRiskSnapshot> get copyWith => _$WeatherRiskSnapshotCopyWithImpl<WeatherRiskSnapshot>(this as WeatherRiskSnapshot, _$identity);

  /// Serializes this WeatherRiskSnapshot to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is WeatherRiskSnapshot&&(identical(other.badgeLabel, badgeLabel) || other.badgeLabel == badgeLabel)&&(identical(other.rainChancePercent, rainChancePercent) || other.rainChancePercent == rainChancePercent)&&(identical(other.windSpeedKmh, windSpeedKmh) || other.windSpeedKmh == windSpeedKmh)&&(identical(other.temperatureRangeLabel, temperatureRangeLabel) || other.temperatureRangeLabel == temperatureRangeLabel)&&(identical(other.visibilityKm, visibilityKm) || other.visibilityKm == visibilityKm)&&(identical(other.note, note) || other.note == note));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,badgeLabel,rainChancePercent,windSpeedKmh,temperatureRangeLabel,visibilityKm,note);

@override
String toString() {
  return 'WeatherRiskSnapshot(badgeLabel: $badgeLabel, rainChancePercent: $rainChancePercent, windSpeedKmh: $windSpeedKmh, temperatureRangeLabel: $temperatureRangeLabel, visibilityKm: $visibilityKm, note: $note)';
}


}

/// @nodoc
abstract mixin class $WeatherRiskSnapshotCopyWith<$Res>  {
  factory $WeatherRiskSnapshotCopyWith(WeatherRiskSnapshot value, $Res Function(WeatherRiskSnapshot) _then) = _$WeatherRiskSnapshotCopyWithImpl;
@useResult
$Res call({
 String badgeLabel, int rainChancePercent, double windSpeedKmh, String temperatureRangeLabel, double visibilityKm, String note
});




}
/// @nodoc
class _$WeatherRiskSnapshotCopyWithImpl<$Res>
    implements $WeatherRiskSnapshotCopyWith<$Res> {
  _$WeatherRiskSnapshotCopyWithImpl(this._self, this._then);

  final WeatherRiskSnapshot _self;
  final $Res Function(WeatherRiskSnapshot) _then;

/// Create a copy of WeatherRiskSnapshot
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? badgeLabel = null,Object? rainChancePercent = null,Object? windSpeedKmh = null,Object? temperatureRangeLabel = null,Object? visibilityKm = null,Object? note = null,}) {
  return _then(_self.copyWith(
badgeLabel: null == badgeLabel ? _self.badgeLabel : badgeLabel // ignore: cast_nullable_to_non_nullable
as String,rainChancePercent: null == rainChancePercent ? _self.rainChancePercent : rainChancePercent // ignore: cast_nullable_to_non_nullable
as int,windSpeedKmh: null == windSpeedKmh ? _self.windSpeedKmh : windSpeedKmh // ignore: cast_nullable_to_non_nullable
as double,temperatureRangeLabel: null == temperatureRangeLabel ? _self.temperatureRangeLabel : temperatureRangeLabel // ignore: cast_nullable_to_non_nullable
as String,visibilityKm: null == visibilityKm ? _self.visibilityKm : visibilityKm // ignore: cast_nullable_to_non_nullable
as double,note: null == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [WeatherRiskSnapshot].
extension WeatherRiskSnapshotPatterns on WeatherRiskSnapshot {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _WeatherRiskSnapshot value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _WeatherRiskSnapshot() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _WeatherRiskSnapshot value)  $default,){
final _that = this;
switch (_that) {
case _WeatherRiskSnapshot():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _WeatherRiskSnapshot value)?  $default,){
final _that = this;
switch (_that) {
case _WeatherRiskSnapshot() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String badgeLabel,  int rainChancePercent,  double windSpeedKmh,  String temperatureRangeLabel,  double visibilityKm,  String note)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _WeatherRiskSnapshot() when $default != null:
return $default(_that.badgeLabel,_that.rainChancePercent,_that.windSpeedKmh,_that.temperatureRangeLabel,_that.visibilityKm,_that.note);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String badgeLabel,  int rainChancePercent,  double windSpeedKmh,  String temperatureRangeLabel,  double visibilityKm,  String note)  $default,) {final _that = this;
switch (_that) {
case _WeatherRiskSnapshot():
return $default(_that.badgeLabel,_that.rainChancePercent,_that.windSpeedKmh,_that.temperatureRangeLabel,_that.visibilityKm,_that.note);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String badgeLabel,  int rainChancePercent,  double windSpeedKmh,  String temperatureRangeLabel,  double visibilityKm,  String note)?  $default,) {final _that = this;
switch (_that) {
case _WeatherRiskSnapshot() when $default != null:
return $default(_that.badgeLabel,_that.rainChancePercent,_that.windSpeedKmh,_that.temperatureRangeLabel,_that.visibilityKm,_that.note);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _WeatherRiskSnapshot implements WeatherRiskSnapshot {
  const _WeatherRiskSnapshot({required this.badgeLabel, required this.rainChancePercent, required this.windSpeedKmh, required this.temperatureRangeLabel, required this.visibilityKm, required this.note});
  factory _WeatherRiskSnapshot.fromJson(Map<String, dynamic> json) => _$WeatherRiskSnapshotFromJson(json);

@override final  String badgeLabel;
@override final  int rainChancePercent;
@override final  double windSpeedKmh;
@override final  String temperatureRangeLabel;
@override final  double visibilityKm;
@override final  String note;

/// Create a copy of WeatherRiskSnapshot
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$WeatherRiskSnapshotCopyWith<_WeatherRiskSnapshot> get copyWith => __$WeatherRiskSnapshotCopyWithImpl<_WeatherRiskSnapshot>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$WeatherRiskSnapshotToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _WeatherRiskSnapshot&&(identical(other.badgeLabel, badgeLabel) || other.badgeLabel == badgeLabel)&&(identical(other.rainChancePercent, rainChancePercent) || other.rainChancePercent == rainChancePercent)&&(identical(other.windSpeedKmh, windSpeedKmh) || other.windSpeedKmh == windSpeedKmh)&&(identical(other.temperatureRangeLabel, temperatureRangeLabel) || other.temperatureRangeLabel == temperatureRangeLabel)&&(identical(other.visibilityKm, visibilityKm) || other.visibilityKm == visibilityKm)&&(identical(other.note, note) || other.note == note));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,badgeLabel,rainChancePercent,windSpeedKmh,temperatureRangeLabel,visibilityKm,note);

@override
String toString() {
  return 'WeatherRiskSnapshot(badgeLabel: $badgeLabel, rainChancePercent: $rainChancePercent, windSpeedKmh: $windSpeedKmh, temperatureRangeLabel: $temperatureRangeLabel, visibilityKm: $visibilityKm, note: $note)';
}


}

/// @nodoc
abstract mixin class _$WeatherRiskSnapshotCopyWith<$Res> implements $WeatherRiskSnapshotCopyWith<$Res> {
  factory _$WeatherRiskSnapshotCopyWith(_WeatherRiskSnapshot value, $Res Function(_WeatherRiskSnapshot) _then) = __$WeatherRiskSnapshotCopyWithImpl;
@override @useResult
$Res call({
 String badgeLabel, int rainChancePercent, double windSpeedKmh, String temperatureRangeLabel, double visibilityKm, String note
});




}
/// @nodoc
class __$WeatherRiskSnapshotCopyWithImpl<$Res>
    implements _$WeatherRiskSnapshotCopyWith<$Res> {
  __$WeatherRiskSnapshotCopyWithImpl(this._self, this._then);

  final _WeatherRiskSnapshot _self;
  final $Res Function(_WeatherRiskSnapshot) _then;

/// Create a copy of WeatherRiskSnapshot
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? badgeLabel = null,Object? rainChancePercent = null,Object? windSpeedKmh = null,Object? temperatureRangeLabel = null,Object? visibilityKm = null,Object? note = null,}) {
  return _then(_WeatherRiskSnapshot(
badgeLabel: null == badgeLabel ? _self.badgeLabel : badgeLabel // ignore: cast_nullable_to_non_nullable
as String,rainChancePercent: null == rainChancePercent ? _self.rainChancePercent : rainChancePercent // ignore: cast_nullable_to_non_nullable
as int,windSpeedKmh: null == windSpeedKmh ? _self.windSpeedKmh : windSpeedKmh // ignore: cast_nullable_to_non_nullable
as double,temperatureRangeLabel: null == temperatureRangeLabel ? _self.temperatureRangeLabel : temperatureRangeLabel // ignore: cast_nullable_to_non_nullable
as String,visibilityKm: null == visibilityKm ? _self.visibilityKm : visibilityKm // ignore: cast_nullable_to_non_nullable
as double,note: null == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$RecentTransaction {

 String get code; String get location; DateTime get stayDate; int get guestCount; int get amountVnd; String get statusLabel; OverviewSeverity get severity;
/// Create a copy of RecentTransaction
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RecentTransactionCopyWith<RecentTransaction> get copyWith => _$RecentTransactionCopyWithImpl<RecentTransaction>(this as RecentTransaction, _$identity);

  /// Serializes this RecentTransaction to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RecentTransaction&&(identical(other.code, code) || other.code == code)&&(identical(other.location, location) || other.location == location)&&(identical(other.stayDate, stayDate) || other.stayDate == stayDate)&&(identical(other.guestCount, guestCount) || other.guestCount == guestCount)&&(identical(other.amountVnd, amountVnd) || other.amountVnd == amountVnd)&&(identical(other.statusLabel, statusLabel) || other.statusLabel == statusLabel)&&(identical(other.severity, severity) || other.severity == severity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,code,location,stayDate,guestCount,amountVnd,statusLabel,severity);

@override
String toString() {
  return 'RecentTransaction(code: $code, location: $location, stayDate: $stayDate, guestCount: $guestCount, amountVnd: $amountVnd, statusLabel: $statusLabel, severity: $severity)';
}


}

/// @nodoc
abstract mixin class $RecentTransactionCopyWith<$Res>  {
  factory $RecentTransactionCopyWith(RecentTransaction value, $Res Function(RecentTransaction) _then) = _$RecentTransactionCopyWithImpl;
@useResult
$Res call({
 String code, String location, DateTime stayDate, int guestCount, int amountVnd, String statusLabel, OverviewSeverity severity
});




}
/// @nodoc
class _$RecentTransactionCopyWithImpl<$Res>
    implements $RecentTransactionCopyWith<$Res> {
  _$RecentTransactionCopyWithImpl(this._self, this._then);

  final RecentTransaction _self;
  final $Res Function(RecentTransaction) _then;

/// Create a copy of RecentTransaction
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? code = null,Object? location = null,Object? stayDate = null,Object? guestCount = null,Object? amountVnd = null,Object? statusLabel = null,Object? severity = null,}) {
  return _then(_self.copyWith(
code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,location: null == location ? _self.location : location // ignore: cast_nullable_to_non_nullable
as String,stayDate: null == stayDate ? _self.stayDate : stayDate // ignore: cast_nullable_to_non_nullable
as DateTime,guestCount: null == guestCount ? _self.guestCount : guestCount // ignore: cast_nullable_to_non_nullable
as int,amountVnd: null == amountVnd ? _self.amountVnd : amountVnd // ignore: cast_nullable_to_non_nullable
as int,statusLabel: null == statusLabel ? _self.statusLabel : statusLabel // ignore: cast_nullable_to_non_nullable
as String,severity: null == severity ? _self.severity : severity // ignore: cast_nullable_to_non_nullable
as OverviewSeverity,
  ));
}

}


/// Adds pattern-matching-related methods to [RecentTransaction].
extension RecentTransactionPatterns on RecentTransaction {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RecentTransaction value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RecentTransaction() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RecentTransaction value)  $default,){
final _that = this;
switch (_that) {
case _RecentTransaction():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RecentTransaction value)?  $default,){
final _that = this;
switch (_that) {
case _RecentTransaction() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String code,  String location,  DateTime stayDate,  int guestCount,  int amountVnd,  String statusLabel,  OverviewSeverity severity)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RecentTransaction() when $default != null:
return $default(_that.code,_that.location,_that.stayDate,_that.guestCount,_that.amountVnd,_that.statusLabel,_that.severity);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String code,  String location,  DateTime stayDate,  int guestCount,  int amountVnd,  String statusLabel,  OverviewSeverity severity)  $default,) {final _that = this;
switch (_that) {
case _RecentTransaction():
return $default(_that.code,_that.location,_that.stayDate,_that.guestCount,_that.amountVnd,_that.statusLabel,_that.severity);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String code,  String location,  DateTime stayDate,  int guestCount,  int amountVnd,  String statusLabel,  OverviewSeverity severity)?  $default,) {final _that = this;
switch (_that) {
case _RecentTransaction() when $default != null:
return $default(_that.code,_that.location,_that.stayDate,_that.guestCount,_that.amountVnd,_that.statusLabel,_that.severity);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _RecentTransaction implements RecentTransaction {
  const _RecentTransaction({required this.code, required this.location, required this.stayDate, required this.guestCount, required this.amountVnd, required this.statusLabel, required this.severity});
  factory _RecentTransaction.fromJson(Map<String, dynamic> json) => _$RecentTransactionFromJson(json);

@override final  String code;
@override final  String location;
@override final  DateTime stayDate;
@override final  int guestCount;
@override final  int amountVnd;
@override final  String statusLabel;
@override final  OverviewSeverity severity;

/// Create a copy of RecentTransaction
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RecentTransactionCopyWith<_RecentTransaction> get copyWith => __$RecentTransactionCopyWithImpl<_RecentTransaction>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RecentTransactionToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RecentTransaction&&(identical(other.code, code) || other.code == code)&&(identical(other.location, location) || other.location == location)&&(identical(other.stayDate, stayDate) || other.stayDate == stayDate)&&(identical(other.guestCount, guestCount) || other.guestCount == guestCount)&&(identical(other.amountVnd, amountVnd) || other.amountVnd == amountVnd)&&(identical(other.statusLabel, statusLabel) || other.statusLabel == statusLabel)&&(identical(other.severity, severity) || other.severity == severity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,code,location,stayDate,guestCount,amountVnd,statusLabel,severity);

@override
String toString() {
  return 'RecentTransaction(code: $code, location: $location, stayDate: $stayDate, guestCount: $guestCount, amountVnd: $amountVnd, statusLabel: $statusLabel, severity: $severity)';
}


}

/// @nodoc
abstract mixin class _$RecentTransactionCopyWith<$Res> implements $RecentTransactionCopyWith<$Res> {
  factory _$RecentTransactionCopyWith(_RecentTransaction value, $Res Function(_RecentTransaction) _then) = __$RecentTransactionCopyWithImpl;
@override @useResult
$Res call({
 String code, String location, DateTime stayDate, int guestCount, int amountVnd, String statusLabel, OverviewSeverity severity
});




}
/// @nodoc
class __$RecentTransactionCopyWithImpl<$Res>
    implements _$RecentTransactionCopyWith<$Res> {
  __$RecentTransactionCopyWithImpl(this._self, this._then);

  final _RecentTransaction _self;
  final $Res Function(_RecentTransaction) _then;

/// Create a copy of RecentTransaction
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? code = null,Object? location = null,Object? stayDate = null,Object? guestCount = null,Object? amountVnd = null,Object? statusLabel = null,Object? severity = null,}) {
  return _then(_RecentTransaction(
code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,location: null == location ? _self.location : location // ignore: cast_nullable_to_non_nullable
as String,stayDate: null == stayDate ? _self.stayDate : stayDate // ignore: cast_nullable_to_non_nullable
as DateTime,guestCount: null == guestCount ? _self.guestCount : guestCount // ignore: cast_nullable_to_non_nullable
as int,amountVnd: null == amountVnd ? _self.amountVnd : amountVnd // ignore: cast_nullable_to_non_nullable
as int,statusLabel: null == statusLabel ? _self.statusLabel : statusLabel // ignore: cast_nullable_to_non_nullable
as String,severity: null == severity ? _self.severity : severity // ignore: cast_nullable_to_non_nullable
as OverviewSeverity,
  ));
}


}


/// @nodoc
mixin _$SuggestedCampsite {

 String get name; String get location; int get pricePerPersonVnd; String get badgeLabel; OverviewSeverity get badgeSeverity;
/// Create a copy of SuggestedCampsite
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SuggestedCampsiteCopyWith<SuggestedCampsite> get copyWith => _$SuggestedCampsiteCopyWithImpl<SuggestedCampsite>(this as SuggestedCampsite, _$identity);

  /// Serializes this SuggestedCampsite to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SuggestedCampsite&&(identical(other.name, name) || other.name == name)&&(identical(other.location, location) || other.location == location)&&(identical(other.pricePerPersonVnd, pricePerPersonVnd) || other.pricePerPersonVnd == pricePerPersonVnd)&&(identical(other.badgeLabel, badgeLabel) || other.badgeLabel == badgeLabel)&&(identical(other.badgeSeverity, badgeSeverity) || other.badgeSeverity == badgeSeverity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,location,pricePerPersonVnd,badgeLabel,badgeSeverity);

@override
String toString() {
  return 'SuggestedCampsite(name: $name, location: $location, pricePerPersonVnd: $pricePerPersonVnd, badgeLabel: $badgeLabel, badgeSeverity: $badgeSeverity)';
}


}

/// @nodoc
abstract mixin class $SuggestedCampsiteCopyWith<$Res>  {
  factory $SuggestedCampsiteCopyWith(SuggestedCampsite value, $Res Function(SuggestedCampsite) _then) = _$SuggestedCampsiteCopyWithImpl;
@useResult
$Res call({
 String name, String location, int pricePerPersonVnd, String badgeLabel, OverviewSeverity badgeSeverity
});




}
/// @nodoc
class _$SuggestedCampsiteCopyWithImpl<$Res>
    implements $SuggestedCampsiteCopyWith<$Res> {
  _$SuggestedCampsiteCopyWithImpl(this._self, this._then);

  final SuggestedCampsite _self;
  final $Res Function(SuggestedCampsite) _then;

/// Create a copy of SuggestedCampsite
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? location = null,Object? pricePerPersonVnd = null,Object? badgeLabel = null,Object? badgeSeverity = null,}) {
  return _then(_self.copyWith(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,location: null == location ? _self.location : location // ignore: cast_nullable_to_non_nullable
as String,pricePerPersonVnd: null == pricePerPersonVnd ? _self.pricePerPersonVnd : pricePerPersonVnd // ignore: cast_nullable_to_non_nullable
as int,badgeLabel: null == badgeLabel ? _self.badgeLabel : badgeLabel // ignore: cast_nullable_to_non_nullable
as String,badgeSeverity: null == badgeSeverity ? _self.badgeSeverity : badgeSeverity // ignore: cast_nullable_to_non_nullable
as OverviewSeverity,
  ));
}

}


/// Adds pattern-matching-related methods to [SuggestedCampsite].
extension SuggestedCampsitePatterns on SuggestedCampsite {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SuggestedCampsite value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SuggestedCampsite() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SuggestedCampsite value)  $default,){
final _that = this;
switch (_that) {
case _SuggestedCampsite():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SuggestedCampsite value)?  $default,){
final _that = this;
switch (_that) {
case _SuggestedCampsite() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  String location,  int pricePerPersonVnd,  String badgeLabel,  OverviewSeverity badgeSeverity)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SuggestedCampsite() when $default != null:
return $default(_that.name,_that.location,_that.pricePerPersonVnd,_that.badgeLabel,_that.badgeSeverity);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  String location,  int pricePerPersonVnd,  String badgeLabel,  OverviewSeverity badgeSeverity)  $default,) {final _that = this;
switch (_that) {
case _SuggestedCampsite():
return $default(_that.name,_that.location,_that.pricePerPersonVnd,_that.badgeLabel,_that.badgeSeverity);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  String location,  int pricePerPersonVnd,  String badgeLabel,  OverviewSeverity badgeSeverity)?  $default,) {final _that = this;
switch (_that) {
case _SuggestedCampsite() when $default != null:
return $default(_that.name,_that.location,_that.pricePerPersonVnd,_that.badgeLabel,_that.badgeSeverity);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SuggestedCampsite implements SuggestedCampsite {
  const _SuggestedCampsite({required this.name, required this.location, required this.pricePerPersonVnd, required this.badgeLabel, required this.badgeSeverity});
  factory _SuggestedCampsite.fromJson(Map<String, dynamic> json) => _$SuggestedCampsiteFromJson(json);

@override final  String name;
@override final  String location;
@override final  int pricePerPersonVnd;
@override final  String badgeLabel;
@override final  OverviewSeverity badgeSeverity;

/// Create a copy of SuggestedCampsite
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SuggestedCampsiteCopyWith<_SuggestedCampsite> get copyWith => __$SuggestedCampsiteCopyWithImpl<_SuggestedCampsite>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SuggestedCampsiteToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SuggestedCampsite&&(identical(other.name, name) || other.name == name)&&(identical(other.location, location) || other.location == location)&&(identical(other.pricePerPersonVnd, pricePerPersonVnd) || other.pricePerPersonVnd == pricePerPersonVnd)&&(identical(other.badgeLabel, badgeLabel) || other.badgeLabel == badgeLabel)&&(identical(other.badgeSeverity, badgeSeverity) || other.badgeSeverity == badgeSeverity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,location,pricePerPersonVnd,badgeLabel,badgeSeverity);

@override
String toString() {
  return 'SuggestedCampsite(name: $name, location: $location, pricePerPersonVnd: $pricePerPersonVnd, badgeLabel: $badgeLabel, badgeSeverity: $badgeSeverity)';
}


}

/// @nodoc
abstract mixin class _$SuggestedCampsiteCopyWith<$Res> implements $SuggestedCampsiteCopyWith<$Res> {
  factory _$SuggestedCampsiteCopyWith(_SuggestedCampsite value, $Res Function(_SuggestedCampsite) _then) = __$SuggestedCampsiteCopyWithImpl;
@override @useResult
$Res call({
 String name, String location, int pricePerPersonVnd, String badgeLabel, OverviewSeverity badgeSeverity
});




}
/// @nodoc
class __$SuggestedCampsiteCopyWithImpl<$Res>
    implements _$SuggestedCampsiteCopyWith<$Res> {
  __$SuggestedCampsiteCopyWithImpl(this._self, this._then);

  final _SuggestedCampsite _self;
  final $Res Function(_SuggestedCampsite) _then;

/// Create a copy of SuggestedCampsite
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? location = null,Object? pricePerPersonVnd = null,Object? badgeLabel = null,Object? badgeSeverity = null,}) {
  return _then(_SuggestedCampsite(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,location: null == location ? _self.location : location // ignore: cast_nullable_to_non_nullable
as String,pricePerPersonVnd: null == pricePerPersonVnd ? _self.pricePerPersonVnd : pricePerPersonVnd // ignore: cast_nullable_to_non_nullable
as int,badgeLabel: null == badgeLabel ? _self.badgeLabel : badgeLabel // ignore: cast_nullable_to_non_nullable
as String,badgeSeverity: null == badgeSeverity ? _self.badgeSeverity : badgeSeverity // ignore: cast_nullable_to_non_nullable
as OverviewSeverity,
  ));
}


}


/// @nodoc
mixin _$CamperOverviewSnapshot {

 List<OverviewNotice> get notices; UpcomingTrip? get upcomingTrip; double get preparationProgress; List<PreparationItem> get preparationItems; WeatherRiskSnapshot get weatherRisk; List<RecentTransaction> get recentTransactions; List<SuggestedCampsite> get suggestions;
/// Create a copy of CamperOverviewSnapshot
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CamperOverviewSnapshotCopyWith<CamperOverviewSnapshot> get copyWith => _$CamperOverviewSnapshotCopyWithImpl<CamperOverviewSnapshot>(this as CamperOverviewSnapshot, _$identity);

  /// Serializes this CamperOverviewSnapshot to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CamperOverviewSnapshot&&const DeepCollectionEquality().equals(other.notices, notices)&&(identical(other.upcomingTrip, upcomingTrip) || other.upcomingTrip == upcomingTrip)&&(identical(other.preparationProgress, preparationProgress) || other.preparationProgress == preparationProgress)&&const DeepCollectionEquality().equals(other.preparationItems, preparationItems)&&(identical(other.weatherRisk, weatherRisk) || other.weatherRisk == weatherRisk)&&const DeepCollectionEquality().equals(other.recentTransactions, recentTransactions)&&const DeepCollectionEquality().equals(other.suggestions, suggestions));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(notices),upcomingTrip,preparationProgress,const DeepCollectionEquality().hash(preparationItems),weatherRisk,const DeepCollectionEquality().hash(recentTransactions),const DeepCollectionEquality().hash(suggestions));

@override
String toString() {
  return 'CamperOverviewSnapshot(notices: $notices, upcomingTrip: $upcomingTrip, preparationProgress: $preparationProgress, preparationItems: $preparationItems, weatherRisk: $weatherRisk, recentTransactions: $recentTransactions, suggestions: $suggestions)';
}


}

/// @nodoc
abstract mixin class $CamperOverviewSnapshotCopyWith<$Res>  {
  factory $CamperOverviewSnapshotCopyWith(CamperOverviewSnapshot value, $Res Function(CamperOverviewSnapshot) _then) = _$CamperOverviewSnapshotCopyWithImpl;
@useResult
$Res call({
 List<OverviewNotice> notices, UpcomingTrip? upcomingTrip, double preparationProgress, List<PreparationItem> preparationItems, WeatherRiskSnapshot weatherRisk, List<RecentTransaction> recentTransactions, List<SuggestedCampsite> suggestions
});


$UpcomingTripCopyWith<$Res>? get upcomingTrip;$WeatherRiskSnapshotCopyWith<$Res> get weatherRisk;

}
/// @nodoc
class _$CamperOverviewSnapshotCopyWithImpl<$Res>
    implements $CamperOverviewSnapshotCopyWith<$Res> {
  _$CamperOverviewSnapshotCopyWithImpl(this._self, this._then);

  final CamperOverviewSnapshot _self;
  final $Res Function(CamperOverviewSnapshot) _then;

/// Create a copy of CamperOverviewSnapshot
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? notices = null,Object? upcomingTrip = freezed,Object? preparationProgress = null,Object? preparationItems = null,Object? weatherRisk = null,Object? recentTransactions = null,Object? suggestions = null,}) {
  return _then(_self.copyWith(
notices: null == notices ? _self.notices : notices // ignore: cast_nullable_to_non_nullable
as List<OverviewNotice>,upcomingTrip: freezed == upcomingTrip ? _self.upcomingTrip : upcomingTrip // ignore: cast_nullable_to_non_nullable
as UpcomingTrip?,preparationProgress: null == preparationProgress ? _self.preparationProgress : preparationProgress // ignore: cast_nullable_to_non_nullable
as double,preparationItems: null == preparationItems ? _self.preparationItems : preparationItems // ignore: cast_nullable_to_non_nullable
as List<PreparationItem>,weatherRisk: null == weatherRisk ? _self.weatherRisk : weatherRisk // ignore: cast_nullable_to_non_nullable
as WeatherRiskSnapshot,recentTransactions: null == recentTransactions ? _self.recentTransactions : recentTransactions // ignore: cast_nullable_to_non_nullable
as List<RecentTransaction>,suggestions: null == suggestions ? _self.suggestions : suggestions // ignore: cast_nullable_to_non_nullable
as List<SuggestedCampsite>,
  ));
}
/// Create a copy of CamperOverviewSnapshot
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$UpcomingTripCopyWith<$Res>? get upcomingTrip {
    if (_self.upcomingTrip == null) {
    return null;
  }

  return $UpcomingTripCopyWith<$Res>(_self.upcomingTrip!, (value) {
    return _then(_self.copyWith(upcomingTrip: value));
  });
}/// Create a copy of CamperOverviewSnapshot
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$WeatherRiskSnapshotCopyWith<$Res> get weatherRisk {
  
  return $WeatherRiskSnapshotCopyWith<$Res>(_self.weatherRisk, (value) {
    return _then(_self.copyWith(weatherRisk: value));
  });
}
}


/// Adds pattern-matching-related methods to [CamperOverviewSnapshot].
extension CamperOverviewSnapshotPatterns on CamperOverviewSnapshot {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CamperOverviewSnapshot value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CamperOverviewSnapshot() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CamperOverviewSnapshot value)  $default,){
final _that = this;
switch (_that) {
case _CamperOverviewSnapshot():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CamperOverviewSnapshot value)?  $default,){
final _that = this;
switch (_that) {
case _CamperOverviewSnapshot() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<OverviewNotice> notices,  UpcomingTrip? upcomingTrip,  double preparationProgress,  List<PreparationItem> preparationItems,  WeatherRiskSnapshot weatherRisk,  List<RecentTransaction> recentTransactions,  List<SuggestedCampsite> suggestions)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CamperOverviewSnapshot() when $default != null:
return $default(_that.notices,_that.upcomingTrip,_that.preparationProgress,_that.preparationItems,_that.weatherRisk,_that.recentTransactions,_that.suggestions);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<OverviewNotice> notices,  UpcomingTrip? upcomingTrip,  double preparationProgress,  List<PreparationItem> preparationItems,  WeatherRiskSnapshot weatherRisk,  List<RecentTransaction> recentTransactions,  List<SuggestedCampsite> suggestions)  $default,) {final _that = this;
switch (_that) {
case _CamperOverviewSnapshot():
return $default(_that.notices,_that.upcomingTrip,_that.preparationProgress,_that.preparationItems,_that.weatherRisk,_that.recentTransactions,_that.suggestions);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<OverviewNotice> notices,  UpcomingTrip? upcomingTrip,  double preparationProgress,  List<PreparationItem> preparationItems,  WeatherRiskSnapshot weatherRisk,  List<RecentTransaction> recentTransactions,  List<SuggestedCampsite> suggestions)?  $default,) {final _that = this;
switch (_that) {
case _CamperOverviewSnapshot() when $default != null:
return $default(_that.notices,_that.upcomingTrip,_that.preparationProgress,_that.preparationItems,_that.weatherRisk,_that.recentTransactions,_that.suggestions);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CamperOverviewSnapshot implements CamperOverviewSnapshot {
  const _CamperOverviewSnapshot({required final  List<OverviewNotice> notices, this.upcomingTrip, required this.preparationProgress, required final  List<PreparationItem> preparationItems, required this.weatherRisk, required final  List<RecentTransaction> recentTransactions, required final  List<SuggestedCampsite> suggestions}): _notices = notices,_preparationItems = preparationItems,_recentTransactions = recentTransactions,_suggestions = suggestions;
  factory _CamperOverviewSnapshot.fromJson(Map<String, dynamic> json) => _$CamperOverviewSnapshotFromJson(json);

 final  List<OverviewNotice> _notices;
@override List<OverviewNotice> get notices {
  if (_notices is EqualUnmodifiableListView) return _notices;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_notices);
}

@override final  UpcomingTrip? upcomingTrip;
@override final  double preparationProgress;
 final  List<PreparationItem> _preparationItems;
@override List<PreparationItem> get preparationItems {
  if (_preparationItems is EqualUnmodifiableListView) return _preparationItems;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_preparationItems);
}

@override final  WeatherRiskSnapshot weatherRisk;
 final  List<RecentTransaction> _recentTransactions;
@override List<RecentTransaction> get recentTransactions {
  if (_recentTransactions is EqualUnmodifiableListView) return _recentTransactions;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_recentTransactions);
}

 final  List<SuggestedCampsite> _suggestions;
@override List<SuggestedCampsite> get suggestions {
  if (_suggestions is EqualUnmodifiableListView) return _suggestions;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_suggestions);
}


/// Create a copy of CamperOverviewSnapshot
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CamperOverviewSnapshotCopyWith<_CamperOverviewSnapshot> get copyWith => __$CamperOverviewSnapshotCopyWithImpl<_CamperOverviewSnapshot>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CamperOverviewSnapshotToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CamperOverviewSnapshot&&const DeepCollectionEquality().equals(other._notices, _notices)&&(identical(other.upcomingTrip, upcomingTrip) || other.upcomingTrip == upcomingTrip)&&(identical(other.preparationProgress, preparationProgress) || other.preparationProgress == preparationProgress)&&const DeepCollectionEquality().equals(other._preparationItems, _preparationItems)&&(identical(other.weatherRisk, weatherRisk) || other.weatherRisk == weatherRisk)&&const DeepCollectionEquality().equals(other._recentTransactions, _recentTransactions)&&const DeepCollectionEquality().equals(other._suggestions, _suggestions));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_notices),upcomingTrip,preparationProgress,const DeepCollectionEquality().hash(_preparationItems),weatherRisk,const DeepCollectionEquality().hash(_recentTransactions),const DeepCollectionEquality().hash(_suggestions));

@override
String toString() {
  return 'CamperOverviewSnapshot(notices: $notices, upcomingTrip: $upcomingTrip, preparationProgress: $preparationProgress, preparationItems: $preparationItems, weatherRisk: $weatherRisk, recentTransactions: $recentTransactions, suggestions: $suggestions)';
}


}

/// @nodoc
abstract mixin class _$CamperOverviewSnapshotCopyWith<$Res> implements $CamperOverviewSnapshotCopyWith<$Res> {
  factory _$CamperOverviewSnapshotCopyWith(_CamperOverviewSnapshot value, $Res Function(_CamperOverviewSnapshot) _then) = __$CamperOverviewSnapshotCopyWithImpl;
@override @useResult
$Res call({
 List<OverviewNotice> notices, UpcomingTrip? upcomingTrip, double preparationProgress, List<PreparationItem> preparationItems, WeatherRiskSnapshot weatherRisk, List<RecentTransaction> recentTransactions, List<SuggestedCampsite> suggestions
});


@override $UpcomingTripCopyWith<$Res>? get upcomingTrip;@override $WeatherRiskSnapshotCopyWith<$Res> get weatherRisk;

}
/// @nodoc
class __$CamperOverviewSnapshotCopyWithImpl<$Res>
    implements _$CamperOverviewSnapshotCopyWith<$Res> {
  __$CamperOverviewSnapshotCopyWithImpl(this._self, this._then);

  final _CamperOverviewSnapshot _self;
  final $Res Function(_CamperOverviewSnapshot) _then;

/// Create a copy of CamperOverviewSnapshot
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? notices = null,Object? upcomingTrip = freezed,Object? preparationProgress = null,Object? preparationItems = null,Object? weatherRisk = null,Object? recentTransactions = null,Object? suggestions = null,}) {
  return _then(_CamperOverviewSnapshot(
notices: null == notices ? _self._notices : notices // ignore: cast_nullable_to_non_nullable
as List<OverviewNotice>,upcomingTrip: freezed == upcomingTrip ? _self.upcomingTrip : upcomingTrip // ignore: cast_nullable_to_non_nullable
as UpcomingTrip?,preparationProgress: null == preparationProgress ? _self.preparationProgress : preparationProgress // ignore: cast_nullable_to_non_nullable
as double,preparationItems: null == preparationItems ? _self._preparationItems : preparationItems // ignore: cast_nullable_to_non_nullable
as List<PreparationItem>,weatherRisk: null == weatherRisk ? _self.weatherRisk : weatherRisk // ignore: cast_nullable_to_non_nullable
as WeatherRiskSnapshot,recentTransactions: null == recentTransactions ? _self._recentTransactions : recentTransactions // ignore: cast_nullable_to_non_nullable
as List<RecentTransaction>,suggestions: null == suggestions ? _self._suggestions : suggestions // ignore: cast_nullable_to_non_nullable
as List<SuggestedCampsite>,
  ));
}

/// Create a copy of CamperOverviewSnapshot
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$UpcomingTripCopyWith<$Res>? get upcomingTrip {
    if (_self.upcomingTrip == null) {
    return null;
  }

  return $UpcomingTripCopyWith<$Res>(_self.upcomingTrip!, (value) {
    return _then(_self.copyWith(upcomingTrip: value));
  });
}/// Create a copy of CamperOverviewSnapshot
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$WeatherRiskSnapshotCopyWith<$Res> get weatherRisk {
  
  return $WeatherRiskSnapshotCopyWith<$Res>(_self.weatherRisk, (value) {
    return _then(_self.copyWith(weatherRisk: value));
  });
}
}

// dart format on
