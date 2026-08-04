import 'package:flutter/material.dart';

import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../../../../../core/widgets/ctms_progress_bar.dart';
import '../../../../../core/widgets/ctms_section_card.dart';
import '../../../../../core/widgets/ctms_status_badge.dart';
import '../../domain/camper_overview_models.dart';
import '../camper_overview_strings.dart';
import '../overview_severity_x.dart';

/// "Chuẩn bị trước chuyến đi 68%" — a progress bar plus 5 checklist lines,
/// each with a trailing status pill (Xong/Đã tải = success, Chưa tải =
/// danger, Chưa xác nhận = neutral).
class CamperOverviewPreparationCard extends StatelessWidget {
  const CamperOverviewPreparationCard({super.key, required this.progress, required this.items});

  final double progress;
  final List<PreparationItem> items;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return CtmsSectionCard(
      title: CamperOverviewStrings.preparationTitle((progress * 100).round()),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CtmsProgressBar(progress: progress),
          const SizedBox(height: AppSpacing.lg),
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: Text(
                    items[i].label,
                    style: AppTypography.body.copyWith(color: scheme.onSurface),
                  ),
                ),
                CtmsStatusBadge(label: items[i].statusLabel, status: items[i].severity.ctmsStatus),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
