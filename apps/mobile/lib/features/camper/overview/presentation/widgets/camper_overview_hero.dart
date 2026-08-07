import 'package:flutter/material.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_radius.dart';
import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../camper_overview_strings.dart';

/// The greeting banner at the top of "Tổng quan — Camper Hub". Sits on a
/// dark brand gradient, so its two CTAs are custom-styled (white fill /
/// white outline) rather than [CtmsButton] — same call as
/// `login_hero_panel.dart` for the same reason: the shared button theme
/// assumes a light `surface` background, not a colored hero card.
///
/// // TODO(assets): swap the gradient for the real hero photo once art
/// // assets are available (matches the login hero's placeholder note).
class CamperOverviewHero extends StatelessWidget {
  const CamperOverviewHero({
    super.key,
    required this.dateLabel,
    required this.greeting,
    required this.onExplore,
    required this.onViewTrips,
  });

  final String dateLabel;
  final String greeting;
  final VoidCallback onExplore;
  final VoidCallback onViewTrips;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.brandDark, AppColors.brandPrimary],
        ),
        borderRadius: AppRadius.cardBorderRadius,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            dateLabel,
            style: AppTypography.caption.copyWith(
              color: Colors.white70,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(greeting, style: AppTypography.h1.copyWith(color: Colors.white)),
          const SizedBox(height: AppSpacing.sm),
          Text(
            CamperOverviewStrings.heroDescription,
            style: AppTypography.body.copyWith(color: Colors.white70),
          ),
          const SizedBox(height: AppSpacing.xl),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: onExplore,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.brandPrimary,
                    minimumSize: const Size(64, 40),
                    shape: RoundedRectangleBorder(borderRadius: AppRadius.controlBorderRadius),
                  ),
                  child: const Text(CamperOverviewStrings.exploreCta),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: OutlinedButton(
                  onPressed: onViewTrips,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white70),
                    minimumSize: const Size(64, 40),
                    shape: RoundedRectangleBorder(borderRadius: AppRadius.controlBorderRadius),
                  ),
                  child: const Text(CamperOverviewStrings.viewTripsCta),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
