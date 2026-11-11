import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../../emergency_broadcasts/presentation/emergency_broadcasts_panel.dart';
import '../../gps_tracking/presentation/gps_tracking_panel.dart';
import '../../offline_map/presentation/offline_map_panel.dart';
import '../../offline_packages/presentation/offline_package_screen.dart';
import '../../route_deviation/presentation/route_deviation_panel.dart';
import '../../sync/application/device_sync_controller.dart';
import '../../sync/domain/device_sync_models.dart';
import '../../sync/presentation/device_sync_status_screen.dart';
import '../overview/domain/camper_overview_models.dart';
import '../../sos/presentation/sos_active_banner.dart';
import '../../schedule_progress/presentation/schedule_progress_panels.dart';
import '../../sos/presentation/trigger_sos_dialog.dart';
import '../../trip_weather/application/trip_weather_controller.dart';
import '../../trip_weather/presentation/trip_weather_panel.dart';
import '../../trip_weather/presentation/weather_reschedule_response_card.dart';
import '../../trip_reviews/domain/review_models.dart';
import '../../trip_reviews/presentation/trip_reviews_screen.dart';

class CamperTripDetailScreen extends ConsumerStatefulWidget {
  const CamperTripDetailScreen({
    super.key,
    this.tripId = 'a1736fee-62be-4991-9478-a62288e9b80a',
    this.trip,
    this.booking,
  });

  final String tripId;
  final UpcomingTrip? trip;
  final ReviewBooking? booking;

  @override
  ConsumerState<CamperTripDetailScreen> createState() =>
      _CamperTripDetailScreenState();
}

class _CamperTripDetailScreenState
    extends ConsumerState<CamperTripDetailScreen>
    with SingleTickerProviderStateMixin {
  static final _dateFormat = DateFormat('dd/MM/yyyy');
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _tabController.addListener(_onTabChanged);
  }

  void _onTabChanged() {
    if (!_tabController.indexIsChanging && _tabController.index == 2) {
      ref.read(deviceSyncControllerProvider(effectiveTripId)).refresh();
    }
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  String get effectiveTripId => widget.booking?.tripId ?? widget.tripId;

  (String, CtmsStatus) _syncBadgeInfo(DeviceSyncState state) => switch (state) {
    DeviceSyncState.synced => ('Đã đồng bộ', CtmsStatus.success),
    DeviceSyncState.syncing => ('Đang đồng bộ...', CtmsStatus.info),
    DeviceSyncState.pending => ('Chờ đồng bộ', CtmsStatus.warning),
    DeviceSyncState.failed => ('Lỗi đồng bộ', CtmsStatus.danger),
    DeviceSyncState.idle => ('Sẵn sàng', CtmsStatus.neutral),
  };

  String _formatDateTime(DateTime? dt) {
    if (dt == null) return 'Chưa có bản ghi đồng bộ';
    final local = dt.toLocal();
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    final year = local.year;
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '$day/$month/$year $hour:$minute';
  }

  Widget _buildInfoRow(String label, String value, {bool isHighlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppTypography.body.copyWith(
              color: Colors.black54,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: AppTypography.bodyStrong.copyWith(
                color: isHighlight ? AppColors.brandPrimary : Colors.black,
                fontWeight: isHighlight ? FontWeight.w800 : FontWeight.w600,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final syncController = ref.watch(
      deviceSyncControllerProvider(effectiveTripId),
    );
    final summary = syncController.summary;
    final (syncBadgeLabel, syncBadgeStatus) = _syncBadgeInfo(summary.state);

    final tripName = widget.booking?.title ?? widget.trip?.name ?? 'Trekking Tà Năng – Phan Dũng';
    final statusLabel = widget.booking != null
        ? switch (widget.booking!.status) {
            'completed' => 'Đã hoàn thành',
            'confirmed' => 'Đã xác nhận',
            'cancelled' => 'Đã hủy',
            'expired' => 'Đã hết hạn',
            'pending_payment' => 'Chờ thanh toán',
            'pending_reconfirmation' => 'Chờ xác nhận lại',
            _ => 'Chưa có trạng thái',
          }
        : (widget.trip?.statusLabel ?? 'Đã xác nhận');
    final startDateStr = widget.booking?.startsAt != null
        ? _dateFormat.format(widget.booking!.startsAt!.toLocal())
        : (widget.trip != null
            ? _dateFormat.format(widget.trip!.startDate)
            : '28/07/2026');
    final durationText = '${widget.trip?.durationDays ?? 3} ngày 2 đêm';
    final memberText = '${widget.booking?.numPeople ?? widget.trip?.memberCount ?? 8} người';
    final difficultyText = widget.trip?.difficulty ?? 'Trung bình';
    final porterText = widget.booking?.hostName ?? widget.trip?.porterName ?? 'Nguyễn Minh Sơn';
    // CTMS-62: real risk level of the forecast for the Trip's dates once it is loaded
    final weatherRiskText = tripWeatherHighlightValue(
      ref.watch(
        tripWeatherControllerProvider((
          tripId: effectiveTripId,
          bookingId: widget.booking?.id,
        )),
      ),
      widget.trip?.weatherRiskLabel ?? 'An toàn',
    );

    return CtmsScaffold(
        title: 'Chi tiết chuyến đi',
        subtitle: tripName,
        actions: [
          IconButton(
            icon: const Icon(Icons.sos_rounded, color: AppColors.statusDanger, size: 28),
            tooltip: 'Phát tín hiệu SOS khẩn cấp',
            onPressed: () {
              TriggerSosDialog.show(context, tripId: effectiveTripId);
            },
          ),
          IconButton(
            icon: const Icon(Icons.sync_outlined, color: Colors.black),
            tooltip: 'Trạng thái đồng bộ thiết bị',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => DeviceSyncStatusScreen(tripId: effectiveTripId),
                ),
              );
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: false,
          tabAlignment: TabAlignment.fill,
          tabs: const [
            Tab(text: 'Tổng quan', icon: Icon(Icons.info_outline_rounded, size: 20)),
            Tab(text: 'Lộ trình', icon: Icon(Icons.map_outlined, size: 20)),
            Tab(text: 'Đồng bộ', icon: Icon(Icons.sync_outlined, size: 20)),
            Tab(text: 'Đơn hàng', icon: Icon(Icons.receipt_long_outlined, size: 20)),
          ],
        ),
        body: TabBarView(
          controller: _tabController,
          children: [
            // TAB 1: TỔNG QUAN
            ListView(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.lg,
              ),
              children: [
                SosActiveBanner(tripId: effectiveTripId),
                OfflinePackagePanel(
                  tripId: effectiveTripId,
                  tripTitle: widget.booking?.title ?? widget.trip?.name,
                ),
                const SizedBox(height: AppSpacing.lg),
                // Emergency alerts broadcast by the Host (CTMS-081); empty until one arrives
                EmergencyBroadcastsPanel(tripId: effectiveTripId),
                // Weather for the Trip's own dates (CTMS-62): reschedule answer, then the forecast
                WeatherRescheduleResponseCard(
                  tripId: effectiveTripId,
                  bookingId: widget.booking?.id,
                ),
                TripWeatherPanel(
                  tripId: effectiveTripId,
                  bookingId: widget.booking?.id,
                ),
                // Trip Header Card
                Container(
                  margin: const EdgeInsets.only(bottom: AppSpacing.lg),
                  padding: const EdgeInsets.all(AppSpacing.cardPadding),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: AppRadius.cardBorderRadius,
                    border: Border.all(color: AppColors.border, width: 1.0),
                    boxShadow: AppColors.cardShadowSm,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              tripName,
                              style: AppTypography.h2.copyWith(
                                fontWeight: FontWeight.w800,
                                color: Colors.black,
                              ),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          CtmsStatusBadge(
                            label: statusLabel,
                            status: statusLabel == 'Đã hoàn thành' || statusLabel == 'Đã xác nhận'
                                ? CtmsStatus.success
                                : statusLabel == 'Chờ thanh toán'
                                ? CtmsStatus.warning
                                : CtmsStatus.neutral,
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(
                            Icons.location_on_outlined,
                            size: 14,
                            color: Colors.black,
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              'Lâm Đồng – Bình Thuận',
                              style: AppTypography.body.copyWith(
                                color: Colors.black,
                                fontWeight: FontWeight.w600,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(
                            Icons.calendar_today_outlined,
                            size: 14,
                            color: Colors.black,
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              'Khởi hành: $startDateStr · Thời lượng: $durationText',
                              style: AppTypography.caption.copyWith(
                                color: Colors.black,
                                fontWeight: FontWeight.w500,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(
                            Icons.person_pin_circle_outlined,
                            size: 14,
                            color: Colors.black,
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              'Porter dẫn đoàn: $porterText · Quy mô: $memberText',
                              style: AppTypography.caption.copyWith(
                                color: Colors.black,
                                fontWeight: FontWeight.w500,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const Divider(height: 1, thickness: 1, color: AppColors.border),
                      const SizedBox(height: AppSpacing.md),
                      // 2x2 Clean Feature Highlights
                      Row(
                        children: [
                          Expanded(
                            child: _FeatureHighlightBox(
                              icon: Icons.terrain_outlined,
                              label: 'ĐỘ KHÓ',
                              value: difficultyText,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: _FeatureHighlightBox(
                              icon: Icons.wb_sunny_outlined,
                              label: 'THỜI TIẾT',
                              value: weatherRiskText,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Row(
                        children: [
                          Expanded(
                            child: _FeatureHighlightBox(
                              icon: Icons.group_outlined,
                              label: 'THÀNH VIÊN',
                              value: memberText,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: _FeatureHighlightBox(
                              icon: Icons.verified_user_outlined,
                              label: 'BẢO HIỂM',
                              value: 'Đã kích hoạt',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Safety and Emergency assistance
                Text(
                  'Hỗ trợ an toàn & Khẩn cấp',
                  style: AppTypography.h3.copyWith(
                    color: Colors.black,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                Container(
                  margin: const EdgeInsets.only(bottom: AppSpacing.md),
                  padding: const EdgeInsets.all(AppSpacing.cardPadding),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: AppRadius.cardBorderRadius,
                    border: Border.all(color: AppColors.statusDanger.withValues(alpha: 0.3)),
                    boxShadow: AppColors.cardShadowSm,
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.statusDangerBg,
                          borderRadius: AppRadius.controlBorderRadius,
                        ),
                        child: const Icon(
                          Icons.sos_rounded,
                          color: AppColors.statusDanger,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Cứu hộ khẩn cấp SOS',
                              style: AppTypography.bodyStrong.copyWith(
                                color: AppColors.statusDanger,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              'Hoạt động ngay cả khi ngoại tuyến/mất mạng',
                              style: AppTypography.caption.copyWith(
                                color: Colors.black54,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      CtmsButton(
                        label: 'Phát SOS',
                        variant: CtmsButtonVariant.danger,
                        onPressed: () {
                          TriggerSosDialog.show(context, tripId: effectiveTripId);
                        },
                      ),
                    ],
                  ),
                ),

                Container(
                  margin: const EdgeInsets.only(bottom: AppSpacing.xxl),
                  padding: const EdgeInsets.all(AppSpacing.cardPadding),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: AppRadius.cardBorderRadius,
                    border: Border.all(color: AppColors.border, width: 1.0),
                    boxShadow: AppColors.cardShadowSm,
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.brandLight,
                              borderRadius: AppRadius.controlBorderRadius,
                            ),
                            child: const Icon(
                              Icons.support_agent_outlined,
                              color: Colors.black,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Đội ngũ điều phối viên CTMS',
                                  style: AppTypography.bodyStrong.copyWith(
                                    color: Colors.black,
                                    fontWeight: FontWeight.w800,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Trực giám sát telemetry và GPS cứu hộ 24/7',
                                  style: AppTypography.caption.copyWith(
                                    color: Colors.black,
                                    fontWeight: FontWeight.w500,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const Divider(height: 1, thickness: 1, color: AppColors.border),
                      const SizedBox(height: AppSpacing.md),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.statusDangerBg,
                              borderRadius: AppRadius.controlBorderRadius,
                            ),
                            child: const Icon(
                              Icons.phone_in_talk_outlined,
                              color: AppColors.statusDanger,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Đường dây nóng cứu hộ',
                                  style: AppTypography.bodyStrong.copyWith(
                                    color: Colors.black,
                                    fontWeight: FontWeight.w800,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '1900 6868 (Hỗ trợ khẩn cấp vệ tinh/offline)',
                                  style: AppTypography.caption.copyWith(
                                    color: Colors.black,
                                    fontWeight: FontWeight.w500,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // TAB 2: LỘ TRÌNH & GPS
            ListView(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.lg,
              ),
              children: [
                OfflineMapPanel(
                  tripId: effectiveTripId,
                  tripTitle: widget.booking?.title ?? widget.trip?.name,
                  integrateArrivals: true,
                ),
                const SizedBox(height: AppSpacing.lg),
                GpsTrackingPanel(tripId: effectiveTripId),
                const SizedBox(height: AppSpacing.lg),
                RouteDeviationPanel(tripId: effectiveTripId),
                const SizedBox(height: AppSpacing.lg),
                CamperScheduleProgressPanel(tripId: effectiveTripId),
              ],
            ),

            // TAB 3: ĐỒNG BỘ NGOẠI TUYẾN
            ListView(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.lg,
              ),
              children: [
                Text(
                  'Nhật ký GPS & Đồng bộ ngoại tuyến (CTMS-067 & CTMS-064)',
                  style: AppTypography.h3.copyWith(
                    color: Colors.black,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                Container(
                  margin: const EdgeInsets.only(bottom: AppSpacing.lg),
                  padding: const EdgeInsets.all(AppSpacing.cardPadding),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: AppRadius.cardBorderRadius,
                    border: Border.all(color: AppColors.border, width: 1.0),
                    boxShadow: AppColors.cardShadowSm,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Card header row
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.brandLight,
                              borderRadius: AppRadius.controlBorderRadius,
                            ),
                            child: const Icon(
                              Icons.satellite_alt_rounded,
                              size: 20,
                              color: Colors.black,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Trạng thái truyền telemetry',
                                  style: AppTypography.bodyStrong.copyWith(
                                    color: Colors.black,
                                    fontWeight: FontWeight.w800,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Gói bản đồ: ${summary.packageVersion ?? "pkg-v2"} · Cấu hình: ${summary.configVersion}',
                                  style: AppTypography.caption.copyWith(
                                    color: Colors.black,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          CtmsStatusBadge(
                            label: syncBadgeLabel,
                            status: syncBadgeStatus,
                            showDot: true,
                          ),
                        ],
                      ),

                      if (summary.lastError != null) ...[
                        const SizedBox(height: AppSpacing.md),
                        CtmsAlertBanner(
                          severity: CtmsAlertSeverity.warning,
                          title: 'Lỗi đồng bộ',
                          message: summary.lastError!,
                          icon: Icons.sync_problem_outlined,
                        ),
                      ],

                      const SizedBox(height: AppSpacing.md),
                      const Divider(height: 1, thickness: 1, color: AppColors.border),
                      const SizedBox(height: AppSpacing.md),

                      // Metrics counter boxes
                      Row(
                        children: [
                          Expanded(
                            child: _TelemetryMetricCard(
                              icon: Icons.location_on_outlined,
                              title: 'Tọa độ GPS',
                              confirmedCount: summary.serverConfirmedGpsCount,
                              pendingCount: summary.pendingGpsCount,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: _TelemetryMetricCard(
                              icon: Icons.shield_outlined,
                              title: 'Sự cố an toàn',
                              confirmedCount: summary.serverConfirmedSafetyCount,
                              pendingCount: summary.pendingSafetyCount,
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: AppSpacing.md),
                      const Divider(height: 1, thickness: 1, color: AppColors.border),
                      const SizedBox(height: AppSpacing.sm),

                      Row(
                        children: [
                          const Icon(
                            Icons.cloud_done_outlined,
                            size: 14,
                            color: Colors.black,
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'Lần gửi thành công gần nhất: ${_formatDateTime(summary.lastSyncAt)}',
                              style: AppTypography.caption.copyWith(
                                color: Colors.black,
                                fontWeight: FontWeight.w600,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: AppSpacing.lg),

                      CtmsButton(
                        label: 'Đồng bộ ngay',
                        icon: Icons.sync,
                        isLoading: syncController.retrying,
                        onPressed: summary.hasFailedOrPending
                            ? () => syncController.retry()
                            : () => syncController.refresh(),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      CtmsButton(
                        label: 'Xem chi tiết thiết bị & cài đặt đồng bộ',
                        icon: Icons.tune_outlined,
                        variant: CtmsButtonVariant.secondary,
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) =>
                                  DeviceSyncStatusScreen(tripId: effectiveTripId),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // TAB 4: ĐƠN HÀNG & ĐÁNH GIÁ
            ListView(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.lg,
              ),
              children: [
                Container(
                  margin: const EdgeInsets.only(bottom: AppSpacing.lg),
                  padding: const EdgeInsets.all(AppSpacing.cardPadding),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: AppRadius.cardBorderRadius,
                    border: Border.all(color: AppColors.border, width: 1.0),
                    boxShadow: AppColors.cardShadowSm,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Thông tin đơn đặt chỗ',
                            style: AppTypography.h3.copyWith(
                              color: Colors.black,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          CtmsStatusBadge(
                            label: statusLabel,
                            status: statusLabel == 'Đã hoàn thành' || statusLabel == 'Đã xác nhận'
                                ? CtmsStatus.success
                                : statusLabel == 'Chờ thanh toán'
                                ? CtmsStatus.warning
                                : CtmsStatus.neutral,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const Divider(height: 1, thickness: 1, color: AppColors.border),
                      const SizedBox(height: AppSpacing.md),
                      _buildInfoRow('Mã đơn:', widget.booking?.id ?? 'Chưa xác định'),
                      _buildInfoRow('Mã chuyến đi:', effectiveTripId),
                      _buildInfoRow('Số lượng khách:', memberText),
                      _buildInfoRow(
                        'Thanh toán:',
                        switch (widget.booking?.paymentStatus) {
                          'completed' => 'Đã thanh toán',
                          'pending' => 'Chờ thanh toán',
                          'refunded' => 'Đã hoàn tiền',
                          'not_required' => 'Không yêu cầu',
                          _ => 'Đã xác nhận',
                        },
                      ),
                      if (widget.booking?.totalAmount != null)
                        _buildInfoRow(
                          'Tổng tiền:',
                          '${NumberFormat('#,###', 'vi_VN').format(double.tryParse(widget.booking!.totalAmount!) ?? 0)} đ',
                          isHighlight: true,
                        ),
                      _buildInfoRow(
                        'Thời gian đặt:',
                        widget.booking != null
                            ? DateFormat('dd/MM/yyyy HH:mm').format(widget.booking!.createdAt.toLocal())
                            : '28/07/2026',
                      ),
                    ],
                  ),
                ),

                if (widget.booking != null && widget.booking!.status == 'completed') ...[
                  Container(
                    margin: const EdgeInsets.only(bottom: AppSpacing.lg),
                    padding: const EdgeInsets.all(AppSpacing.cardPadding),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: AppRadius.cardBorderRadius,
                      border: Border.all(color: AppColors.border, width: 1.0),
                      boxShadow: AppColors.cardShadowSm,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Đánh giá chuyến đi',
                          style: AppTypography.h3.copyWith(
                            color: Colors.black,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Chia sẻ cảm nhận và phản hồi của bạn để nâng cao chất lượng dịch vụ.',
                          style: AppTypography.caption.copyWith(color: Colors.black54),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        CtmsButton(
                          label: 'Đánh giá chuyến đi & Người dẫn đoàn',
                          icon: Icons.star_outline_rounded,
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                builder: (_) => TripReviewsScreen(booking: widget.booking!),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      );
  }
}

class _FeatureHighlightBox extends StatelessWidget {
  const _FeatureHighlightBox({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.controlBorderRadius,
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: Colors.black),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: AppTypography.label.copyWith(
                    color: Colors.black,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  value,
                  style: AppTypography.bodyStrong.copyWith(
                    color: Colors.black,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TelemetryMetricCard extends StatelessWidget {
  const _TelemetryMetricCard({
    required this.icon,
    required this.title,
    required this.confirmedCount,
    required this.pendingCount,
  });

  final IconData icon;
  final String title;
  final int confirmedCount;
  final int pendingCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.controlBorderRadius,
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: Colors.black),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  title,
                  style: AppTypography.caption.copyWith(
                    fontWeight: FontWeight.w800,
                    color: Colors.black,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    confirmedCount.toString(),
                    style: AppTypography.h2.copyWith(
                      color: AppColors.statusSuccess,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    'Đã nhận',
                    style: AppTypography.label.copyWith(
                      color: Colors.black,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    pendingCount.toString(),
                    style: AppTypography.h2.copyWith(
                      color: pendingCount > 0
                          ? AppColors.statusWarning
                          : Colors.black,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    'Chờ gửi',
                    style: AppTypography.label.copyWith(
                      color: Colors.black,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
