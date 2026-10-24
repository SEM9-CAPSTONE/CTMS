import 'package:flutter/material.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_radius.dart';
import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../../../../../core/widgets/ctms_button.dart';
import '../../../../../core/widgets/ctms_status_badge.dart';
import '../../domain/camper_overview_models.dart';

/// "Rủi ro thời tiết" card — pure white card matching /camper/explore style.
class CamperOverviewWeatherCard extends StatelessWidget {
  const CamperOverviewWeatherCard({
    super.key,
    required this.snapshot,
    required this.onDetail,
  });

  final WeatherRiskSnapshot snapshot;
  final VoidCallback onDetail;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Khu vực Tà Năng – Phan Dũng',
                style: AppTypography.bodyStrong.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              CtmsStatusBadge(label: snapshot.badgeLabel, status: CtmsStatus.warning),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              _Metric(
                label: 'Khả năng mưa',
                value: '${snapshot.rainChancePercent}%',
              ),
              _Metric(
                label: 'Tốc độ gió',
                value: '${snapshot.windSpeedKmh.toStringAsFixed(0)} km/h',
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              _Metric(
                label: 'Nhiệt độ',
                value: snapshot.temperatureRangeLabel,
              ),
              _Metric(
                label: 'Tầm nhìn',
                value: '${snapshot.visibilityKm.toStringAsFixed(0)} km',
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  snapshot.note,
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textSecondary,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              CtmsButton(
                label: 'Xem chi tiết',
                variant: CtmsButtonVariant.secondary,
                onPressed: onDetail,
              ),
            ],
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
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: AppTypography.label.copyWith(
              color: AppColors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: AppTypography.bodyStrong.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
