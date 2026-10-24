import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../application/device_sync_controller.dart';
import '../domain/device_sync_models.dart';

class DeviceSyncStatusScreen extends ConsumerStatefulWidget {
  const DeviceSyncStatusScreen({
    super.key,
    required this.tripId,
  });

  final String tripId;

  @override
  ConsumerState<DeviceSyncStatusScreen> createState() =>
      _DeviceSyncStatusScreenState();
}

class _DeviceSyncStatusScreenState
    extends ConsumerState<DeviceSyncStatusScreen> {
  bool _showAllLogs = false;

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

  (String, CtmsStatus) _badgeInfo(DeviceSyncState state) => switch (state) {
        DeviceSyncState.synced => ('Đã đồng bộ', CtmsStatus.success),
        DeviceSyncState.syncing => ('Đang đồng bộ...', CtmsStatus.info),
        DeviceSyncState.pending => ('Chờ đồng bộ', CtmsStatus.warning),
        DeviceSyncState.failed => ('Lỗi đồng bộ', CtmsStatus.danger),
        DeviceSyncState.idle => ('Sẵn sàng', CtmsStatus.neutral),
      };

  static const _sampleGpsBreadcrumbs = [
    (
      order: 15,
      coord: '11.5432° N, 108.4521° E',
      landmark: 'Đỉnh Đồi Lính',
      elevation: '1.240m',
      speed: '3.2 km/h',
      time: '14:30:00',
    ),
    (
      order: 14,
      coord: '11.5398° N, 108.4485° E',
      landmark: 'Rừng thông Tà Năng',
      elevation: '1.215m',
      speed: '3.8 km/h',
      time: '14:15:00',
    ),
    (
      order: 13,
      coord: '11.5350° N, 108.4420° E',
      landmark: 'Dốc Cổng Trời',
      elevation: '1.180m',
      speed: '4.1 km/h',
      time: '14:00:00',
    ),
    (
      order: 12,
      coord: '11.5312° N, 108.4380° E',
      landmark: 'Suối Yavly',
      elevation: '1.120m',
      speed: '2.9 km/h',
      time: '13:45:00',
    ),
    (
      order: 11,
      coord: '11.5280° N, 108.4335° E',
      landmark: 'Trạm kiểm lâm',
      elevation: '1.090m',
      speed: '3.5 km/h',
      time: '13:30:00',
    ),
    (
      order: 10,
      coord: '11.5245° N, 108.4290° E',
      landmark: 'Ngã ba Đa Quyn',
      elevation: '1.050m',
      speed: '4.0 km/h',
      time: '13:15:00',
    ),
    (
      order: 9,
      coord: '11.5210° N, 108.4245° E',
      landmark: 'Đồi cỏ cháy',
      elevation: '1.020m',
      speed: '3.6 km/h',
      time: '13:00:00',
    ),
    (
      order: 8,
      coord: '11.5175° N, 108.4200° E',
      landmark: 'Điểm cắm trại C1',
      elevation: '990m',
      speed: '1.5 km/h',
      time: '12:45:00',
    ),
    (
      order: 7,
      coord: '11.5140° N, 108.4155° E',
      landmark: 'Rừng trúc lùn',
      elevation: '960m',
      speed: '3.2 km/h',
      time: '12:30:00',
    ),
    (
      order: 6,
      coord: '11.5105° N, 108.4110° E',
      landmark: 'Khe suối cạn',
      elevation: '930m',
      speed: '2.8 km/h',
      time: '12:15:00',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(deviceSyncControllerProvider(widget.tripId));
    final summary = controller.summary;
    final (badgeLabel, badgeStatus) = _badgeInfo(summary.state);

    final displayedGps = _showAllLogs
        ? _sampleGpsBreadcrumbs
        : _sampleGpsBreadcrumbs.take(5).toList();

    return CtmsScaffold(
      title: 'Đồng bộ thiết bị',
      subtitle: 'Chi tiết truyền dữ liệu GPS & an toàn ngoại tuyến',
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh, color: Colors.black),
          tooltip: 'Tải lại',
          onPressed: controller.loading ? null : () => controller.refresh(),
        ),
      ],
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.lg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Section Title: Trạng thái truyền dữ liệu (Protected from overflow)
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Trạng thái truyền dữ liệu',
                    style: AppTypography.h3.copyWith(
                      fontWeight: FontWeight.w800,
                      color: Colors.black,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                CtmsStatusBadge(
                  label: badgeLabel,
                  status: badgeStatus,
                  showDot: true,
                ),
              ],
            ),

            const SizedBox(height: AppSpacing.md),

            // Error banner when error exists (PB AC-4)
            if (summary.lastError != null) ...[
              CtmsAlertBanner(
                severity: CtmsAlertSeverity.warning,
                title: 'Lỗi đồng bộ gần nhất',
                message: summary.lastError!,
                icon: Icons.sync_problem_outlined,
              ),
              const SizedBox(height: AppSpacing.md),
            ],

            // Card 1: Bản ghi GPS (Breadcrumbs) (PB AC-1, PB AC-6, BR-226)
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
                  // Header Row with Expanded Title (Prevents GHT overflowed)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.brandLight,
                          borderRadius: AppRadius.controlBorderRadius,
                        ),
                        child: const Icon(
                          Icons.location_on_outlined,
                          size: 18,
                          color: Colors.black,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Bản ghi GPS (Breadcrumbs)',
                          style: AppTypography.h3.copyWith(
                            color: Colors.black,
                            fontWeight: FontWeight.w800,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      const CtmsStatusBadge(
                        label: 'Đang hoạt động',
                        status: CtmsStatus.success,
                        showDot: true,
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Divider(height: 1, thickness: 1, color: AppColors.border),
                  const SizedBox(height: AppSpacing.md),

                  // Counter Stats
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              summary.pendingGpsCount.toString(),
                              style: AppTypography.display.copyWith(
                                color: summary.pendingGpsCount > 0
                                    ? AppColors.statusWarning
                                    : Colors.black,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Chờ đồng bộ tại thiết bị',
                              style: AppTypography.caption.copyWith(
                                color: Colors.black,
                                fontWeight: FontWeight.w700,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      Container(
                        width: 1,
                        height: 48,
                        color: AppColors.border,
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              summary.serverConfirmedGpsCount.toString(),
                              style: AppTypography.display.copyWith(
                                color: AppColors.statusSuccess,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Máy chủ đã xác nhận',
                              style: AppTypography.caption.copyWith(
                                color: Colors.black,
                                fontWeight: FontWeight.w700,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: AppSpacing.lg),

                  // GPS Breadcrumb Log stream Header (Protected with Expanded)
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Tọa độ GPS ghi nhận thực địa',
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
                            _showAllLogs = !_showAllLogs;
                          });
                        },
                        child: Text(
                          _showAllLogs ? 'Thu gọn' : 'Xem thêm',
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

                  ...displayedGps.map(
                    (log) => Container(
                      margin: const EdgeInsets.only(top: 8),
                      padding:
                          const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
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
                                  '${log.landmark} · ${log.elevation}',
                                  style: AppTypography.caption.copyWith(
                                    fontWeight: FontWeight.w800,
                                    color: Colors.black,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  '${log.coord} · Tốc độ: ${log.speed}',
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
                          Text(
                            log.time,
                            style: AppTypography.caption.copyWith(
                              color: Colors.black,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Card 2: Sự cố an toàn (PB AC-2, PB AC-6, BR-226)
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
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.brandLight,
                          borderRadius: AppRadius.controlBorderRadius,
                        ),
                        child: const Icon(
                          Icons.shield_outlined,
                          size: 18,
                          color: Colors.black,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Sự cố an toàn',
                          style: AppTypography.h3.copyWith(
                            color: Colors.black,
                            fontWeight: FontWeight.w800,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      const CtmsStatusBadge(
                        label: 'Đã báo cáo',
                        status: CtmsStatus.warning,
                        showDot: true,
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Divider(height: 1, thickness: 1, color: AppColors.border),
                  const SizedBox(height: AppSpacing.md),

                  // Counter Stats
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              summary.pendingSafetyCount.toString(),
                              style: AppTypography.display.copyWith(
                                color: summary.pendingSafetyCount > 0
                                    ? AppColors.statusWarning
                                    : Colors.black,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Chờ đồng bộ tại thiết bị',
                              style: AppTypography.caption.copyWith(
                                color: Colors.black,
                                fontWeight: FontWeight.w700,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      Container(
                        width: 1,
                        height: 48,
                        color: AppColors.border,
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              summary.serverConfirmedSafetyCount.toString(),
                              style: AppTypography.display.copyWith(
                                color: AppColors.statusSuccess,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Máy chủ đã xác nhận',
                              style: AppTypography.caption.copyWith(
                                color: Colors.black,
                                fontWeight: FontWeight.w700,
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
                  // Incident sample tile
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: AppRadius.controlBorderRadius,
                      border: Border.all(color: AppColors.border, width: 1.0),
                      boxShadow: AppColors.cardShadowSm,
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.warning_amber_rounded,
                          color: AppColors.statusWarning,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Trượt ngã nhẹ tại Dốc Cổng Trời',
                                style: AppTypography.bodyStrong.copyWith(
                                  color: Colors.black,
                                  fontWeight: FontWeight.w800,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                'Đã sơ cứu tại chỗ · Đã truyền telemetry lên điều phối viên',
                                style: AppTypography.caption.copyWith(
                                  color: Colors.black,
                                  fontWeight: FontWeight.w600,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),
                        const CtmsStatusBadge(
                          label: 'Đã giải quyết',
                          status: CtmsStatus.success,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Card 3: Thông tin hệ thống (PB AC-3)
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
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.brandLight,
                          borderRadius: AppRadius.controlBorderRadius,
                        ),
                        child: const Icon(
                          Icons.info_outline,
                          size: 18,
                          color: Colors.black,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Thông tin hệ thống',
                          style: AppTypography.h3.copyWith(
                            color: Colors.black,
                            fontWeight: FontWeight.w800,
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
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Lần đồng bộ gần nhất',
                          style: AppTypography.body.copyWith(
                            color: Colors.black,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Flexible(
                        child: Text(
                          _formatDateTime(summary.lastSyncAt),
                          style: AppTypography.bodyStrong.copyWith(
                            color: Colors.black,
                            fontWeight: FontWeight.w800,
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
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Gói an toàn / Cấu hình',
                          style: AppTypography.body.copyWith(
                            color: Colors.black,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Flexible(
                        child: Text(
                          summary.packageVersion != null
                              ? '${summary.packageVersion} · ${summary.configVersion}'
                              : summary.configVersion,
                          style: AppTypography.bodyStrong.copyWith(
                            color: Colors.black,
                            fontWeight: FontWeight.w800,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: AppSpacing.md),

            // Retry Action Button (PB AC-5)
            CtmsButton(
              label: 'Đồng bộ ngay',
              icon: Icons.sync,
              size: CtmsButtonSize.lg,
              isLoading: controller.retrying,
              onPressed:
                  summary.hasFailedOrPending ? () => controller.retry() : null,
            ),

            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }
}
