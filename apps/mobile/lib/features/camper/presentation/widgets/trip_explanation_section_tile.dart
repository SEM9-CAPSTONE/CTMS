import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/trip_recommendation.dart';

const _kindIcons = <String, IconData>{
  'trip_type': Icons.cabin_outlined,
  'fitness': Icons.favorite_outline,
  'difficulty': Icons.terrain_outlined,
  'route': Icons.route_outlined,
  'health_note': Icons.health_and_safety_outlined,
  'allergy': Icons.eco_outlined,
  'diet': Icons.restaurant_outlined,
  'age': Icons.cake_outlined,
  'interest': Icons.auto_awesome_outlined,
  'experience': Icons.hiking_outlined,
  'region': Icons.place_outlined,
  'price': Icons.sell_outlined,
  'timing': Icons.event_outlined,
  'availability': Icons.confirmation_number_outlined,
};

class TripExplanationSectionTile extends StatelessWidget {
  const TripExplanationSectionTile({required this.section});

  final TripRecommendationExplanationSection section;

  @override
  Widget build(BuildContext context) {
    final (background, foreground, badge) = switch (section.tone) {
      ExplanationTone.match => (
        AppColors.brandPrimary.withValues(alpha: 0.06),
        AppColors.brandPrimary,
        'Phù hợp',
      ),
      ExplanationTone.caution => (
        Colors.amber.withValues(alpha: 0.12),
        Colors.brown.shade800,
        'Cần lưu ý',
      ),
      ExplanationTone.info => (
        AppColors.border.withValues(alpha: 0.25),
        AppColors.textPrimary,
        'Thông tin',
      ),
    };
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.cardBorderRadius,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            _kindIcons[section.kind] ?? Icons.info_outline,
            size: 20,
            color: foreground,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${section.title} · $badge',
                  style: AppTypography.bodyStrong.copyWith(color: foreground),
                ),
                if (section.quote case final quote?) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.8),
                      borderRadius: AppRadius.cardBorderRadius,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(quote.caption, style: AppTypography.caption),
                        Text(
                          '“${quote.text}”',
                          style: AppTypography.bodyStrong.copyWith(
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.xs),
                Text(section.detail, style: AppTypography.body),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
