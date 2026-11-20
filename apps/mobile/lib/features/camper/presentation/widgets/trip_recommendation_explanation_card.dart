import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_button.dart';
import '../../../../core/api/api_exception.dart';
import '../../data/trip_recommendations_api.dart';
import '../../domain/trip_recommendation.dart';
import 'health_consent_required.dart';
import 'trip_health_assessment_view.dart';
import 'trip_explanation_section_tile.dart';

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
    if (explanation.error case ApiException(
      statusCode: 403,
      errorData: {'code': 'HEALTH_CONSENT_REQUIRED'},
    )) {
      return HealthConsentRequired(
        onRetry: () =>
            ref.invalidate(tripRecommendationExplanationProvider(tripId)),
      );
    }

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
            skipLoadingOnRefresh: false,
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
              if (value!.healthAssessment != null)
                TripHealthAssessmentView(assessment: value.healthAssessment!),
              for (final section in value.sections)
                if (value.healthAssessment == null || section.kind != 'fitness')
                  TripExplanationSectionTile(section: section),
              if (value.hasDisplaySummary)
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
                  'Bật chia sẻ hồ sơ sức khỏe để gợi ý xét thêm thể lực và bệnh nền của bạn. '
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
