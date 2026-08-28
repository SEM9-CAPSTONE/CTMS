import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_error_state.dart';
import '../../../core/widgets/ctms_loading_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../explore/application/campsite_search_controller.dart';
import '../explore/presentation/widgets/campsite_pagination_bar.dart';
import '../explore/presentation/widgets/campsite_result_card.dart';
import '../explore/presentation/widgets/campsite_search_filters.dart';

/// CTMS-17-T02 (mobile). Real implementation of Figma frame #21 "Khám phá
/// khu cắm trại" (`docs/design/FIGMA-SCREEN-INVENTORY.md`) -- scoped to
/// exactly what CTMS-77's `GET /campsites` contract supports (no
/// date/guest-count/rating/safety-badge/price-map fields, see the
/// Decision Gate this feature was built against).
///
/// Pure composition -- every request (initial load, filter submit/reset,
/// pagination) is driven entirely by campsiteSearchControllerProvider
/// (Step 3); this screen adds no API calls, no extra state, and no
/// business logic of its own. `/camper/*` routing (app_router.dart)
/// already gates this screen to authenticated Camper accounts before it
/// is ever built -- no permission/role check belongs here either.
///
/// The whole page scrolls as one `CustomScrollView` rather than fixing
/// Filters/Pagination and giving results an `Expanded` box: the filter
/// panel (5 fields + 2 buttons) can be taller than the remaining space on
/// a short viewport or with the keyboard open, which overflowed a rigid
/// Expanded layout. A sliver-based scroll has no such fixed budget to
/// overflow.
class CamperExploreScreen extends ConsumerWidget {
  const CamperExploreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(campsiteSearchControllerProvider);
    final controller = ref.read(campsiteSearchControllerProvider.notifier);

    return CtmsScaffold(
      title: 'Khám phá',
      subtitle: 'Tìm địa điểm cho chuyến đi tiếp theo',
      body: CustomScrollView(
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.md,
            ),
            sliver: SliverToBoxAdapter(
              child: CampsiteSearchFilters(
                amenities: state.amenitiesInput,
                minPrice: state.minPriceInput,
                maxPrice: state.maxPriceInput,
                isLoading: state.isLoading,
                onAmenitiesChanged: controller.setAmenitiesInput,
                onMinPriceChanged: controller.setMinPriceInput,
                onMaxPriceChanged: controller.setMaxPriceInput,
                onSubmit: controller.submitFilters,
                onReset: controller.resetFilters,
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            sliver: _ExploreResultsSliver(state: state, onRetry: controller.reload),
          ),
          SliverPadding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            sliver: SliverToBoxAdapter(
              child: CampsitePaginationBar(
                pagination: state.pagination,
                disabled: state.isLoading,
                onPageChanged: controller.setPage,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Loading/error/empty/success as 4 distinct states -- an API failure
/// never gets conflated with a genuine empty result (matches the Web
/// implementation's SearchCampsitesPage.tsx).
class _ExploreResultsSliver extends StatelessWidget {
  const _ExploreResultsSliver({required this.state, required this.onRetry});

  final CampsiteSearchState state;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (state.isLoading) {
      return const SliverToBoxAdapter(
        child: CtmsLoadingState(message: 'Đang tìm kiếm campsite...'),
      );
    }
    if (state.errorMessage != null) {
      return SliverToBoxAdapter(
        child: CtmsErrorState(message: state.errorMessage!, onRetry: onRetry),
      );
    }
    if (state.items.isEmpty) {
      return const SliverToBoxAdapter(
        child: CtmsEmptyState(
          icon: Icons.explore_outlined,
          title: 'Không tìm thấy campsite phù hợp',
          message: 'Hãy thay đổi bộ lọc tìm kiếm và thử lại.',
        ),
      );
    }
    return SliverGrid(
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: AppSpacing.cardGap,
        crossAxisSpacing: AppSpacing.cardGap,
        childAspectRatio: 0.85,
      ),
      delegate: SliverChildBuilderDelegate(
        (context, index) => CampsiteResultCard(campsite: state.items[index]),
        childCount: state.items.length,
      ),
    );
  }
}
