import 'package:flutter/material.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_radius.dart';
import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../camper_overview_strings.dart';

/// The 4 quick-action cards — "KPI/action row -> GridView 2 cột" per the
/// desktop→mobile rules.
class CamperOverviewQuickActions extends StatelessWidget {
  const CamperOverviewQuickActions({
    super.key,
    required this.onGuideCenter,
    required this.onMyTrips,
    required this.onAiSupport,
    required this.onUpdateProfile,
  });

  final VoidCallback onGuideCenter;
  final VoidCallback onMyTrips;
  final VoidCallback onAiSupport;
  final VoidCallback onUpdateProfile;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: AppSpacing.md,
      mainAxisSpacing: AppSpacing.md,
      childAspectRatio: 2.6,
      children: [
        _QuickActionCard(
          icon: Icons.menu_book_outlined,
          label: CamperOverviewStrings.quickActionGuideCenter,
          onTap: onGuideCenter,
        ),
        _QuickActionCard(
          icon: Icons.hiking_outlined,
          label: CamperOverviewStrings.quickActionMyTrips,
          onTap: onMyTrips,
        ),
        _QuickActionCard(
          icon: Icons.smart_toy_outlined,
          label: CamperOverviewStrings.quickActionAiSupport,
          onTap: onAiSupport,
        ),
        _QuickActionCard(
          icon: Icons.person_outline,
          label: CamperOverviewStrings.quickActionUpdateProfile,
          onTap: onUpdateProfile,
        ),
      ],
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  const _QuickActionCard({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.cardBorderRadius,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
        decoration: BoxDecoration(
          color: scheme.surface,
          borderRadius: AppRadius.cardBorderRadius,
          border: Border.all(color: scheme.outline),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.brandLight,
                borderRadius: AppRadius.iconBoxBorderRadius,
              ),
              alignment: Alignment.center,
              child: Icon(icon, size: 18, color: AppColors.brandPrimary),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                label,
                style: AppTypography.bodyStrong.copyWith(color: scheme.onSurface),
                maxLines: 2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
