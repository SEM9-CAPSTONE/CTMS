import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_radius.dart';
import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../../../../../core/widgets/ctms_button.dart';
import '../../../../../core/widgets/ctms_status_badge.dart';
import '../../domain/camper_overview_models.dart';

/// "Chuyến đi sắp tới" card — pure white card with subtle border and shadow matching /camper/explore.
class CamperOverviewTripCard extends StatelessWidget {
  const CamperOverviewTripCard({
    super.key,
    required this.trip,
    required this.onViewDetail,
  });

  final UpcomingTrip trip;
  final VoidCallback onViewDetail;

  static final _dateFormat = DateFormat('dd/MM/yyyy');

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onViewDetail,
      borderRadius: AppRadius.cardBorderRadius,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.cardPadding),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: AppRadius.cardBorderRadius,
          border: Border.all(color: AppColors.border, width: 1.0),
          boxShadow: AppColors.cardShadowSm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    trip.name,
                    style: AppTypography.h3.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                CtmsStatusBadge(
                  label: trip.statusLabel,
                  status: CtmsStatus.success,
                  showDot: true,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.calendar_today_outlined, size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(
                  '${_dateFormat.format(trip.startDate)} • ${trip.durationDays} ngày',
                  style: AppTypography.body.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                const Icon(Icons.person_pin_outlined, size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(
                  'Porter: ${trip.porterName}',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.group_outlined, size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(
                  '${trip.memberCount} thành viên • Độ khó: ${trip.difficulty}',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
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
                  child: Row(
                    children: [
                      const Icon(Icons.sync_outlined, size: 16, color: AppColors.brandPrimary),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          'Đồng bộ ngoại tuyến (15 GPS, 1 sự cố)',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.brandPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                CtmsButton(
                  label: 'Xem chi tiết',
                  variant: CtmsButtonVariant.primary,
                  onPressed: onViewDetail,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
