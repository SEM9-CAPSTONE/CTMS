import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_section_card.dart';
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

  String _greeting(String displayName) {
    final hour = DateTime.now().hour;
    final timeOfDay = hour < 11 ? 'sáng' : (hour < 18 ? 'chiều' : 'tối');
    return 'Chào buổi $timeOfDay, $displayName';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).valueOrNull;
    final displayName = user?.displayName ?? 'Porter';

    return Scaffold(
      appBar: AppBar(title: const Text('Tổng quan')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        children: [
          _PorterHero(
            dateLabel: _dateLabel(DateTime.now()),
            greeting: _greeting(displayName),
            onSchedule: () => context.go('/porter/schedule'),
            onReport: () => context.push('/porter/incidents'),
          ),
          const SizedBox(height: AppSpacing.lg),
          const _MetricGrid(),
          const SizedBox(height: AppSpacing.lg),
          const _CurrentRouteCard(),
          const SizedBox(height: AppSpacing.lg),
          _ScheduleCard(onOpenSchedule: () => context.go('/porter/schedule')),
          const SizedBox(height: AppSpacing.lg),
          _AlertCard(onOpenAlerts: () => context.go('/porter/alerts')),
          const SizedBox(height: AppSpacing.lg),
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

class _PorterHero extends StatelessWidget {
  const _PorterHero({
    required this.dateLabel,
    required this.greeting,
    required this.onSchedule,
    required this.onReport,
  });

  final String dateLabel;
  final String greeting;
  final VoidCallback onSchedule;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.brandDark, AppColors.porterClay],
        ),
        borderRadius: AppRadius.cardBorderRadius,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            dateLabel,
            style: AppTypography.caption.copyWith(
              color: Colors.white70,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(greeting, style: AppTypography.h1.copyWith(color: Colors.white)),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Theo dõi ca trekking, điểm danh đoàn, cảnh báo tuyến và sự cố cần xử lý.',
            style: AppTypography.body.copyWith(color: Colors.white70),
          ),
          const SizedBox(height: AppSpacing.xl),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: onSchedule,
                  icon: const Icon(Icons.event_note_outlined, size: 18),
                  label: const Text('Lịch ca'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.brandPrimary,
                    minimumSize: const Size(64, 40),
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadius.controlBorderRadius,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onReport,
                  icon: const Icon(Icons.report_outlined, size: 18),
                  label: const Text('Báo cáo'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white70),
                    minimumSize: const Size(64, 40),
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadius.controlBorderRadius,
                    ),
                  ),
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
      _MetricData('Ca hôm nay', '03', 'Sơn Trà, Bãi Bắc', Icons.hiking),
      _MetricData('Đoàn phụ trách', '24', '2 khách cần hỗ trợ', Icons.groups),
      _MetricData(
        'Cảnh báo',
        '02',
        '1 cảnh báo thời tiết',
        Icons.warning_amber,
      ),
      _MetricData('Sự cố mở', '01', 'Đang theo dõi', Icons.report_problem),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: AppSpacing.md,
      mainAxisSpacing: AppSpacing.md,
      childAspectRatio: 1.12,
      children: metrics.map((metric) => _MetricCard(metric: metric)).toList(),
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
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: AppRadius.cardBorderRadius,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  metric.label.toUpperCase(),
                  style: AppTypography.label.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              Icon(metric.icon, color: AppColors.porterClay, size: 20),
            ],
          ),
          const Spacer(),
          Text(
            metric.value,
            style: AppTypography.display.copyWith(color: AppColors.textPrimary),
          ),
          Text(
            metric.helper,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.caption.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _CurrentRouteCard extends StatelessWidget {
  const _CurrentRouteCard();

  @override
  Widget build(BuildContext context) {
    return CtmsSectionCard(
      title: 'Tuyến đang vận hành',
      trailing: _StatusPill(label: 'Đang mở', color: AppColors.statusSuccess),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Trekking Sơn Trà - Bãi Bắc',
            style: AppTypography.h2.copyWith(color: AppColors.textPrimary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Khởi hành 06:30 · Checkpoint 2/5 · Thời tiết ổn định',
            style: AppTypography.body.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: const [
              Expanded(
                child: _RouteStat(label: 'Check-in', value: '22/24'),
              ),
              SizedBox(width: AppSpacing.md),
              Expanded(
                child: _RouteStat(label: 'Porter', value: '4'),
              ),
              SizedBox(width: AppSpacing.md),
              Expanded(
                child: _RouteStat(label: 'ETA', value: '16:20'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RouteStat extends StatelessWidget {
  const _RouteStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.brandBg,
        borderRadius: AppRadius.controlBorderRadius,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: AppTypography.caption.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            value,
            style: AppTypography.bodyStrong.copyWith(
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

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
        icon: const Icon(Icons.calendar_month_outlined),
      ),
      child: const Column(
        children: [
          _TimelineItem(time: '06:30', title: 'Điểm danh tại cổng Bắc'),
          _TimelineItem(time: '08:10', title: 'Dẫn đoàn qua tuyến rừng'),
          _TimelineItem(time: '12:00', title: 'Nghỉ tại trạm Bãi Bắc'),
        ],
      ),
    );
  }
}

class _TimelineItem extends StatelessWidget {
  const _TimelineItem({required this.time, required this.title});

  final String time;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 54,
            child: Text(
              time,
              style: AppTypography.bodyStrong.copyWith(
                color: AppColors.brandPrimary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              title,
              style: AppTypography.body.copyWith(color: AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.onOpenAlerts});

  final VoidCallback onOpenAlerts;

  @override
  Widget build(BuildContext context) {
    return CtmsSectionCard(
      title: 'Cảnh báo cần xử lý',
      trailing: TextButton(onPressed: onOpenAlerts, child: const Text('Xem')),
      child: Column(
        children: const [
          _AlertRow(
            icon: Icons.cloudy_snowing,
            title: 'Mưa nhẹ sau 15:00',
            detail: 'Chuẩn bị áo mưa và nhắc đoàn giữ nhịp.',
            color: AppColors.statusWarning,
          ),
          SizedBox(height: AppSpacing.md),
          _AlertRow(
            icon: Icons.health_and_safety_outlined,
            title: '1 camper cần theo dõi sức khỏe',
            detail: 'Đã chia sẻ hồ sơ y tế cho porter phụ trách.',
            color: AppColors.statusInfo,
          ),
        ],
      ),
    );
  }
}

class _AlertRow extends StatelessWidget {
  const _AlertRow({
    required this.icon,
    required this.title,
    required this.detail,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String detail;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: AppRadius.iconBoxBorderRadius,
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTypography.bodyStrong.copyWith(
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                detail,
                style: AppTypography.caption.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

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
          _ActionTile(
            icon: Icons.map_outlined,
            label: 'Mở bản đồ tuyến',
            onTap: onMap,
          ),
          _ActionTile(
            icon: Icons.groups_outlined,
            label: 'Danh sách đoàn',
            onTap: onTeam,
          ),
          _ActionTile(
            icon: Icons.settings_outlined,
            label: 'Hồ sơ & cài đặt',
            onTap: onSettings,
          ),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Icon(icon, color: AppColors.brandPrimary),
        title: Text(label, style: AppTypography.bodyStrong),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: AppRadius.pillBorderRadius,
      ),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
