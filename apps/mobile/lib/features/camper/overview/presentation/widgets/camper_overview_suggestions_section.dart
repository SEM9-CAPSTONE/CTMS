import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_radius.dart';
import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../../../../../core/widgets/ctms_empty_state.dart';
import '../../../../../core/widgets/ctms_status_badge.dart';
import '../../domain/camper_overview_models.dart';
import '../camper_overview_strings.dart';
import '../overview_severity_x.dart';

/// "Gợi ý dành cho bạn" — a horizontally scrolling row of campsite cards,
/// the natural mobile shape for 3 photo cards that sit side by side on
/// desktop.
class CamperOverviewSuggestionsSection extends StatelessWidget {
  const CamperOverviewSuggestionsSection({super.key, required this.suggestions});

  final List<SuggestedCampsite> suggestions;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(CamperOverviewStrings.suggestionsTitle, style: AppTypography.h3),
        const SizedBox(height: AppSpacing.md),
        if (suggestions.isEmpty)
          const CtmsEmptyState(
            icon: Icons.explore_outlined,
            title: CamperOverviewStrings.emptySuggestionsTitle,
          )
        else
          SizedBox(
            height: 216,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: suggestions.length,
              separatorBuilder: (context, _) => const SizedBox(width: AppSpacing.md),
              itemBuilder: (context, index) =>
                  SizedBox(width: 220, child: _SuggestionCard(campsite: suggestions[index])),
            ),
          ),
      ],
    );
  }
}

class _SuggestionCard extends StatelessWidget {
  const _SuggestionCard({required this.campsite});

  final SuggestedCampsite campsite;

  static final _priceFormat = NumberFormat('#,###', 'en_US');

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final price = _priceFormat.format(campsite.pricePerPersonVnd).replaceAll(',', '.');

    return Container(
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: scheme.outline),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              // TODO(assets): swap for the real campsite photo.
              Container(
                height: 92,
                width: double.infinity,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.brandSecondary, AppColors.brandPrimary],
                  ),
                ),
              ),
              Positioned(
                top: AppSpacing.sm,
                right: AppSpacing.sm,
                child: CtmsStatusBadge(
                  label: campsite.badgeLabel,
                  status: campsite.badgeSeverity.ctmsStatus,
                  variant: CtmsBadgeVariant.solid,
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  campsite.name,
                  style: AppTypography.bodyStrong.copyWith(color: scheme.onSurface),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Icon(Icons.location_on_outlined, size: 14, color: scheme.onSurfaceVariant),
                    const SizedBox(width: 2),
                    Expanded(
                      child: Text(
                        campsite.location,
                        style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  '$priceđ${CamperOverviewStrings.perPersonSuffix}',
                  style: AppTypography.bodyStrong.copyWith(color: AppColors.brandPrimary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
