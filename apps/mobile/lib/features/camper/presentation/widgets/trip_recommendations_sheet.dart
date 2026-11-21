import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_button.dart';
import '../../../../core/widgets/ctms_empty_state.dart';
import '../../data/trip_recommendations_api.dart';
import '../../domain/published_trip.dart';
import 'trip_preferences_sheet.dart';
import 'health_consent_required.dart';

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
        const SizedBox(height: AppSpacing.lg),
        if (recommendations.valueOrNull != null &&
            recommendations.valueOrNull?.needsPreferences != true &&
            recommendations.valueOrNull?.needsHealthConsent != true) ...[
          CtmsButton(
            label: 'Tạo lại gợi ý chuyến đi',
            isLoading: recommendations.isLoading,
            onPressed: recommendations.isLoading
                ? null
                : () async {
                    final created = await ref
                        .read(tripRecommendationsProvider.notifier)
                        .regenerate();
                    if (!context.mounted) return;
                    if (created) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Đã tạo lại gợi ý từ hồ sơ mới nhất của bạn.',
                          ),
                        ),
                      );
                    } else if (ref.read(tripRecommendationsProvider).hasError) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Không thể tạo lại gợi ý chuyến đi. Vui lòng thử lại.',
                          ),
                        ),
                      );
                    }
                  },
          ),
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: recommendations.isLoading
                  ? null
                  : () => _updatePreferences(context, ref),
              icon: const Icon(Icons.tune_rounded),
              label: const Text('Sửa sở thích'),
            ),
          ),
        ],
        ...recommendations.when(
          skipLoadingOnRefresh: false,
          skipLoadingOnReload: false,
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
            if (result.needsHealthConsent)
              HealthConsentRequired(
                onRetry: () => ref.invalidate(tripRecommendationsProvider),
              )
            else if (result.needsPreferences)
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
              KeyedSubtree(
                key: ValueKey('recommended-${item.trip.id}'),
                child: tripCardBuilder(item.trip),
              ),
            ],
          ],
        ),
      ],
    );
  }
}
