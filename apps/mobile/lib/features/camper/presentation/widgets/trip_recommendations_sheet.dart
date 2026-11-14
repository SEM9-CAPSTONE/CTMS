import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_button.dart';
import '../../../../core/widgets/ctms_empty_state.dart';
import '../../data/trip_recommendations_api.dart';
import '../../domain/published_trip.dart';
import 'trip_preferences_sheet.dart';

/// Opens "Gợi ý cho bạn". Suggestions are only requested while this sheet is open; each opening
/// asks the server again (it reuses its AI order while the Camper's profile is unchanged).
Future<void> showTripRecommendationsSheet(
  BuildContext context, {
  required Widget Function(PublishedTrip trip) tripCardBuilder,
}) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  builder: (_) => FractionallySizedBox(
    heightFactor: 0.9,
    child: TripRecommendationsSheet(tripCardBuilder: tripCardBuilder),
  ),
);

class TripRecommendationsSheet extends ConsumerWidget {
  const TripRecommendationsSheet({super.key, required this.tripCardBuilder});

  final Widget Function(PublishedTrip trip) tripCardBuilder;

  Future<void> _updatePreferences(BuildContext context, WidgetRef ref) async {
    if (await showTripPreferencesSheet(context)) {
      ref.invalidate(tripRecommendationsProvider);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recommendations = ref.watch(tripRecommendationsProvider);

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.xxl),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Gợi ý cho bạn',
                style: AppTypography.h2.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
        Text(
          'Dựa trên sở thích, thể lực và những chuyến bạn đã đi.',
          style: AppTypography.caption,
        ),
        const SizedBox(height: AppSpacing.lg),
        if (recommendations.valueOrNull?.needsPreferences != true)
          _RecommendationBasisCard(
            onEdit: () => _updatePreferences(context, ref),
          ),
        ...recommendations.when(
          loading: () => const [
            Padding(
              padding: EdgeInsets.all(AppSpacing.lg),
              child: Center(
                child: CircularProgressIndicator(
                  semanticsLabel: 'Đang tìm chuyến phù hợp với bạn',
                ),
              ),
            ),
          ],
          error: (_, _) => [
            CtmsEmptyState(
              icon: Icons.cloud_off_outlined,
              title: 'Không tải được gợi ý chuyến đi',
              action: CtmsButton(
                label: 'Thử lại',
                onPressed: () => ref.invalidate(tripRecommendationsProvider),
              ),
            ),
          ],
          data: (result) => [
            if (result.needsPreferences)
              CtmsEmptyState(
                icon: Icons.tune_rounded,
                title: 'Cần thêm thông tin để gợi ý',
                message:
                    'Bạn chưa chọn sở thích và chưa có chuyến đi nào trước đây. Hãy cập nhật loại chuyến, độ khó, khu vực hoặc mức giá bạn muốn, rồi hệ thống sẽ gợi ý chuyến phù hợp.',
                action: CtmsButton(
                  label: 'Cập nhật sở thích',
                  onPressed: () => _updatePreferences(context, ref),
                ),
              )
            else if (result.items.isEmpty)
              const CtmsEmptyState(
                icon: Icons.explore_outlined,
                title: 'Chưa có chuyến phù hợp lúc này',
                message:
                    'Các chuyến mới được mở đặt chỗ sẽ xuất hiện khi bạn xem gợi ý lần sau.',
              ),
            for (final item in result.items) ...[
              if (item.reasons.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                  child: Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: [
                      for (final reason in item.reasons)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.sm,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.brandPrimary.withValues(
                              alpha: 0.08,
                            ),
                            borderRadius: AppRadius.cardBorderRadius,
                          ),
                          child: Text(
                            reason,
                            style: AppTypography.caption.copyWith(
                              color: AppColors.brandPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              KeyedSubtree(
                key: ValueKey('recommended-${item.trip.id}'),
                child: tripCardBuilder(item.trip),
              ),
            ],
            if (result.items.isNotEmpty)
              Text(
                'Bấm "Xem chi tiết" để biết vì sao chuyến được gợi ý. Gợi ý không giữ chỗ; số chỗ còn lại được kiểm tra lại khi bạn đặt chỗ.',
                style: AppTypography.caption,
              ),
          ],
        ),
      ],
    );
  }
}

/// What the suggestions are based on. Preferences only move matching Trips up; they never hide
/// one, which is what the search filters are for.
class _RecommendationBasisCard extends ConsumerWidget {
  const _RecommendationBasisCard({required this.onEdit});

  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preferences = ref.watch(tripPreferencesProvider);
    final chips = preferences.valueOrNull == null
        ? const <String>[]
        : preferenceChips(preferences.valueOrNull!);
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.lg),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.brandLightSurface,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Gợi ý đang dựa trên',
                  style: AppTypography.bodyStrong,
                ),
              ),
              TextButton.icon(
                onPressed: onEdit,
                icon: const Icon(Icons.tune_rounded),
                label: const Text('Sửa sở thích'),
              ),
            ],
          ),
          if (preferences.isLoading)
            Text('Đang tải sở thích của bạn...', style: AppTypography.caption)
          else if (preferences.hasError)
            Text(
              'Không tải được sở thích của bạn. Gợi ý vẫn dựa trên hồ sơ và lịch sử chuyến đi.',
              style: AppTypography.caption,
            )
          else if (chips.isEmpty)
            Text(
              'Chưa chọn sở thích — đang gợi ý theo lịch sử chuyến đi và hồ sơ của bạn.',
              style: AppTypography.body,
            )
          else
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                for (final chip in chips)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: AppRadius.cardBorderRadius,
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Text(
                      chip,
                      style: AppTypography.caption.copyWith(
                        color: AppColors.brandPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Sở thích dùng để ưu tiên chuyến phù hợp lên trước, không ẩn chuyến nào. '
            'Muốn lọc chuyến, hãy dùng bộ lọc ở trang khám phá.',
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }
}
