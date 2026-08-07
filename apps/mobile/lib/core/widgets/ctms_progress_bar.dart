import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_radius.dart';

/// §2.11 thin progress bar (4px, pill radius, track `border`, fill
/// `brand.primary` by default).
///
/// ```dart
/// CtmsProgressBar(progress: 6 / 8)
/// CtmsProgressBar(progress: 0.85, color: AppColors.statusWarning)
/// ```
class CtmsProgressBar extends StatelessWidget {
  const CtmsProgressBar({super.key, required this.progress, this.color, this.trackColor});

  /// 0.0–1.0. Values outside that range are clamped.
  final double progress;
  final Color? color;
  final Color? trackColor;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.pillBorderRadius,
      child: SizedBox(
        height: 4,
        child: Stack(
          children: [
            Container(color: trackColor ?? AppColors.border),
            FractionallySizedBox(
              widthFactor: progress.clamp(0.0, 1.0),
              child: Container(color: color ?? AppColors.brandPrimary),
            ),
          ],
        ),
      ),
    );
  }
}
