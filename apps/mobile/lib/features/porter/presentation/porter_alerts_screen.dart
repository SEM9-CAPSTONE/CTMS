import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_status_badge.dart';

class PorterAlertsScreen extends StatelessWidget {
  const PorterAlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return CtmsScaffold(
      title: 'Cảnh báo',
      subtitle: 'Theo dõi cảnh báo tuyến trekking, thời tiết và sức khỏe đoàn',
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        children: [
          Text(
            'Cảnh báo ưu tiên cao (2)',
            style: AppTypography.h3.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _AlertItemCard(
            title: 'Mưa dông kèm gió giật sau 15:00',
            time: '14:20 • Tuyến Sơn Trà Bãi Bắc',
            description:
                'Thời tiết chuyển mưa to tại dốc Cổng Trời. Nhắc nhở thành viên đoàn mặc áo mưa, hạ tốc độ di chuyển và tuyệt đối không tách đoàn.',
            status: 'Cảnh báo thời tiết',
            statusType: CtmsStatus.warning,
            icon: Icons.thunderstorm_outlined,
            actionLabel: 'Xác nhận đã nhận tin',
            onAction: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Đã xác nhận cảnh báo thời tiết')),
              );
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          _AlertItemCard(
            title: 'Camper cần hỗ trợ y tế đặc biệt',
            time: '08:00 • Đoàn 24 khách',
            description:
                'Camper Nguyễn Hoàng Nam có tiền sử hen suyễn nhẹ khi thay đổi độ cao đột ngột. Thuốc cắt cơn cá nhân mang theo trong balo.',
            status: 'Y tế & Sức khỏe',
            statusType: CtmsStatus.danger,
            icon: Icons.medical_services_outlined,
            actionLabel: 'Xem hồ sơ sức khỏe',
            onAction: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Đang mở thông tin y tế bảo mật')),
              );
            },
          ),
          const SizedBox(height: AppSpacing.xxl),
          Text(
            'Thông báo hệ thống & thiết bị',
            style: AppTypography.h3.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _AlertItemCard(
            title: 'Bản ghi telemetry GPS đã sẵn sàng đồng bộ',
            time: '12:00 • Thiết bị ngoại tuyến',
            description:
                'Có 15 tọa độ GPS và 1 bản ghi điểm danh ca trực đang chờ gửi lên máy chủ khi thiết bị có kết nối mạng.',
            status: 'Hệ thống ngoại tuyến',
            statusType: CtmsStatus.info,
            icon: Icons.sync_outlined,
            actionLabel: 'Kiểm tra truyền dữ liệu',
            onAction: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Đang mở màn hình kiểm tra truyền dữ liệu')),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _AlertItemCard extends StatelessWidget {
  const _AlertItemCard({
    required this.title,
    required this.time,
    required this.description,
    required this.status,
    required this.statusType,
    required this.icon,
    required this.actionLabel,
    required this.onAction,
  });

  final String title;
  final String time;
  final String description;
  final String status;
  final CtmsStatus statusType;
  final IconData icon;
  final String actionLabel;
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
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.brandBg,
                  borderRadius: AppRadius.controlBorderRadius,
                  border: Border.all(color: AppColors.border),
                ),
                child: Icon(icon, size: 20, color: AppColors.textPrimary),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTypography.h3.copyWith(
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(time, style: AppTypography.caption.copyWith(color: AppColors.textSecondary)),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              CtmsStatusBadge(label: status, status: statusType),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            description,
            style: AppTypography.body.copyWith(color: AppColors.textPrimary, height: 1.45),
          ),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: Alignment.centerRight,
            child: CtmsButton(
              label: actionLabel,
              variant: CtmsButtonVariant.secondary,
              onPressed: onAction,
            ),
          ),
        ],
      ),
    );
  }
}
