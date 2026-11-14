import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_button.dart';
import '../../data/trip_recommendations_api.dart';
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

/// "Vì sao gợi ý chuyến này cho bạn" on a Trip opened from the suggestions. Renders nothing when
/// the Trip is not in the Camper's latest suggestions.
class TripRecommendationExplanationCard extends ConsumerWidget {
  const TripRecommendationExplanationCard({super.key, required this.tripId});

  final String tripId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final explanation = ref.watch(
      tripRecommendationExplanationProvider(tripId),
    );
    if (explanation case AsyncData(value: null)) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.lg),
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.auto_awesome_rounded,
                color: AppColors.brandPrimary,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Vì sao gợi ý chuyến này cho bạn',
                  style: AppTypography.h3,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          ...explanation.when(
            loading: () => const [
              Center(
                child: CircularProgressIndicator(
                  semanticsLabel: 'Đang tải lý do gợi ý',
                ),
              ),
            ],
            error: (_, _) => [
              Text(
                'Không tải được lý do gợi ý.',
                style: AppTypography.bodyStrong,
              ),
              const SizedBox(height: AppSpacing.sm),
              CtmsButton(
                label: 'Thử lại',
                onPressed: () => ref.invalidate(
                  tripRecommendationExplanationProvider(tripId),
                ),
              ),
            ],
            data: (value) => [
              for (final section in value!.sections)
                _SectionTile(section: section),
              if (value.summary.isNotEmpty)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.brandPrimary,
                    borderRadius: AppRadius.cardBorderRadius,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Kết luận',
                        style: AppTypography.caption.copyWith(
                          color: Colors.white.withValues(alpha: 0.8),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        value.summary,
                        style: AppTypography.bodyStrong.copyWith(
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              if (!value.healthConsidered)
                Text(
                  'Bật chia sẻ hồ sơ sức khỏe để gợi ý xét thêm thể lực, bệnh nền và dị ứng của bạn. '
                  'Thông tin sức khỏe chỉ được dùng trong hệ thống, không gửi cho dịch vụ AI.',
                  style: AppTypography.caption,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SectionTile extends StatelessWidget {
  const _SectionTile({required this.section});

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
                if (section.conclusion case final conclusion?) ...[
                  const SizedBox(height: 2),
                  Text(
                    '→ $conclusion',
                    style: AppTypography.bodyStrong.copyWith(color: foreground),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
