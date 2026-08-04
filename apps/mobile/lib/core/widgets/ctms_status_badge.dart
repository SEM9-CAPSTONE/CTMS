import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';

/// §2.5 Badge / StatusPill.
///
/// ```dart
/// CtmsStatusBadge(label: 'Chờ xác nhận', status: CtmsStatus.warning)
/// CtmsStatusBadge(
///   label: 'NGUY HIỂM',
///   status: CtmsStatus.danger,
///   variant: CtmsBadgeVariant.solid,
///   showDot: true,
/// )
/// ```
enum CtmsBadgeVariant { soft, solid }

enum CtmsStatus { success, warning, danger, info, neutral }

class CtmsStatusBadge extends StatelessWidget {
  const CtmsStatusBadge({
    super.key,
    required this.label,
    this.status = CtmsStatus.neutral,
    this.variant = CtmsBadgeVariant.soft,
    this.icon,
    this.showDot = false,
  });

  final String label;
  final CtmsStatus status;
  final CtmsBadgeVariant variant;
  final IconData? icon;
  final bool showDot;

  static Color colorFor(CtmsStatus status) => switch (status) {
    CtmsStatus.success => AppColors.statusSuccess,
    CtmsStatus.warning => AppColors.statusWarning,
    CtmsStatus.danger => AppColors.statusDanger,
    CtmsStatus.info => AppColors.statusInfo,
    CtmsStatus.neutral => AppColors.statusNeutral,
  };

  @override
  Widget build(BuildContext context) {
    final color = colorFor(status);
    final isSolid = variant == CtmsBadgeVariant.solid;
    final foreground = isSolid ? Colors.white : color;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: isSolid ? color : color.withValues(alpha: 0.1),
        borderRadius: AppRadius.pillBorderRadius,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showDot) ...[
            Container(
              width: 6,
              height: 6,
              margin: const EdgeInsets.only(right: AppSpacing.xs),
              decoration: BoxDecoration(color: foreground, shape: BoxShape.circle),
            ),
          ] else if (icon != null) ...[
            Icon(icon, size: 12, color: foreground),
            const SizedBox(width: AppSpacing.xs),
          ],
          Text(
            label,
            style: AppTypography.caption.copyWith(color: foreground, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
