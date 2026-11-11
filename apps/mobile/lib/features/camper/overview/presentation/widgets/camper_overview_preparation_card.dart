import 'package:flutter/material.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_radius.dart';
import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../../../../../core/widgets/ctms_progress_bar.dart';
import '../../../../../core/widgets/ctms_status_badge.dart';
import '../../domain/camper_overview_models.dart';
import '../overview_severity_x.dart';

/// "Chuẩn bị trước chuyến đi" — pure white card matching /camper/explore style.
class CamperOverviewPreparationCard extends StatelessWidget {
  const CamperOverviewPreparationCard({
    super.key,
    required this.progress,
    required this.items,
  });

  final double progress;
  final List<PreparationItem> items;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Tiến độ chuẩn bị vật dụng',
                style: AppTypography.bodyStrong.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.brandLight,
                  borderRadius: AppRadius.pillBorderRadius,
                  border: Border.all(color: AppColors.brandLightBorder),
                ),
                child: Text(
                  '${(progress * 100).round()}% hoàn thành',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.brandPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          CtmsProgressBar(progress: progress, height: 7),
          const SizedBox(height: AppSpacing.lg),
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const Divider(height: AppSpacing.lg, thickness: 1, color: AppColors.border),
            Row(
              children: [
                Expanded(
                  child: Text(
                    items[i].label,
                    style: AppTypography.body.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                CtmsStatusBadge(
                  label: items[i].statusLabel,
                  status: items[i].severity.ctmsStatus,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
