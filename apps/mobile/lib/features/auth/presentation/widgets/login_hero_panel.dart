import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_logo.dart';
import '../login_strings.dart';
import 'login_feature_chip.dart';

/// Mobile adaptation of the login hero banner.
/// Styled with crisp White + Soft Mint gradient and deep green branding.
class LoginHeroPanel extends StatelessWidget {
  const LoginHeroPanel({super.key});

  static const _heightFraction = 0.28;
  static const _minHeight = 170.0;
  static const _maxHeight = 260.0;

  @override
  Widget build(BuildContext context) {
    final viewportHeight = MediaQuery.sizeOf(context).height;
    final targetHeight = (viewportHeight * _heightFraction).clamp(_minHeight, _maxHeight);

    return ConstrainedBox(
      constraints: BoxConstraints(minHeight: targetHeight),
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          gradient: AppColors.gradientHero,
          border: const Border(
            bottom: BorderSide(color: AppColors.brandLightBorder, width: 1.2),
          ),
          boxShadow: AppColors.cardShadowSm,
        ),
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.xl,
              AppSpacing.sm,
              AppSpacing.xl,
              AppSpacing.lg,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                _Logo(),
                const SizedBox(height: AppSpacing.md),
                Text(
                  LoginStrings.heroHeadline,
                  style: AppTypography.h1.copyWith(
                    color: AppColors.brandPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.xs,
                  children: [
                    for (final feature in LoginStrings.heroFeatures)
                      LoginFeatureChip(label: feature),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                Row(
                  children: [
                    const Icon(Icons.shield_outlined, size: 16, color: AppColors.brandAccent),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        LoginStrings.heroFooter,
                        style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Logo extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const CtmsLogo(size: 34, showText: true);
  }
}
