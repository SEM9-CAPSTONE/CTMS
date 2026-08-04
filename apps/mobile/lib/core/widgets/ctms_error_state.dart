import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';
import 'ctms_button.dart';

/// Generic error-state body for a failed screen/section load.
///
/// ```dart
/// CtmsErrorState(
///   message: error.toString(),
///   onRetry: () => ref.invalidate(tripsProvider),
/// )
/// ```
class CtmsErrorState extends StatelessWidget {
  const CtmsErrorState({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 40, color: AppColors.statusDanger),
            const SizedBox(height: AppSpacing.lg),
            Text('Đã xảy ra lỗi', style: AppTypography.h3.copyWith(color: scheme.onSurface)),
            const SizedBox(height: AppSpacing.xs),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: AppSpacing.lg),
              CtmsButton(
                label: 'Thử lại',
                variant: CtmsButtonVariant.secondary,
                onPressed: onRetry,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
