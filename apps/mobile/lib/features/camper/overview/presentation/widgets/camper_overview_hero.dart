import 'package:flutter/material.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_radius.dart';
import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../../../../../core/widgets/ctms_logo.dart';
import '../camper_overview_strings.dart';

/// The greeting banner at the top of "Tổng quan — Camper Hub".
/// 100% mirrors Web Hero styling: Pure White card with soft border #DFE8DF,
/// translucent green top pill, bold dark text #10221B, and stadium-border action buttons.
class CamperOverviewHero extends StatelessWidget {
  const CamperOverviewHero({
    super.key,
    required this.dateLabel,
    required this.greeting,
    required this.onExplore,
    this.onViewTrips,
  });

  final String dateLabel;
  final String greeting;
  final VoidCallback onExplore;
  final VoidCallback? onViewTrips;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        gradient: isDark
            ? null
            : const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Colors.white,
                  AppColors.brandLightSurface,
                  AppColors.brandLight,
                ],
              ),
        color: isDark ? AppColors.brandDark : null,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(
          color: isDark ? AppColors.textSecondary : AppColors.brandLightBorder,
          width: 1.0,
        ),
        boxShadow: isDark ? null : AppColors.cardShadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const CtmsLogo(size: 24, showText: true),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.surfaceContainerHighest : Colors.white,
                  borderRadius: AppRadius.pillBorderRadius,
                  border: Border.all(
                    color: isDark ? AppColors.borderStrong : AppColors.brandLightBorder,
                    width: 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.calendar_today_outlined,
                      size: 13,
                      color: AppColors.brandPrimary,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      dateLabel,
                      style: AppTypography.caption.copyWith(
                        color: isDark ? Colors.white : AppColors.brandPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            greeting,
            style: AppTypography.h1.copyWith(
              color: isDark ? Colors.white : AppColors.brandPrimary,
              fontWeight: FontWeight.w800,
              fontSize: 24,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            CamperOverviewStrings.heroDescription,
            style: AppTypography.body.copyWith(
              color: isDark ? AppColors.textMuted : AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          if (onViewTrips != null)
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: onExplore,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.brandPrimary,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(64, 42),
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                      elevation: 0,
                      shape: const StadiumBorder(),
                    ),
                    child: const Text(
                      CamperOverviewStrings.exploreCta,
                      style: TextStyle(fontWeight: FontWeight.w700),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: OutlinedButton(
                    onPressed: onViewTrips,
                    style: OutlinedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppColors.textPrimary,
                      side: const BorderSide(color: AppColors.border, width: 1.2),
                      minimumSize: const Size(64, 42),
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                      elevation: 0,
                      shape: const StadiumBorder(),
                    ),
                    child: const Text(
                      CamperOverviewStrings.viewTripsCta,
                      style: TextStyle(fontWeight: FontWeight.w700),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ],
            )
          else
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onExplore,
                icon: const Icon(Icons.explore_outlined, size: 18),
                label: const Text(
                  CamperOverviewStrings.exploreCta,
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.brandPrimary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(64, 44),
                  elevation: 0,
                  shape: const StadiumBorder(),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
