import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../login_strings.dart';
import 'login_feature_chip.dart';

/// Mobile adaptation of the Figma login screen's left panel (§A.2 —
/// "Trái: ảnh núi full-bleed..."). The desktop layout is a 50/50 split;
/// on a phone that becomes a top banner over the scrollable form instead.
///
/// Sized as a fraction of the viewport (~[_heightFraction]) rather than a
/// fixed height, so it scales with the device instead of eating a fixed
/// chunk of a small screen or looking sparse on a tall one. It's a
/// [ConstrainedBox] *minHeight*, not an exact height — on very short
/// screens the fixed-size logo/heading/chips/footer content is the true
/// floor (typography stays as designed, so it's never shrunk to fit), and
/// on taller screens the panel grows to the target fraction, adding
/// breathing room below the footer rather than stretching the content.
///
/// // TODO(assets): swap this brand-gradient placeholder for the real
/// // full-bleed mountain photo once art assets are available.
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
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.brandDark, AppColors.brandPrimary],
          ),
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
                  style: AppTypography.h1.copyWith(color: Colors.white),
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
                    const Icon(Icons.shield_outlined, size: 16, color: Colors.white70),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        LoginStrings.heroFooter,
                        style: AppTypography.caption.copyWith(color: Colors.white70),
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
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.all(Radius.circular(10)),
          ),
          child: const Icon(Icons.terrain, color: AppColors.brandPrimary, size: 20),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text('CTMS', style: AppTypography.h2.copyWith(color: Colors.white)),
      ],
    );
  }
}
