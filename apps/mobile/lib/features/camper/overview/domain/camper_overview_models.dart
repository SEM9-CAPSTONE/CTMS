import 'package:freezed_annotation/freezed_annotation.dart';

part 'camper_overview_models.freezed.dart';
part 'camper_overview_models.g.dart';

/// Generic status color for a piece of overview data — presentation maps
/// this to `CtmsStatus`/`CtmsBadgeVariant` rather than the domain layer
/// depending on a UI widget's enum.
enum OverviewSeverity { info, warning, danger, success, neutral }

@freezed
abstract class OverviewNotice with _$OverviewNotice {
  const factory OverviewNotice({required String message, required OverviewSeverity severity}) =
      _OverviewNotice;

  factory OverviewNotice.fromJson(Map<String, dynamic> json) => _$OverviewNoticeFromJson(json);
}

@freezed
abstract class UpcomingTrip with _$UpcomingTrip {
  const factory UpcomingTrip({
    required String name,
    required String statusLabel,
    required DateTime startDate,
    required int durationDays,
    required int memberCount,
    required String difficulty,
    required String porterName,
    required String weatherRiskLabel,
  }) = _UpcomingTrip;

  factory UpcomingTrip.fromJson(Map<String, dynamic> json) => _$UpcomingTripFromJson(json);
}

@freezed
abstract class PreparationItem with _$PreparationItem {
  const factory PreparationItem({
    required String label,
    required String statusLabel,
    required OverviewSeverity severity,
  }) = _PreparationItem;

  factory PreparationItem.fromJson(Map<String, dynamic> json) =>
      _$PreparationItemFromJson(json);
}

@freezed
abstract class WeatherRiskSnapshot with _$WeatherRiskSnapshot {
  const factory WeatherRiskSnapshot({
    required String badgeLabel,
    required int rainChancePercent,
    required double windSpeedKmh,
    required String temperatureRangeLabel,
    required double visibilityKm,
    required String note,
  }) = _WeatherRiskSnapshot;

  factory WeatherRiskSnapshot.fromJson(Map<String, dynamic> json) =>
      _$WeatherRiskSnapshotFromJson(json);
}

@freezed
abstract class RecentTransaction with _$RecentTransaction {
  const factory RecentTransaction({
    required String code,
    required String location,
    required DateTime stayDate,
    required int guestCount,
    required int amountVnd,
    required String statusLabel,
    required OverviewSeverity severity,
  }) = _RecentTransaction;

  factory RecentTransaction.fromJson(Map<String, dynamic> json) =>
      _$RecentTransactionFromJson(json);
}

@freezed
abstract class SuggestedCampsite with _$SuggestedCampsite {
  const factory SuggestedCampsite({
    required String name,
    required String location,
    required int pricePerPersonVnd,
    required String badgeLabel,
    required OverviewSeverity badgeSeverity,
  }) = _SuggestedCampsite;

  factory SuggestedCampsite.fromJson(Map<String, dynamic> json) =>
      _$SuggestedCampsiteFromJson(json);
}

/// The whole "Tổng quan — Camper Hub" payload — one fetch backs every
/// section on the screen (§FIGMA-SCREEN-INVENTORY.md #23).
@freezed
abstract class CamperOverviewSnapshot with _$CamperOverviewSnapshot {
  const factory CamperOverviewSnapshot({
    required List<OverviewNotice> notices,
    UpcomingTrip? upcomingTrip,
    required double preparationProgress,
    required List<PreparationItem> preparationItems,
    required WeatherRiskSnapshot weatherRisk,
    required List<RecentTransaction> recentTransactions,
    required List<SuggestedCampsite> suggestions,
  }) = _CamperOverviewSnapshot;

  factory CamperOverviewSnapshot.fromJson(Map<String, dynamic> json) =>
      _$CamperOverviewSnapshotFromJson(json);
}
