import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';

/// One of the 2×2 feature chips on the login hero panel
/// (§A.2 in `docs/design/FIGMA-SCREEN-INVENTORY.md`).
/// Updated for light green + white aesthetic.
class LoginFeatureChip extends StatelessWidget {
  const LoginFeatureChip({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.9),
        borderRadius: AppRadius.controlBorderRadius,
        border: Border.all(color: AppColors.brandLightBorder),
      ),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(
          color: AppColors.brandPrimary,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
