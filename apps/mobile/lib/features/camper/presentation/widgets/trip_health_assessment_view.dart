import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/trip_health_assessment.dart';
import '../../domain/trip_recommendation.dart';
import 'trip_explanation_section_tile.dart';
import '../camper_profile_screen.dart';

class TripHealthAssessmentView extends StatelessWidget {
  const TripHealthAssessmentView({
    super.key,
    required this.assessment,
    this.compact = false,
  });
  final TripHealthAssessment assessment;
  final bool compact;
  @override
  Widget build(BuildContext context) {
    final comparisons = assessment.comparisons
        .where((item) => item.result == 'match' || item.result == 'caution')
        .toList();
    if (comparisons.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.md),
      child: Column(
        children: [
          for (final item in comparisons)
            TripExplanationSectionTile(
              section: TripRecommendationExplanationSection(
                kind: 'fitness',
                tone: item.result == 'match'
                    ? ExplanationTone.match
                    : ExplanationTone.caution,
                title: item.label,
                quote: compact
                    ? null
                    : ExplanationQuote(
                        source: 'Hồ sơ sức khỏe',
                        field: item.label,
                        text: item.profileValue,
                      ),
                detail: 'Chuyến yêu cầu: ${item.tripValue}',
              ),
            ),
        ],
      ),
    );
  }
}

class RecommendationHealthBasisView extends StatelessWidget {
  const RecommendationHealthBasisView({
    super.key,
    required this.basis,
    this.onReturn,
  });
  final RecommendationHealthBasis basis;
  final VoidCallback? onReturn;
  @override
  Widget build(BuildContext context) {
    final activity = basis.activityProfile;
    final details = [
      'Thể lực: ${basis.fitnessLevel}.',
      activity?.comfortableDistanceKm == null
          ? 'Chưa khai báo quãng đường đi bộ.'
          : 'Đi bộ quen thuộc: ${activity!.comfortableDistanceKm} km/ngày.',
      activity?.comfortableWalkingMinutes == null
          ? 'Chưa khai báo thời gian đi bộ.'
          : '${activity!.comfortableWalkingMinutes} phút/ngày.',
    ].join(' ');
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.border),
        borderRadius: AppRadius.cardBorderRadius,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text('Hồ sơ sức khỏe đã dùng', style: AppTypography.bodyStrong),
              TextButton(
                onPressed: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const CamperProfileScreen(initialTab: 1),
                    ),
                  );
                  if (context.mounted) onReturn?.call();
                },
                child: const Text('Cập nhật khả năng vận động'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(details, style: AppTypography.body),
        ],
      ),
    );
  }
}
