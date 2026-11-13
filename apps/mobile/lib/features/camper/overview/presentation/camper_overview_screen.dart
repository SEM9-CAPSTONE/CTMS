import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_empty_state.dart';
import '../../../../core/widgets/ctms_error_state.dart';
import '../../../../core/widgets/ctms_scaffold.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/domain/auth_user.dart';
import '../application/camper_overview_controller.dart';
import '../data/camper_overview_repository.dart';
import 'camper_overview_strings.dart';
import 'widgets/camper_overview_hero.dart';
import 'widgets/camper_overview_preparation_card.dart';
import 'widgets/camper_overview_skeleton.dart';
import 'widgets/camper_overview_trip_card.dart';
import '../../presentation/camper_trip_detail_screen.dart';

class CamperOverviewScreen extends ConsumerWidget {
  const CamperOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overviewAsync = ref.watch(camperOverviewProvider);
    final user = ref.watch(authControllerProvider).valueOrNull;
    final userName = user?.displayName ?? 'Camper';

    final now = DateTime.now();
    final hour = now.hour;
    final greetingPrefix = hour < 12
        ? 'Chào buổi sáng'
        : (hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối');
    final greeting = '$greetingPrefix, $userName!';
    final dateLabel =
        '${now.day.toString().padLeft(2, '0')}/${now.month.toString().padLeft(2, '0')}/${now.year}';

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
              // Lời chào cá nhân hóa & Điều hướng nhanh
              CamperOverviewHero(
                dateLabel: dateLabel,
                greeting: greeting,
                onExplore: () => context.go('/camper/explore'),
                onViewTrips: () => context.go('/camper/trips'),
              ),
              const SizedBox(height: AppSpacing.xxl),

              // 1. Chuyến đi sắp tới
              Text(
                'Chuyến đi sắp tới',
                style: AppTypography.h3.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (overview.upcomingTrip case final trip?) ...[
                CamperOverviewTripCard(
                  trip: trip,
                  onViewDetail: () {
                    final booking = ref.read(camperOverviewRepositoryProvider).activeBooking;
                    final tripId = booking?.tripId;
                    if (tripId == null || tripId.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Không tìm thấy mã chuyến đi.')),
                      );
                      return;
                    }
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => CamperTripDetailScreen(
                          trip: trip,
                          tripId: tripId,
                          booking: booking,
                        ),
                      ),
                    );
                  },
                ),
                if (overview.preparationItems.isNotEmpty) ...[
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
                ],
              ] else
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
            ],
          ),
        ),
      ),
    );
  }
}
