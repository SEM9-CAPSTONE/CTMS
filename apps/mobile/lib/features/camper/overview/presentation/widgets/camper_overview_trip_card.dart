import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../../core/theme/app_radius.dart';
import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../../../../../core/widgets/ctms_button.dart';
import '../../../../../core/widgets/ctms_status_badge.dart';
import '../../domain/camper_overview_models.dart';
import '../camper_overview_strings.dart';

/// "Chuyến đi sắp tới" card — status badge, trip name/date, a 2×2 info
/// grid, and the primary CTA into the trip's detail page (not built yet).
class CamperOverviewTripCard extends StatelessWidget {
  const CamperOverviewTripCard({super.key, required this.trip, required this.onViewDetail});

  final UpcomingTrip trip;
  final VoidCallback onViewDetail;

  static final _dateFormat = DateFormat('dd/MM/yyyy');

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: scheme.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  CamperOverviewStrings.upcomingTripTitle,
                  style: AppTypography.h3.copyWith(color: scheme.onSurface),
                ),
              ),
              CtmsStatusBadge(label: trip.statusLabel, status: CtmsStatus.info),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(trip.name, style: AppTypography.bodyStrong.copyWith(color: scheme.onSurface)),
          const SizedBox(height: 2),
          Text(
            '${_dateFormat.format(trip.startDate)} · ${trip.durationDays} ngày',
            style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              _InfoCell(
                label: CamperOverviewStrings.memberCountLabel,
                value: '${trip.memberCount}',
              ),
              _InfoCell(label: CamperOverviewStrings.difficultyLabel, value: trip.difficulty),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              _InfoCell(
                label: CamperOverviewStrings.porterInChargeLabel,
                value: trip.porterName,
              ),
              _InfoCell(
                label: CamperOverviewStrings.weatherRiskLabel,
                value: trip.weatherRiskLabel,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: double.infinity,
            child: CtmsButton(
              label: CamperOverviewStrings.viewTripDetailCta,
              onPressed: onViewDetail,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoCell extends StatelessWidget {
  const _InfoCell({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: AppTypography.label.copyWith(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: 2),
          Text(value, style: AppTypography.bodyStrong.copyWith(color: scheme.onSurface)),
        ],
      ),
    );
  }
}
