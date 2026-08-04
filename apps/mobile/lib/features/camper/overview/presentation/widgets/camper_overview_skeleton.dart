import 'package:flutter/material.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_radius.dart';
import '../../../../../core/theme/app_spacing.dart';

/// Simple static placeholder blocks shown while
/// `camperOverviewProvider` is loading — no shimmer animation, just
/// muted rectangles roughly matching the real layout's proportions.
class CamperOverviewSkeleton extends StatelessWidget {
  const CamperOverviewSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.xxl),
      children: const [
        _Block(height: 160),
        SizedBox(height: AppSpacing.lg),
        _Block(height: 96),
        SizedBox(height: AppSpacing.lg),
        _Block(height: 180),
        SizedBox(height: AppSpacing.lg),
        _Block(height: 120),
        SizedBox(height: AppSpacing.lg),
        _Block(height: 90),
      ],
    );
  }
}

class _Block extends StatelessWidget {
  const _Block({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: AppRadius.cardBorderRadius,
      ),
    );
  }
}
