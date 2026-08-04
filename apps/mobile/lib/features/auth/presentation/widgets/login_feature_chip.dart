import 'package:flutter/material.dart';

import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';

/// One of the 2×2 "frosted glass" feature chips on the login hero panel
/// (§A.2 in `docs/design/FIGMA-SCREEN-INVENTORY.md`). Approximated with a
/// translucent white fill rather than a real backdrop blur, to keep this a
/// cheap, purely-decorative widget.
class LoginFeatureChip extends StatelessWidget {
  const LoginFeatureChip({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: AppRadius.controlBorderRadius,
        border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(color: Colors.white, fontWeight: FontWeight.w600),
      ),
    );
  }
}
