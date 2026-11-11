import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_radius.dart';

/// §2.11 thin progress bar (6px, pill radius, track `brandLight`, fill
/// `brandPrimary` by default).
///
/// ```dart
/// CtmsProgressBar(progress: 6 / 8)
/// CtmsProgressBar(progress: 0.85, color: AppColors.statusWarning)
/// ```
class CtmsProgressBar extends StatelessWidget {
  const CtmsProgressBar({
    super.key,
    required this.progress,
    this.color,
    this.trackColor,
    this.height = 6.0,
  });

  /// 0.0–1.0. Values outside that range are clamped.
  final double progress;
  final Color? color;
  final Color? trackColor;
  final double height;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.pillBorderRadius,
      child: SizedBox(
        height: height,
        child: Stack(
          children: [
            Container(color: trackColor ?? AppColors.brandLight),
            FractionallySizedBox(
              widthFactor: progress.clamp(0.0, 1.0),
              child: Container(
                decoration: BoxDecoration(
                  color: color ?? AppColors.brandPrimary,
                  borderRadius: AppRadius.pillBorderRadius,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
