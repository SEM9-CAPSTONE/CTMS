import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/ctms_error_state.dart';
import '../../../../core/widgets/ctms_empty_state.dart';
import '../../../auth/application/auth_controller.dart';
import '../application/camper_overview_controller.dart';
import 'camper_overview_strings.dart';
import 'widgets/camper_overview_hero.dart';
import 'widgets/camper_overview_notices_card.dart';
import 'widgets/camper_overview_preparation_card.dart';
import 'widgets/camper_overview_quick_actions.dart';
import 'widgets/camper_overview_skeleton.dart';
import 'widgets/camper_overview_suggestions_section.dart';
import 'widgets/camper_overview_transactions_card.dart';
import 'widgets/camper_overview_trip_card.dart';
import 'widgets/camper_overview_weather_card.dart';

const _weekdayNames = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật',
];

/// Figma frame #23 "Tổng quan — Camper Hub"
/// (`docs/design/FIGMA-SCREEN-INVENTORY.md`). Desktop stacks a hero + main
/// column + a 320px right rail; per the PROMPT 1 conversion rules the rail
/// ("Thông báo quan trọng") becomes a section under the hero instead, and
/// everything else stays in reading order.
class CamperOverviewScreen extends ConsumerWidget {
  const CamperOverviewScreen({super.key});

  String _dateLabel(DateTime now) {
    final weekday = _weekdayNames[now.weekday - 1];
    final day = now.day.toString().padLeft(2, '0');
    final month = now.month.toString().padLeft(2, '0');
    return '$weekday, $day/$month/${now.year}';
  }

  String _greeting(String name) {
    final hour = DateTime.now().hour;
    final timeOfDay = hour < 11 ? 'sáng' : (hour < 18 ? 'chiều' : 'tối');
    return CamperOverviewStrings.greeting(timeOfDay, name);
  }

  void _showComingSoon(BuildContext context) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Tính năng đang được phát triển')));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overviewAsync = ref.watch(camperOverviewProvider);
    final user = ref.watch(authControllerProvider).valueOrNull;
    final fullName = (user?.fullName ?? user?.email ?? '').trim();
    final firstName = fullName.isEmpty ? 'bạn' : fullName.split(' ').last;

    return Scaffold(
      appBar: AppBar(title: const Text(CamperOverviewStrings.appBarTitle)),
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
              CamperOverviewHero(
                dateLabel: _dateLabel(DateTime.now()),
                greeting: _greeting(firstName),
                onExplore: () => context.go('/camper/explore'),
                onViewTrips: () => context.go('/camper/trips'),
              ),
              const SizedBox(height: AppSpacing.lg),
              CamperOverviewNoticesCard(
                notices: overview.notices,
                onSeeAll: () => _showComingSoon(context),
              ),
              const SizedBox(height: AppSpacing.lg),
              if (overview.upcomingTrip case final trip?)
                CamperOverviewTripCard(
                  trip: trip,
                  onViewDetail: () => _showComingSoon(context),
                )
              else
                const CtmsEmptyState(
                  icon: Icons.hiking_outlined,
                  title: CamperOverviewStrings.emptyUpcomingTripTitle,
                  message: CamperOverviewStrings.emptyUpcomingTripMessage,
                ),
              const SizedBox(height: AppSpacing.lg),
              CamperOverviewPreparationCard(
                progress: overview.preparationProgress,
                items: overview.preparationItems,
              ),
              const SizedBox(height: AppSpacing.lg),
              CamperOverviewQuickActions(
                onGuideCenter: () => _showComingSoon(context),
                onMyTrips: () => context.go('/camper/trips'),
                onAiSupport: () => context.go('/camper/ai'),
                onUpdateProfile: () => context.go('/camper/profile'),
              ),
              const SizedBox(height: AppSpacing.lg),
              CamperOverviewWeatherCard(
                snapshot: overview.weatherRisk,
                onDetail: () => _showComingSoon(context),
              ),
              const SizedBox(height: AppSpacing.lg),
              CamperOverviewTransactionsCard(
                transactions: overview.recentTransactions,
                onSeeAll: () => _showComingSoon(context),
              ),
              const SizedBox(height: AppSpacing.lg),
              CamperOverviewSuggestionsSection(suggestions: overview.suggestions),
            ],
          ),
        ),
      ),
    );
  }
}
