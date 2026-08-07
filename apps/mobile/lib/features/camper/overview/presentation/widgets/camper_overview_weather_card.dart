import 'package:flutter/material.dart';

import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../../../../../core/widgets/ctms_button.dart';
import '../../../../../core/widgets/ctms_section_card.dart';
import '../../../../../core/widgets/ctms_status_badge.dart';
import '../../domain/camper_overview_models.dart';
import '../camper_overview_strings.dart';

/// "Rủi ro thời tiết" card — 4 metrics, an italic advisory callout, and a
/// "Xem chi tiết" link into the full weather-risk screen (not built yet).
class CamperOverviewWeatherCard extends StatelessWidget {
  const CamperOverviewWeatherCard({super.key, required this.snapshot, required this.onDetail});

  final WeatherRiskSnapshot snapshot;
  final VoidCallback onDetail;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return CtmsSectionCard(
      title: CamperOverviewStrings.weatherCardTitle,
      trailing: CtmsStatusBadge(label: snapshot.badgeLabel, status: CtmsStatus.warning),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              _Metric(
                label: CamperOverviewStrings.rainChanceLabel,
                value: '${snapshot.rainChancePercent}%',
              ),
              _Metric(
                label: CamperOverviewStrings.windSpeedLabel,
                value: '${snapshot.windSpeedKmh.toStringAsFixed(0)} km/h',
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              _Metric(
                label: CamperOverviewStrings.temperatureLabel,
                value: snapshot.temperatureRangeLabel,
              ),
              _Metric(
                label: CamperOverviewStrings.visibilityLabel,
                value: '${snapshot.visibilityKm.toStringAsFixed(0)} km',
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            snapshot.note,
            style: AppTypography.caption.copyWith(
              color: scheme.onSurfaceVariant,
              fontStyle: FontStyle.italic,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          CtmsButton(
            label: CamperOverviewStrings.weatherDetailCta,
            variant: CtmsButtonVariant.secondary,
            onPressed: onDetail,
          ),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});

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
