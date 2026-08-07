import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_checklist_item.dart';
import '../../../../core/widgets/ctms_status_badge.dart';

/// §A.3 step 1 — "RoleSelectionCard": icon-box + role name + description +
/// optional condition badge + 2 benefit lines. The benefit lines reuse
/// [CtmsChecklistItem] pinned to `isDone: true` for its ✓ styling — there's
/// nothing to actually check off here.
class RoleSelectionCard extends StatelessWidget {
  const RoleSelectionCard({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    required this.benefits,
    this.badgeLabel,
    this.badgeStatus = CtmsStatus.info,
    required this.isSelected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String description;
  final List<String> benefits;
  final String? badgeLabel;
  final CtmsStatus badgeStatus;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.cardBorderRadius,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.cardPadding),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: AppRadius.cardBorderRadius,
          border: Border.all(
            color: isSelected ? AppColors.brandPrimary : AppColors.border,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.brandLight,
                    borderRadius: AppRadius.iconBoxBorderRadius,
                  ),
                  alignment: Alignment.center,
                  child: Icon(icon, color: AppColors.brandPrimary),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    title,
                    style: AppTypography.h3.copyWith(color: AppColors.brandPrimary),
                  ),
                ),
                if (isSelected)
                  const Icon(Icons.check_circle, color: AppColors.brandPrimary, size: 22),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(description, style: AppTypography.body.copyWith(color: AppColors.textSecondary)),
            if (badgeLabel != null) ...[
              const SizedBox(height: AppSpacing.sm),
              CtmsStatusBadge(label: badgeLabel!, status: badgeStatus),
            ],
            const SizedBox(height: AppSpacing.md),
            for (var i = 0; i < benefits.length; i++) ...[
              if (i > 0) const SizedBox(height: AppSpacing.xs),
              CtmsChecklistItem(label: benefits[i], isDone: true),
            ],
          ],
        ),
      ),
    );
  }
}
