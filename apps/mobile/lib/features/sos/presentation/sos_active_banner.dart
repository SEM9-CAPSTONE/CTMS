import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../application/sos_controller.dart';
import '../domain/sos_alert.dart';
import 'cancel_sos_dialog.dart';
import 'sos_active_screen.dart';

class SosActiveBanner extends ConsumerWidget {
  const SosActiveBanner({
    super.key,
    required this.tripId,
  });

  final String tripId;
  static final _timeFormat = DateFormat('HH:mm - dd/MM/yyyy');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(sosControllerProvider(tripId));
    final activeAlert = controller.activeAlert;

    if (activeAlert != null) {
      return Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.lg),
        padding: const EdgeInsets.all(AppSpacing.cardPadding),
        decoration: BoxDecoration(
          color: AppColors.statusDangerBg,
          borderRadius: AppRadius.cardBorderRadius,
          border: Border.all(color: AppColors.statusDanger, width: 1.5),
          boxShadow: [
            BoxShadow(
              color: AppColors.statusDanger.withValues(alpha: 0.15),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.statusDanger,
                    borderRadius: AppRadius.controlBorderRadius,
                  ),
                  child: const Icon(
                    Icons.sos,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'CẢNH BÁO SOS ĐANG PHÁT',
                        style: AppTypography.bodyStrong.copyWith(
                          color: AppColors.statusDanger,
                          fontWeight: FontWeight.w900,
                          fontSize: 14,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        '${activeAlert.emergencyTypeLabel} · ${_timeFormat.format(activeAlert.eventTime.toLocal())}',
                        style: AppTypography.caption.copyWith(
                          color: Colors.black87,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Tín hiệu khẩn cấp đang được gửi tới Trưởng đoàn và Đội cứu hộ. Nếu bạn lỡ tay bấm nhầm, hãy bấm HỦY ngay dưới đây:',
              style: AppTypography.caption.copyWith(
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  flex: 3,
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: CtmsButton(
                      label: 'HỦY SOS (BẤM NHẦM)',
                      variant: CtmsButtonVariant.danger,
                      icon: Icons.cancel_outlined,
                      onPressed: () async {
                        final cancelled = await CancelSosDialog.show(
                          context,
                          tripId: tripId,
                          alert: activeAlert,
                        );
                        if (cancelled != null && context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              backgroundColor: AppColors.statusSuccess,
                              content: Text(
                                'Đã hủy cảnh báo SOS thành công. Hệ thống đã cập trạng thái an toàn.',
                              ),
                            ),
                          );
                        }
                      },
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  flex: 2,
                  child: CtmsButton(
                    label: 'Chi tiết',
                    variant: CtmsButtonVariant.secondary,
                    icon: Icons.info_outline,
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => SosActiveScreen(
                            tripId: tripId,
                            alert: activeAlert,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    }

    // If no active alert, check for most recent cancelled alert to display safe history
    final latestAlert = controller.alerts.isNotEmpty ? controller.alerts.first : null;
    if (latestAlert != null && latestAlert.isCancelled) {
      return Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.lg),
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: AppRadius.cardBorderRadius,
          border: Border.all(color: AppColors.border, width: 1.0),
          boxShadow: AppColors.cardShadowSm,
        ),
        child: Row(
          children: [
            const Icon(Icons.check_circle_outline, color: AppColors.statusSuccess, size: 20),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'SOS gần nhất đã được hủy (An toàn)',
                    style: AppTypography.caption.copyWith(
                      fontWeight: FontWeight.w800,
                      color: Colors.black,
                    ),
                  ),
                  if (latestAlert.cancellationReason != null)
                    Text(
                      'Lý do: "${latestAlert.cancellationReason}"',
                      style: AppTypography.caption.copyWith(
                        color: Colors.black87,
                        fontSize: 11,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => SosActiveScreen(
                      tripId: tripId,
                      alert: latestAlert,
                    ),
                  ),
                );
              },
              style: TextButton.styleFrom(
                foregroundColor: Colors.black,
              ),
              child: const Text(
                'Lịch sử',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.black,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }
}
