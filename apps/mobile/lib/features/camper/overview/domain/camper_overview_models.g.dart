// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'camper_overview_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_OverviewNotice _$OverviewNoticeFromJson(Map<String, dynamic> json) =>
    _OverviewNotice(
      message: json['message'] as String,
      severity: $enumDecode(_$OverviewSeverityEnumMap, json['severity']),
    );

Map<String, dynamic> _$OverviewNoticeToJson(_OverviewNotice instance) =>
    <String, dynamic>{
      'message': instance.message,
      'severity': _$OverviewSeverityEnumMap[instance.severity]!,
    };

const _$OverviewSeverityEnumMap = {
  OverviewSeverity.info: 'info',
  OverviewSeverity.warning: 'warning',
  OverviewSeverity.danger: 'danger',
  OverviewSeverity.success: 'success',
  OverviewSeverity.neutral: 'neutral',
};

_UpcomingTrip _$UpcomingTripFromJson(Map<String, dynamic> json) =>
    _UpcomingTrip(
      name: json['name'] as String,
      statusLabel: json['statusLabel'] as String,
      startDate: DateTime.parse(json['startDate'] as String),
      durationDays: (json['durationDays'] as num).toInt(),
      memberCount: (json['memberCount'] as num).toInt(),
      difficulty: json['difficulty'] as String,
      porterName: json['porterName'] as String,
      weatherRiskLabel: json['weatherRiskLabel'] as String,
    );

Map<String, dynamic> _$UpcomingTripToJson(_UpcomingTrip instance) =>
    <String, dynamic>{
      'name': instance.name,
      'statusLabel': instance.statusLabel,
      'startDate': instance.startDate.toIso8601String(),
      'durationDays': instance.durationDays,
      'memberCount': instance.memberCount,
      'difficulty': instance.difficulty,
      'porterName': instance.porterName,
      'weatherRiskLabel': instance.weatherRiskLabel,
    };

_PreparationItem _$PreparationItemFromJson(Map<String, dynamic> json) =>
    _PreparationItem(
      label: json['label'] as String,
      statusLabel: json['statusLabel'] as String,
      severity: $enumDecode(_$OverviewSeverityEnumMap, json['severity']),
    );

Map<String, dynamic> _$PreparationItemToJson(_PreparationItem instance) =>
    <String, dynamic>{
      'label': instance.label,
      'statusLabel': instance.statusLabel,
      'severity': _$OverviewSeverityEnumMap[instance.severity]!,
    };

_WeatherRiskSnapshot _$WeatherRiskSnapshotFromJson(Map<String, dynamic> json) =>
    _WeatherRiskSnapshot(
      badgeLabel: json['badgeLabel'] as String,
      rainChancePercent: (json['rainChancePercent'] as num).toInt(),
      windSpeedKmh: (json['windSpeedKmh'] as num).toDouble(),
      temperatureRangeLabel: json['temperatureRangeLabel'] as String,
      visibilityKm: (json['visibilityKm'] as num).toDouble(),
      note: json['note'] as String,
    );

Map<String, dynamic> _$WeatherRiskSnapshotToJson(
  _WeatherRiskSnapshot instance,
) => <String, dynamic>{
  'badgeLabel': instance.badgeLabel,
  'rainChancePercent': instance.rainChancePercent,
  'windSpeedKmh': instance.windSpeedKmh,
  'temperatureRangeLabel': instance.temperatureRangeLabel,
  'visibilityKm': instance.visibilityKm,
  'note': instance.note,
};

_RecentTransaction _$RecentTransactionFromJson(Map<String, dynamic> json) =>
    _RecentTransaction(
      code: json['code'] as String,
      location: json['location'] as String,
      stayDate: DateTime.parse(json['stayDate'] as String),
      guestCount: (json['guestCount'] as num).toInt(),
      amountVnd: (json['amountVnd'] as num).toInt(),
      statusLabel: json['statusLabel'] as String,
      severity: $enumDecode(_$OverviewSeverityEnumMap, json['severity']),
    );

Map<String, dynamic> _$RecentTransactionToJson(_RecentTransaction instance) =>
    <String, dynamic>{
      'code': instance.code,
      'location': instance.location,
      'stayDate': instance.stayDate.toIso8601String(),
      'guestCount': instance.guestCount,
      'amountVnd': instance.amountVnd,
      'statusLabel': instance.statusLabel,
      'severity': _$OverviewSeverityEnumMap[instance.severity]!,
    };

_SuggestedCampsite _$SuggestedCampsiteFromJson(Map<String, dynamic> json) =>
    _SuggestedCampsite(
      name: json['name'] as String,
      location: json['location'] as String,
      pricePerPersonVnd: (json['pricePerPersonVnd'] as num).toInt(),
      badgeLabel: json['badgeLabel'] as String,
      badgeSeverity: $enumDecode(
        _$OverviewSeverityEnumMap,
        json['badgeSeverity'],
      ),
    );

Map<String, dynamic> _$SuggestedCampsiteToJson(_SuggestedCampsite instance) =>
    <String, dynamic>{
      'name': instance.name,
      'location': instance.location,
      'pricePerPersonVnd': instance.pricePerPersonVnd,
      'badgeLabel': instance.badgeLabel,
      'badgeSeverity': _$OverviewSeverityEnumMap[instance.badgeSeverity]!,
    };

_CamperOverviewSnapshot _$CamperOverviewSnapshotFromJson(
  Map<String, dynamic> json,
) => _CamperOverviewSnapshot(
  notices: (json['notices'] as List<dynamic>)
      .map((e) => OverviewNotice.fromJson(e as Map<String, dynamic>))
      .toList(),
  upcomingTrip: json['upcomingTrip'] == null
      ? null
      : UpcomingTrip.fromJson(json['upcomingTrip'] as Map<String, dynamic>),
  preparationProgress: (json['preparationProgress'] as num).toDouble(),
  preparationItems: (json['preparationItems'] as List<dynamic>)
      .map((e) => PreparationItem.fromJson(e as Map<String, dynamic>))
      .toList(),
  weatherRisk: WeatherRiskSnapshot.fromJson(
    json['weatherRisk'] as Map<String, dynamic>,
  ),
  recentTransactions: (json['recentTransactions'] as List<dynamic>)
      .map((e) => RecentTransaction.fromJson(e as Map<String, dynamic>))
      .toList(),
  suggestions: (json['suggestions'] as List<dynamic>)
      .map((e) => SuggestedCampsite.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$CamperOverviewSnapshotToJson(
  _CamperOverviewSnapshot instance,
) => <String, dynamic>{
  'notices': instance.notices,
  'upcomingTrip': instance.upcomingTrip,
  'preparationProgress': instance.preparationProgress,
  'preparationItems': instance.preparationItems,
  'weatherRisk': instance.weatherRisk,
  'recentTransactions': instance.recentTransactions,
  'suggestions': instance.suggestions,
};
