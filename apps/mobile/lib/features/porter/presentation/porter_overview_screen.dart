import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/domain/auth_user.dart';

const _weekdayNames = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật',
];

class PorterOverviewScreen extends ConsumerWidget {
  const PorterOverviewScreen({super.key});

  String _dateLabel(DateTime now) {
    final weekday = _weekdayNames[now.weekday - 1];
    final day = now.day.toString().padLeft(2, '0');
    final month = now.month.toString().padLeft(2, '0');
    return '$weekday, $day/$month/${now.year}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).valueOrNull;
    final displayName = user?.displayName ?? 'Porter';

    return CtmsScaffold(
      title: 'Tổng quan',
      subtitle: 'Bảng điều phối ca trekking & giám sát an toàn',
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        children: [
          // 1. Shift Header Card (Styled exactly like PorterScheduleScreen's _ShiftCard)
          _PorterShiftCard(
            dateLabel: _dateLabel(DateTime.now()),
            displayName: displayName,
            onSchedule: () => context.go('/porter/schedule'),
            onReport: () => context.push('/porter/incidents'),
          ),
          const SizedBox(height: AppSpacing.lg),

          // 2. Metrics Grid (Column of Rows for reliable hit-testing & zero pointer absorption)
          const _MetricGrid(),
          const SizedBox(height: AppSpacing.lg),

          // 3. Current Route Section Card (Refined to Schedule Card style)
          _CurrentRouteCard(onOpenMap: () => context.go('/porter/map')),
          const SizedBox(height: AppSpacing.lg),

          // 4. Shift Schedule Section Card (Refined to Schedule Card style)
          _ScheduleCard(onOpenSchedule: () => context.go('/porter/schedule')),
          const SizedBox(height: AppSpacing.lg),

          // 5. Active Alerts Section Card (Refined to Schedule Card style)
          _AlertCard(onOpenAlerts: () => context.go('/porter/alerts')),
          const SizedBox(height: AppSpacing.lg),

          // 6. Quick Actions Section Card (Refined to Schedule Card style)
          _QuickActions(
            onMap: () => context.go('/porter/map'),
            onTeam: () => context.push('/porter/team'),
            onSettings: () => context.push('/porter/settings'),
          ),
        ],
      ),
    );
  }
}

class _PorterShiftCard extends StatelessWidget {
  const _PorterShiftCard({
    required this.dateLabel,
    required this.displayName,
    required this.onSchedule,
    required this.onReport,
  });

  final String dateLabel;
  final String displayName;
  final VoidCallback onSchedule;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) {
    return Container(
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
                  'Điều phối viên: $displayName',
                  style: AppTypography.h3.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              const CtmsStatusBadge(
                label: 'Đang trực ca',
                status: CtmsStatus.success,
                showDot: true,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.schedule_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  '$dateLabel • 06:30 – 16:30',
                  style: AppTypography.body.copyWith(
                    color: AppColors.textSecondary,
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
              const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'Điểm tập kết: Trạm Kiểm lâm Cổng Bắc • Tuyến Sơn Trà – Bãi Bắc',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.groups_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'Đoàn 24 khách • 4 porter phụ trách',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
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
                child: CtmsButton(
                  label: 'Lịch ca',
                  icon: Icons.event_note_outlined,
                  variant: CtmsButtonVariant.primary,
                  onPressed: onSchedule,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: CtmsButton(
                  label: 'Báo cáo',
                  icon: Icons.report_outlined,
                  variant: CtmsButtonVariant.secondary,
                  onPressed: onReport,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid();

  @override
  Widget build(BuildContext context) {
    const metrics = [
      _MetricData('CA HÔM NAY', '03', 'Sơn Trà, Bãi Bắc', Icons.hiking_rounded),
      _MetricData('ĐOÀN PHỤ TRÁCH', '24', '2 khách cần hỗ trợ', Icons.groups_rounded),
      _MetricData('CẢNH BÁO', '02', '1 cảnh báo thời tiết', Icons.warning_amber_rounded),
      _MetricData('SỰ CỐ MỞ', '01', 'Đang theo dõi', Icons.report_problem_rounded),
    ];

    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _MetricCard(metric: metrics[0])),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: _MetricCard(metric: metrics[1])),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          children: [
            Expanded(child: _MetricCard(metric: metrics[2])),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: _MetricCard(metric: metrics[3])),
          ],
        ),
      ],
    );
  }
}

class _MetricData {
  const _MetricData(this.label, this.value, this.helper, this.icon);

  final String label;
  final String value;
  final String helper;
  final IconData icon;
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.metric});

  final _MetricData metric;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.border, width: 1.0),
        borderRadius: AppRadius.cardBorderRadius,
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  metric.label,
                  style: AppTypography.label.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Icon(metric.icon, color: AppColors.textPrimary, size: 18),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            metric.value,
            style: AppTypography.display.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            metric.helper,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

/// 1. Tuyến đang vận hành (Đồng bộ chuẩn giao diện thẻ _ShiftCard của trang Schedule)
class _CurrentRouteCard extends StatelessWidget {
  const _CurrentRouteCard({required this.onOpenMap});

  final VoidCallback onOpenMap;

  @override
  Widget build(BuildContext context) {
    return CtmsSectionCard(
      title: 'Tuyến đang vận hành',
      trailing: const CtmsStatusBadge(
        label: 'Đang mở',
        status: CtmsStatus.success,
        showDot: true,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Trekking Sơn Trà – Bãi Bắc',
            style: AppTypography.bodyStrong.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.schedule_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'Khởi hành: 06:30 • Dự kiến đến (ETA): 16:20',
                  style: AppTypography.body.copyWith(
                    color: AppColors.textSecondary,
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
              const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'Điểm tập kết: Trạm Kiểm lâm Cổng Bắc • Checkpoint 2/5 (Bãi Bắc)',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.groups_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'Đoàn 24 khách • Điểm danh: 22/24 • 4 porter phụ trách',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.wb_sunny_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'Thời tiết: 28°C • Nắng nhẹ, gió 12km/h, an toàn di chuyển',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: Alignment.centerRight,
            child: CtmsButton(
              label: 'Mở GPS & Bản đồ tuyến',
              icon: Icons.map_outlined,
              variant: CtmsButtonVariant.secondary,
              onPressed: onOpenMap,
            ),
          ),
        ],
      ),
    );
  }
}

/// 2. Lịch vận hành (Đồng bộ chuẩn giao diện thẻ _ShiftCard của trang Schedule)
class _ScheduleCard extends StatelessWidget {
  const _ScheduleCard({required this.onOpenSchedule});

  final VoidCallback onOpenSchedule;

  @override
  Widget build(BuildContext context) {
    return CtmsSectionCard(
      title: 'Lịch vận hành',
      trailing: IconButton(
        tooltip: 'Mở lịch',
        onPressed: onOpenSchedule,
        icon: const Icon(Icons.calendar_month_outlined, color: AppColors.textPrimary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.today_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'Hôm nay • 3 mốc vận hành chính của ca trực',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          const _ScheduleTimelineRow(
            time: '06:30',
            title: 'Điểm danh tại cổng Bắc (22/24 camper đã có mặt)',
            status: 'Hoàn thành',
            isDone: true,
          ),
          const SizedBox(height: 6),
          const _ScheduleTimelineRow(
            time: '08:10',
            title: 'Dẫn đoàn qua tuyến rừng nguyên sinh',
            status: 'Đang diễn ra',
            isOngoing: true,
          ),
          const SizedBox(height: 6),
          const _ScheduleTimelineRow(
            time: '12:00',
            title: 'Nghỉ trưa & nạp năng lượng tại trạm Bãi Bắc',
            status: 'Tiếp theo',
          ),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: Alignment.centerRight,
            child: CtmsButton(
              label: 'Xem chi tiết lịch ca',
              icon: Icons.event_note_outlined,
              variant: CtmsButtonVariant.secondary,
              onPressed: onOpenSchedule,
            ),
          ),
        ],
      ),
    );
  }
}

class _ScheduleTimelineRow extends StatelessWidget {
  const _ScheduleTimelineRow({
    required this.time,
    required this.title,
    required this.status,
    this.isDone = false,
    this.isOngoing = false,
  });

  final String time;
  final String title;
  final String status;
  final bool isDone;
  final bool isOngoing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(Icons.schedule_outlined, size: 14, color: AppColors.textSecondary),
        const SizedBox(width: 4),
        Text(
          time,
          style: AppTypography.caption.copyWith(
            color: isOngoing ? AppColors.brandPrimary : AppColors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            title,
            style: AppTypography.caption.copyWith(
              color: AppColors.textSecondary,
              fontWeight: isOngoing ? FontWeight.w600 : FontWeight.w400,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: 4),
        CtmsStatusBadge(
          label: status,
          status: isDone
              ? CtmsStatus.success
              : isOngoing
                  ? CtmsStatus.info
                  : CtmsStatus.neutral,
        ),
      ],
    );
  }
}

/// 3. Cảnh báo cần xử lý (Đồng bộ chuẩn giao diện thẻ _ShiftCard của trang Schedule)
class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.onOpenAlerts});

  final VoidCallback onOpenAlerts;

  @override
  Widget build(BuildContext context) {
    return CtmsSectionCard(
      title: 'Cảnh báo cần xử lý',
      trailing: CtmsButton(
        label: 'Xem tất cả',
        variant: CtmsButtonVariant.secondary,
        onPressed: onOpenAlerts,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Alert Item 1: Weather
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  'Cảnh báo thời tiết: Mưa nhẹ sau 15:00',
                  style: AppTypography.bodyStrong.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              const CtmsStatusBadge(
                label: 'Thời tiết',
                status: CtmsStatus.warning,
                showDot: true,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.schedule_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'Thời gian: 15:00 – 16:30 hôm nay',
                  style: AppTypography.body.copyWith(
                    color: AppColors.textSecondary,
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
              const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'Khu vực ảnh hưởng: Tuyến rừng Bãi Bắc & đỉnh Bàn Cờ',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.cloudy_snowing, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'Chuẩn bị áo mưa và nhắc đoàn giữ nhịp độ di chuyển an toàn',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),

          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.md),

          // Alert Item 2: Camper Health
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  'Cảnh báo sức khỏe: 1 camper cần hỗ trợ y tế',
                  style: AppTypography.bodyStrong.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              const CtmsStatusBadge(
                label: 'Y tế đoàn',
                status: CtmsStatus.danger,
                showDot: true,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.schedule_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'Ghi nhận: 08:30 sáng nay tại Checkpoint 2',
                  style: AppTypography.body.copyWith(
                    color: AppColors.textSecondary,
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
              const Icon(Icons.health_and_safety_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'Khách Nguyễn Văn A (Lều 04) - Cần bổ sung điện giải & theo dõi huyết áp',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),

          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.md),

          Align(
            alignment: Alignment.centerRight,
            child: CtmsButton(
              label: 'Mở trung tâm cảnh báo',
              icon: Icons.notifications_active_outlined,
              variant: CtmsButtonVariant.secondary,
              onPressed: onOpenAlerts,
            ),
          ),
        ],
      ),
    );
  }
}

/// 4. Tác vụ nhanh (Đồng bộ chuẩn giao diện thẻ _ShiftCard của trang Schedule)
class _QuickActions extends StatelessWidget {
  const _QuickActions({
    required this.onMap,
    required this.onTeam,
    required this.onSettings,
  });

  final VoidCallback onMap;
  final VoidCallback onTeam;
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) {
    return CtmsSectionCard(
      title: 'Tác vụ nhanh',
      child: Column(
        children: [
          _QuickActionTile(
            title: 'Mở bản đồ tuyến & GPS ngoại tuyến',
            subtitle: 'Xem checkpoint, độ cao và tọa độ đoàn realtime',
            icon: Icons.map_outlined,
            actionLabel: 'Mở bản đồ',
            onTap: onMap,
          ),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.md),
          _QuickActionTile(
            title: 'Danh sách thành viên đoàn',
            subtitle: 'Điểm danh 24 khách và xem hồ sơ y tế',
            icon: Icons.groups_outlined,
            actionLabel: 'Xem đoàn',
            onTap: onTeam,
          ),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.md),
          _QuickActionTile(
            title: 'Hồ sơ & Cài đặt thiết bị',
            subtitle: 'Đồng bộ viễn trắc thiết bị và tùy chọn tài khoản',
            icon: Icons.settings_outlined,
            actionLabel: 'Cài đặt',
            onTap: onSettings,
          ),
        ],
      ),
    );
  }
}

class _QuickActionTile extends StatelessWidget {
  const _QuickActionTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.actionLabel,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final String actionLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                title,
                style: AppTypography.bodyStrong.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            CtmsButton(
              label: actionLabel,
              variant: CtmsButtonVariant.secondary,
              onPressed: onTap,
            ),
          ],
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Icon(icon, size: 14, color: AppColors.textSecondary),
            const SizedBox(width: 4),
            Expanded(
              child: Text(
                subtitle,
                style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
