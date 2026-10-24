import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_empty_state.dart';
import '../../../../core/widgets/ctms_error_state.dart';
import '../../../../core/widgets/ctms_scaffold.dart';
import '../application/camper_overview_controller.dart';
import 'camper_overview_strings.dart';
import 'widgets/camper_overview_preparation_card.dart';
import 'widgets/camper_overview_skeleton.dart';
import 'widgets/camper_overview_suggestions_section.dart';
import 'widgets/camper_overview_transactions_card.dart';
import 'widgets/camper_overview_trip_card.dart';
import 'widgets/camper_overview_weather_card.dart';
import '../../presentation/camper_trip_detail_screen.dart';

class CamperOverviewScreen extends ConsumerWidget {
  const CamperOverviewScreen({super.key});

  void _showComingSoon(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Tính năng đang được phát triển')),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overviewAsync = ref.watch(camperOverviewProvider);

    return CtmsScaffold(
      title: 'Tổng quan',
      subtitle: 'Thông tin hành trình & hoạt động camper',
      body: overviewAsync.when(
        loading: () => const CamperOverviewSkeleton(),
        error: (error, _) => Center(
          child: CtmsErrorState(
            message: CamperOverviewStrings.errorMessage,
            onRetry: () => ref.invalidate(camperOverviewProvider),
          ),
        ),
        data: (overview) => RefreshIndicator(
          onRefresh: () => ref.refresh(camperOverviewProvider.future),
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.xxl),
            children: [
              // 1. Chuyến đi sắp tới
              Text(
                'Chuyến đi sắp tới',
                style: AppTypography.h3.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (overview.upcomingTrip case final trip?)
                CamperOverviewTripCard(
                  trip: trip,
                  onViewDetail: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => CamperTripDetailScreen(
                          trip: trip,
                          tripId: 'a1736fee-62be-4991-9478-a62288e9b80a',
                        ),
                      ),
                    );
                  },
                )
              else
                Container(
                  padding: const EdgeInsets.all(AppSpacing.xxl),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: AppRadius.cardBorderRadius,
                    border: Border.all(color: AppColors.border),
                    boxShadow: AppColors.cardShadowSm,
                  ),
                  child: const CtmsEmptyState(
                    icon: Icons.hiking_outlined,
                    title: CamperOverviewStrings.emptyUpcomingTripTitle,
                    message: CamperOverviewStrings.emptyUpcomingTripMessage,
                  ),
                ),

              const SizedBox(height: AppSpacing.xl),

              // 2. Chuẩn bị trước chuyến đi
              Text(
                'Chuẩn bị trước chuyến đi',
                style: AppTypography.h3.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              CamperOverviewPreparationCard(
                progress: overview.preparationProgress,
                items: overview.preparationItems,
              ),

              const SizedBox(height: AppSpacing.xl),

              // 3. Dự báo thời tiết & Rủi ro
              Text(
                'Dự báo thời tiết & Rủi ro',
                style: AppTypography.h3.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              CamperOverviewWeatherCard(
                snapshot: overview.weatherRisk,
                onDetail: () => _showComingSoon(context),
              ),

              const SizedBox(height: AppSpacing.xl),

              // 4. Giao dịch gần đây
              CamperOverviewTransactionsCard(
                transactions: overview.recentTransactions,
                onSeeAll: () => _showComingSoon(context),
              ),

              const SizedBox(height: AppSpacing.xl),

              // 5. Gợi ý chuyến đi
              CamperOverviewSuggestionsSection(
                suggestions: overview.suggestions,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
