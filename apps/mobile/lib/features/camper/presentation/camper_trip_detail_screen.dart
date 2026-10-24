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
import '../../sync/application/device_sync_controller.dart';
import '../../sync/domain/device_sync_models.dart';
import '../../sync/presentation/device_sync_status_screen.dart';
import '../overview/domain/camper_overview_models.dart';

class CamperTripDetailScreen extends ConsumerStatefulWidget {
  const CamperTripDetailScreen({
    super.key,
    this.tripId = 'a1736fee-62be-4991-9478-a62288e9b80a',
    this.trip,
  });

  final String tripId;
  final UpcomingTrip? trip;

  @override
  ConsumerState<CamperTripDetailScreen> createState() =>
      _CamperTripDetailScreenState();
}

class _CamperTripDetailScreenState
    extends ConsumerState<CamperTripDetailScreen> {
  static final _dateFormat = DateFormat('dd/MM/yyyy');
  bool _showAllGpsLogs = false;

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

  static const _sampleGpsLogs = [
    (
      order: 15,
      coord: '11.5432° N, 108.4521° E',
      landmark: 'Đỉnh Đồi Lính',
      elevation: '1.240m',
      time: '14:30:00',
      synced: true
    ),
    (
      order: 14,
      coord: '11.5398° N, 108.4485° E',
      landmark: 'Rừng thông Tà Năng',
      elevation: '1.215m',
      time: '14:15:00',
      synced: true
    ),
    (
      order: 13,
      coord: '11.5350° N, 108.4420° E',
      landmark: 'Dốc Cổng Trời',
      elevation: '1.180m',
      time: '14:00:00',
      synced: true
    ),
    (
      order: 12,
      coord: '11.5312° N, 108.4380° E',
      landmark: 'Suối Yavly',
      elevation: '1.120m',
      time: '13:45:00',
      synced: true
    ),
    (
      order: 11,
      coord: '11.5280° N, 108.4335° E',
      landmark: 'Trạm kiểm lâm',
      elevation: '1.090m',
      time: '13:30:00',
      synced: true
    ),
    (
      order: 10,
      coord: '11.5245° N, 108.4290° E',
      landmark: 'Ngã ba Đa Quyn',
      elevation: '1.050m',
      time: '13:15:00',
      synced: true
    ),
    (
      order: 9,
      coord: '11.5210° N, 108.4245° E',
      landmark: 'Đồi cỏ cháy',
      elevation: '1.020m',
      time: '13:00:00',
      synced: true
    ),
    (
      order: 8,
      coord: '11.5175° N, 108.4200° E',
      landmark: 'Điểm cắm trại C1',
      elevation: '990m',
      time: '12:45:00',
      synced: true
    ),
    (
      order: 7,
      coord: '11.5140° N, 108.4155° E',
      landmark: 'Rừng trúc lùn',
      elevation: '960m',
      time: '12:30:00',
      synced: true
    ),
    (
      order: 6,
      coord: '11.5105° N, 108.4110° E',
      landmark: 'Khe suối cạn',
      elevation: '930m',
      time: '12:15:00',
      synced: true
    ),
    (
      order: 5,
      coord: '11.5070° N, 108.4065° E',
      landmark: 'Cột mốc Lâm Đồng',
      elevation: '900m',
      time: '12:00:00',
      synced: true
    ),
    (
      order: 4,
      coord: '11.5035° N, 108.4020° E',
      landmark: 'Bãi hạ trại trưa',
      elevation: '880m',
      time: '11:45:00',
      synced: true
    ),
    (
      order: 3,
      coord: '11.5000° N, 108.3975° E',
      landmark: 'Lối mòn sườn đông',
      elevation: '850m',
      time: '11:30:00',
      synced: true
    ),
    (
      order: 2,
      coord: '11.4965° N, 108.3930° E',
      landmark: 'Cửa rừng Tà Năng',
      elevation: '820m',
      time: '11:15:00',
      synced: true
    ),
    (
      order: 1,
      coord: '11.4930° N, 108.3885° E',
      landmark: 'Điểm xuất phát (Basecamp)',
      elevation: '800m',
      time: '11:00:00',
      synced: true
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final syncController =
        ref.watch(deviceSyncControllerProvider(widget.tripId));
    final summary = syncController.summary;
    final (syncBadgeLabel, syncBadgeStatus) = _syncBadgeInfo(summary.state);

    final tripName = widget.trip?.name ?? 'Trekking Tà Năng – Phan Dũng';
    final statusLabel = widget.trip?.statusLabel ?? 'Đã xác nhận';
    final startDateStr = widget.trip != null
        ? _dateFormat.format(widget.trip!.startDate)
        : '28/07/2026';
    final durationText = '${widget.trip?.durationDays ?? 3} ngày 2 đêm';
    final memberText = '${widget.trip?.memberCount ?? 8} người';
    final difficultyText = widget.trip?.difficulty ?? 'Trung bình';
    final porterText = widget.trip?.porterName ?? 'Nguyễn Minh Sơn';
    final weatherRiskText = widget.trip?.weatherRiskLabel ?? 'An toàn';

    final displayedLogs =
        _showAllGpsLogs ? _sampleGpsLogs : _sampleGpsLogs.take(5).toList();

    return CtmsScaffold(
      title: 'Chi tiết chuyến đi',
      subtitle: tripName,
      actions: [
        IconButton(
          icon: const Icon(Icons.sync_outlined, color: Colors.black),
          tooltip: 'Trạng thái đồng bộ thiết bị',
          onPressed: () {
            Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) =>
                    DeviceSyncStatusScreen(tripId: widget.tripId),
              ),
            );
          },
        ),
      ],
      body: ListView(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.lg,
        ),
        children: [
          // 1. Trip Header Card (Designed identically to _ExploreTripCard)
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
                      status: CtmsStatus.success,
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

          // 2. Section: Nhật ký GPS & Đồng bộ ngoại tuyến (CTMS-067)
          Text(
            'Nhật ký GPS & Đồng bộ ngoại tuyến (CTMS-067)',
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

                // Metrics counter boxes (Pure white blocks with soft border)
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

                const SizedBox(height: AppSpacing.lg),

                // GPS Logs Stream / Breadcrumbs List Header (Protected from overflow)
                Row(
                  children: [
                    const Icon(
                      Icons.route_outlined,
                      size: 16,
                      color: Colors.black,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Lịch sử tọa độ GPS (${summary.serverConfirmedGpsCount > 0 ? summary.serverConfirmedGpsCount : _sampleGpsLogs.length} điểm)',
                        style: AppTypography.caption.copyWith(
                          fontWeight: FontWeight.w800,
                          color: Colors.black,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    GestureDetector(
                      onTap: () {
                        setState(() {
                          _showAllGpsLogs = !_showAllGpsLogs;
                        });
                      },
                      child: Text(
                        _showAllGpsLogs ? 'Thu gọn' : 'Xem tất cả',
                        style: AppTypography.caption.copyWith(
                          color: Colors.black,
                          fontWeight: FontWeight.w800,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: AppSpacing.sm),

                // GPS Log items
                ...displayedLogs.map((log) => _GpsBreadcrumbTile(log: log)),

                const SizedBox(height: AppSpacing.md),
                const Divider(height: 1, thickness: 1, color: AppColors.border),
                const SizedBox(height: AppSpacing.sm),

                // Sync timestamp (Protected with Expanded)
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

                // Actions
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
                            DeviceSyncStatusScreen(tripId: widget.tripId),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),

          // 3. Section: Hỗ trợ an toàn & Khẩn cấp
          Text(
            'Hỗ trợ an toàn & Khẩn cấp',
            style: AppTypography.h3.copyWith(
              color: Colors.black,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: AppSpacing.md),

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

class _GpsBreadcrumbTile extends StatelessWidget {
  const _GpsBreadcrumbTile({required this.log});

  final ({
    int order,
    String coord,
    String landmark,
    String elevation,
    String time,
    bool synced,
  }) log;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.controlBorderRadius,
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.brandLight,
              borderRadius: AppRadius.pillBorderRadius,
            ),
            child: Text(
              '#${log.order}',
              style: const TextStyle(
                color: Colors.black,
                fontSize: 10,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${log.landmark} (${log.elevation})',
                  style: AppTypography.caption.copyWith(
                    fontWeight: FontWeight.w800,
                    color: Colors.black,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '${log.coord} · ${log.time}',
                  style: AppTypography.caption.copyWith(
                    color: Colors.black,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          const CtmsStatusBadge(
            label: 'Đã nhận',
            status: CtmsStatus.success,
          ),
        ],
      ),
    );
  }
}
