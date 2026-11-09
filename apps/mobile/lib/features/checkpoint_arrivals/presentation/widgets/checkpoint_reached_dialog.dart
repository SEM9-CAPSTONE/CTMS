import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_button.dart';
import '../../domain/checkpoint_arrival_models.dart';

/// Hộp thoại thông báo khi Camper đến một Checkpoint (CTMS-061).
class CheckpointReachedDialog extends StatelessWidget {
  const CheckpointReachedDialog({
    super.key,
    required this.checkpoint,
    required this.onDismiss,
  });

  final RouteCheckpoint checkpoint;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      key: const Key('checkpoint-reached-dialog'),
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.cardBorderRadius,
      ),
      icon: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: const BoxDecoration(
          color: AppColors.statusSuccessBg,
          shape: BoxShape.circle,
        ),
        child: const Icon(
          Icons.check_circle_outline,
          color: AppColors.statusSuccess,
          size: 40,
        ),
      ),
      title: const Text(
        'Đã đến điểm kiểm tra!',
        textAlign: TextAlign.center,
        style: AppTypography.h2,
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            checkpoint.name.isNotEmpty ? checkpoint.name : 'Trạm kiểm tra',
            textAlign: TextAlign.center,
            style: AppTypography.bodyStrong.copyWith(
              color: AppColors.brandPrimary,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Hệ thống đã tự động xác nhận bạn đến trạm này và lưu trữ an toàn trên thiết bị.',
            textAlign: TextAlign.center,
            style: AppTypography.caption.copyWith(
              color: AppColors.statusNeutral,
            ),
          ),
        ],
      ),
      actionsAlignment: MainAxisAlignment.center,
      actions: [
        CtmsButton(
          key: const Key('checkpoint-reached-dialog-dismiss'),
          label: 'Tiếp tục hành trình',
          variant: CtmsButtonVariant.primary,
          onPressed: onDismiss,
        ),
      ],
    );
  }
}
