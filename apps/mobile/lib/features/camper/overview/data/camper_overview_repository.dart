import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_endpoints.dart';
import '../../../trip_reviews/domain/review_models.dart';
import '../domain/camper_overview_models.dart';

class CamperOverviewRepository {
  CamperOverviewRepository(this._apiClient);

  final ApiClient _apiClient;
  ReviewBooking? activeBooking;

  Future<CamperOverviewSnapshot> fetchOverview() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.bookings.getAll);
      final rawList = response.data;
      final list = (rawList is List ? rawList : [])
          .map((item) => ReviewBooking.fromJson(Map<String, Object?>.from(item as Map)))
          .toList();

      final validBookings = list.where((b) => b.status != 'cancelled').toList();

      final now = DateTime.now();
      validBookings.sort((a, b) {
        final aStart = a.startsAt ?? a.createdAt;
        final bStart = b.startsAt ?? b.createdAt;
        final aOngoing = aStart.isBefore(now) && (a.endsAt?.isAfter(now) ?? false);
        final bOngoing = bStart.isBefore(now) && (b.endsAt?.isAfter(now) ?? false);
        if (aOngoing && !bOngoing) return -1;
        if (!aOngoing && bOngoing) return 1;
        final aFuture = aStart.isAfter(now);
        final bFuture = bStart.isAfter(now);
        if (aFuture && !bFuture) return -1;
        if (!aFuture && bFuture) return 1;
        if (aFuture && bFuture) return aStart.compareTo(bStart);
        return bStart.compareTo(aStart);
      });

      final latest = validBookings.isNotEmpty ? validBookings.first : null;
      activeBooking = latest;

      if (latest == null) {
        return const CamperOverviewSnapshot(
          notices: [],
          upcomingTrip: null,
          preparationProgress: 0.0,
          preparationItems: [],
          weatherRisk: WeatherRiskSnapshot(
            badgeLabel: '',
            rainChancePercent: 0,
            windSpeedKmh: 0,
            temperatureRangeLabel: '',
            visibilityKm: 0,
            note: '',
          ),
          recentTransactions: [],
          suggestions: [],
        );
      }

      final startsAt = latest.startsAt ?? latest.createdAt;
      final durationDays = latest.endsAt != null && latest.startsAt != null
          ? latest.endsAt!.difference(latest.startsAt!).inDays.clamp(1, 30)
          : 1;

      final isPaid = latest.status == 'confirmed' || latest.paymentStatus == 'paid';
      final statusLabel = switch (latest.status) {
        'confirmed' => 'Đã xác nhận',
        'completed' => 'Đã hoàn thành',
        'pending' => 'Chờ xác nhận',
        _ => latest.status ?? 'Đang diễn ra',
      };

      final items = [
        PreparationItem(
          label: 'Xác nhận đặt chỗ & thanh toán',
          statusLabel: isPaid ? 'Đã hoàn tất' : 'Chờ xác nhận',
          severity: isPaid ? OverviewSeverity.success : OverviewSeverity.warning,
        ),
        PreparationItem(
          label: 'Danh sách thành viên (${latest.numPeople ?? 1} người)',
          statusLabel: 'Đã đăng ký',
          severity: OverviewSeverity.success,
        ),
        const PreparationItem(
          label: 'Dữ liệu hành trình & Bản đồ offline',
          statusLabel: 'Sẵn sàng đồng bộ',
          severity: OverviewSeverity.info,
        ),
        const PreparationItem(
          label: 'Hồ sơ y tế & Sức khỏe cá nhân',
          statusLabel: 'Đã hoàn tất',
          severity: OverviewSeverity.success,
        ),
        const PreparationItem(
          label: 'Thiết bị định vị GPS & Báo động SOS',
          statusLabel: 'Đã kích hoạt',
          severity: OverviewSeverity.success,
        ),
      ];

      final successCount = items.where((i) => i.severity == OverviewSeverity.success).length;
      final progress = successCount / items.length;

      final upcomingTrip = UpcomingTrip(
        name: latest.title,
        statusLabel: statusLabel,
        startDate: startsAt,
        durationDays: durationDays,
        memberCount: latest.numPeople ?? 1,
        difficulty: 'Tiêu chuẩn',
        porterName: latest.hostName ?? 'Ban tổ chức',
        weatherRiskLabel: 'Đang theo dõi',
      );

      return CamperOverviewSnapshot(
        notices: const [],
        upcomingTrip: upcomingTrip,
        preparationProgress: progress,
        preparationItems: items,
        weatherRisk: const WeatherRiskSnapshot(
          badgeLabel: '',
          rainChancePercent: 0,
          windSpeedKmh: 0,
          temperatureRangeLabel: '',
          visibilityKm: 0,
          note: '',
        ),
        recentTransactions: const [],
        suggestions: const [],
      );
    } catch (_) {
      return const CamperOverviewSnapshot(
        notices: [],
        upcomingTrip: null,
        preparationProgress: 0.0,
        preparationItems: [],
        weatherRisk: WeatherRiskSnapshot(
          badgeLabel: '',
          rainChancePercent: 0,
          windSpeedKmh: 0,
          temperatureRangeLabel: '',
          visibilityKm: 0,
          note: '',
        ),
        recentTransactions: [],
        suggestions: [],
      );
    }
  }
}

final camperOverviewRepositoryProvider = Provider<CamperOverviewRepository>((ref) {
  return CamperOverviewRepository(ref.watch(apiClientProvider));
});
