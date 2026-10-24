import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../../sync/presentation/device_sync_status_screen.dart';

class PorterScheduleScreen extends StatelessWidget {
  const PorterScheduleScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return CtmsScaffold(
      title: 'Lịch phân công',
      subtitle: 'Theo dõi và xác nhận các ca trekking được giao cho bạn',
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        children: [
          // Section 1: Ca hôm nay
          Text(
            'Ca trực hôm nay',
            style: AppTypography.h3.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _ShiftCard(
            title: 'Trekking Sơn Trà – Bãi Bắc',
            time: 'Hôm nay • 06:30 – 16:30',
            location: 'Điểm tập kết: Trạm Kiểm lâm Cổng Bắc',
            membersText: 'Đoàn 24 khách • 4 porter phụ trách',
            status: 'Đang diễn ra',
            statusType: CtmsStatus.success,
            actionLabel: 'Đồng bộ dữ liệu ca',
            actionVariant: CtmsButtonVariant.primary,
            onAction: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const DeviceSyncStatusScreen(
                    tripId: 'a1736fee-62be-4991-9478-a62288e9b80a',
                  ),
                ),
              );
            },
          ),

          const SizedBox(height: AppSpacing.xxl),

          // Section 2: Ca sắp tới
          Text(
            'Lịch phân công sắp tới',
            style: AppTypography.h3.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _ShiftCard(
            title: 'Trekking Tà Năng – Phan Dũng',
            time: '28/07/2026 – 30/07/2026 (3 ngày 2 đêm)',
            location: 'Điểm tập kết: Xã Đa Quyn, Đức Trọng, Lâm Đồng',
            membersText: 'Đoàn 8 khách • Dẫn đầu & chốt đoàn',
            status: 'Đã xác nhận',
            statusType: CtmsStatus.neutral,
            actionLabel: 'Xem chi tiết ca',
            actionVariant: CtmsButtonVariant.secondary,
            onAction: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Chi tiết ca Tà Năng đang được tải')),
              );
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          _ShiftCard(
            title: 'Chinh phục Đỉnh Bidoup Núi Bà',
            time: '15/08/2026 – 16/08/2026 (2 ngày 1 đêm)',
            location: 'Điểm tập kết: Vườn Quốc gia Bidoup',
            membersText: 'Đoàn 12 khách • Hỗ trợ thiết bị & y tế',
            status: 'Chờ xác nhận',
            statusType: CtmsStatus.warning,
            actionLabel: 'Xác nhận nhận ca',
            actionVariant: CtmsButtonVariant.primary,
            onAction: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Đã xác nhận nhận ca Bidoup thành công')),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _ShiftCard extends StatelessWidget {
  const _ShiftCard({
    required this.title,
    required this.time,
    required this.location,
    required this.membersText,
    required this.status,
    required this.statusType,
    required this.actionLabel,
    required this.actionVariant,
    required this.onAction,
  });

  final String title;
  final String time;
  final String location;
  final String membersText;
  final String status;
  final CtmsStatus statusType;
  final String actionLabel;
  final CtmsButtonVariant actionVariant;
  final VoidCallback onAction;

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
                  title,
                  style: AppTypography.h3.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              CtmsStatusBadge(label: status, status: statusType, showDot: true),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.schedule_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Text(
                time,
                style: AppTypography.body.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500,
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
                  location,
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
              Text(
                membersText,
                style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: Alignment.centerRight,
            child: CtmsButton(
              label: actionLabel,
              variant: actionVariant,
              onPressed: onAction,
            ),
          ),
        ],
      ),
    );
  }
}
