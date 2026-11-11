import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';

/// §2.5 Badge / StatusPill — 100% mirrors Web `StatusBadge.tsx`:
/// emerald-50/200/700, amber-50/200/700, red-50/200/700, sky-50/200/700, slate-100/200/600.
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

  static Color backgroundFor(CtmsStatus status) => switch (status) {
    CtmsStatus.success => AppColors.statusSuccessBg,
    CtmsStatus.warning => AppColors.statusWarningBg,
    CtmsStatus.danger => AppColors.statusDangerBg,
    CtmsStatus.info => AppColors.statusInfoBg,
    CtmsStatus.neutral => AppColors.statusNeutralBg,
  };

  static Color borderFor(CtmsStatus status) => switch (status) {
    CtmsStatus.success => AppColors.statusSuccessBorder,
    CtmsStatus.warning => AppColors.statusWarningBorder,
    CtmsStatus.danger => AppColors.statusDangerBorder,
    CtmsStatus.info => AppColors.statusInfoBorder,
    CtmsStatus.neutral => AppColors.statusNeutralBorder,
  };

  @override
  Widget build(BuildContext context) {
    final color = colorFor(status);
    final isSolid = variant == CtmsBadgeVariant.solid;

    final foreground = isSolid ? Colors.white : color;
    final background = isSolid ? color : backgroundFor(status);
    final border = isSolid ? null : Border.all(color: borderFor(status), width: 1);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        border: border,
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
            style: AppTypography.caption.copyWith(
              color: foreground,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
