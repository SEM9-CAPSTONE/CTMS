import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../application/sos_controller.dart';
import '../domain/sos_alert.dart';
import 'cancel_sos_dialog.dart';

class SosActiveScreen extends ConsumerWidget {
  const SosActiveScreen({
    super.key,
    required this.tripId,
    required this.alert,
  });

  final String tripId;
  final SosAlert alert;

  static final _dateFormat = DateFormat('HH:mm:ss · dd/MM/yyyy');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(sosControllerProvider(tripId));

    // Find latest state of this alert from controller alerts if updated
    final currentAlert = controller.alerts.firstWhere(
      (a) => a.id == alert.id,
      orElse: () => alert,
    );

    final isAlertActive = currentAlert.isActive;
    final isAlertCancelled = currentAlert.isCancelled;

    return CtmsScaffold(
      title: isAlertActive ? 'Cảnh báo Khẩn cấp SOS' : 'Chi tiết Sự vụ SOS',
      subtitle: isAlertActive ? 'Trạng thái phát tín hiệu trực tiếp' : 'Lịch sử sự vụ SOS',
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.cardPadding),
        children: [
          // 1. Status Indicator Header Card
          Container(
            padding: const EdgeInsets.symmetric(
              vertical: AppSpacing.xxl,
              horizontal: AppSpacing.lg,
            ),
            decoration: BoxDecoration(
              color: isAlertActive
                  ? AppColors.statusDangerBg
                  : isAlertCancelled
                  ? Colors.green.shade50
                  : AppColors.brandLight,
              borderRadius: AppRadius.cardBorderRadius,
              border: Border.all(
                color: isAlertActive
                    ? AppColors.statusDanger
                    : isAlertCancelled
                    ? Colors.green.shade400
                    : AppColors.brandPrimary,
                width: 1.5,
              ),
              boxShadow: isAlertActive ? AppColors.cardShadowSm : null,
            ),
            child: Column(
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: isAlertActive
                        ? AppColors.statusDanger
                        : isAlertCancelled
                        ? Colors.green.shade600
                        : AppColors.brandPrimary,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isAlertActive
                        ? Icons.sos_rounded
                        : isAlertCancelled
                        ? Icons.check_circle_outline
                        : Icons.info_outline,
                    color: Colors.white,
                    size: 40,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  isAlertActive
                      ? 'TÍN HIỆU SOS ĐANG PHÁT'
                      : isAlertCancelled
                      ? 'BÁO ĐỘNG ĐÃ ĐƯỢC HỦY'
                      : currentAlert.statusLabel.toUpperCase(),
                  style: AppTypography.h2.copyWith(
                    fontWeight: FontWeight.w900,
                    color: isAlertActive
                        ? AppColors.statusDanger
                        : isAlertCancelled
                        ? Colors.green.shade800
                        : Colors.black,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  isAlertActive
                      ? 'Trưởng đoàn và các thành viên đã nhận được cảnh báo. Nếu đây là sự cố gửi nhầm, hãy bấm nút Hủy bên dưới.'
                      : isAlertCancelled
                      ? 'Tín hiệu đã được xác nhận là gửi nhầm hoặc tình huống đã an toàn. Lịch sử đã được cập nhật.'
                      : 'Đội hỗ trợ đang xử lý sự vụ.',
                  style: AppTypography.caption.copyWith(
                    color: Colors.black87,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.lg),

          // 2. Alert Specifications Card
          Container(
            padding: const EdgeInsets.all(AppSpacing.cardPadding),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: AppRadius.cardBorderRadius,
              border: Border.all(color: AppColors.border),
              boxShadow: AppColors.cardShadowSm,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'THÔNG TIN CẢNH BÁO',
                      style: AppTypography.bodyStrong.copyWith(
                        fontWeight: FontWeight.w800,
                        color: Colors.black,
                      ),
                    ),
                    CtmsStatusBadge(
                      label: currentAlert.statusLabel,
                      status: isAlertActive
                          ? CtmsStatus.danger
                          : isAlertCancelled
                          ? CtmsStatus.neutral
                          : CtmsStatus.info,
                    ),
                  ],
                ),
                const Divider(height: AppSpacing.xl),
                _InfoRow(
                  label: 'Loại khẩn cấp:',
                  value: currentAlert.emergencyTypeLabel,
                  isBold: true,
                ),
                const SizedBox(height: AppSpacing.sm),
                _InfoRow(
                  label: 'Thời gian phát:',
                  value: _dateFormat.format(currentAlert.eventTime.toLocal()),
                ),
                const SizedBox(height: AppSpacing.sm),
                _InfoRow(
                  label: 'Mã định danh SOS:',
                  value: currentAlert.id,
                ),
                if (currentAlert.location != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  _InfoRow(
                    label: 'Tọa độ GPS:',
                    value:
                        '${currentAlert.location!.latitude.toStringAsFixed(4)}, ${currentAlert.location!.longitude.toStringAsFixed(4)}',
                  ),
                ],
                if (currentAlert.batteryLevel != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  _InfoRow(
                    label: 'Dung lượng pin thiết bị:',
                    value: '${currentAlert.batteryLevel}%',
                  ),
                ],
                if (currentAlert.notes != null && currentAlert.notes!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  _InfoRow(
                    label: 'Ghi chú ban đầu:',
                    value: currentAlert.notes!,
                  ),
                ],
              ],
            ),
          ),

          // 3. Cancellation Audit Card (BR-258 / BR-191)
          if (isAlertCancelled) ...[
            const SizedBox(height: AppSpacing.lg),
            Container(
              padding: const EdgeInsets.all(AppSpacing.cardPadding),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppRadius.cardBorderRadius,
                border: Border.all(color: Colors.green.shade300),
                boxShadow: AppColors.cardShadowSm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.verified_user_outlined,
                        color: Colors.green.shade700,
                        size: 20,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(
                        'LỊCH SỬ HỦY BÁO ĐỘNG (BR-258)',
                        style: AppTypography.bodyStrong.copyWith(
                          fontWeight: FontWeight.w800,
                          color: Colors.green.shade900,
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: AppSpacing.xl),
                  _InfoRow(
                    label: 'Lý do hủy cảnh báo:',
                    value: currentAlert.cancellationReason ?? 'Không có lý do',
                    isBold: true,
                  ),
                  if (currentAlert.cancelledAt != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    _InfoRow(
                      label: 'Thời gian hủy:',
                      value: _dateFormat.format(currentAlert.cancelledAt!.toLocal()),
                    ),
                  ],
                  if (currentAlert.cancelledBy != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    _InfoRow(
                      label: 'Mã tài khoản hủy:',
                      value: currentAlert.cancelledBy!,
                    ),
                  ],
                  const SizedBox(height: AppSpacing.sm),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: AppRadius.controlBorderRadius,
                    ),
                    child: Text(
                      'Bảo toàn lịch sử: Hồ sơ SOS này được lưu trữ vĩnh viễn theo chính sách an toàn, không thể bị xóa khỏi hệ thống.',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: AppSpacing.xl),

          // 4. Action Buttons
          if (isAlertActive) ...[
            CtmsButton(
              label: 'HỦY BÁO ĐỘNG SOS (GỬI NHẦM)',
              variant: CtmsButtonVariant.danger,
              icon: Icons.cancel_outlined,
              onPressed: () async {
                final cancelled = await CancelSosDialog.show(
                  context,
                  tripId: tripId,
                  alert: currentAlert,
                );
                if (cancelled != null && context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      backgroundColor: AppColors.statusSuccess,
                      content: Text(
                        'Đã hủy cảnh báo SOS thành công. Trưởng đoàn đã được thông báo.',
                      ),
                    ),
                  );
                }
              },
            ),
            const SizedBox(height: AppSpacing.md),
          ],

          CtmsButton(
            label: 'Quay lại chuyến đi',
            variant: CtmsButtonVariant.secondary,
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.label,
    required this.value,
    this.isBold = false,
  });

  final String label;
  final String value;
  final bool isBold;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 140,
          child: Text(
            label,
            style: AppTypography.caption.copyWith(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: AppTypography.caption.copyWith(
              color: Colors.black,
              fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
