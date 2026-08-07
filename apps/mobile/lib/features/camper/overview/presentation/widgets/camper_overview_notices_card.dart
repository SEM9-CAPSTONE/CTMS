import 'package:flutter/material.dart';

import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../../../../../core/widgets/ctms_section_card.dart';
import '../../../../../core/widgets/ctms_status_badge.dart';
import '../../domain/camper_overview_models.dart';
import '../camper_overview_strings.dart';
import '../overview_severity_x.dart';

/// "Thông báo quan trọng" — a right-rail widget on desktop; per the
/// desktop→mobile rules from PROMPT 1 it becomes a section stacked below
/// the hero instead.
class CamperOverviewNoticesCard extends StatelessWidget {
  const CamperOverviewNoticesCard({super.key, required this.notices, this.onSeeAll});

  final List<OverviewNotice> notices;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    return CtmsSectionCard(
      title: CamperOverviewStrings.noticesTitle,
      trailing: TextButton(
        onPressed: onSeeAll,
        child: const Text(CamperOverviewStrings.noticesSeeAll),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < notices.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.sm),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 6, right: AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: CtmsStatusBadge.colorFor(notices[i].severity.ctmsStatus),
                    shape: BoxShape.circle,
                  ),
                ),
                Expanded(child: Text(notices[i].message, style: AppTypography.body)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
