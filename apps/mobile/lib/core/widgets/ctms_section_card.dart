import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';

/// White radius-12 card with a title row — the generic content container
/// used across DetailDrawer/ChecklistCard-style sections (§2.10–2.11).
///
/// ```dart
/// CtmsSectionCard(
///   title: 'Trạng thái chuẩn bị',
///   trailing: Text('6/8', style: AppTypography.caption),
///   child: const CtmsProgressBar(progress: 0.75),
/// )
/// ```
class CtmsSectionCard extends StatelessWidget {
  const CtmsSectionCard({super.key, required this.title, this.trailing, required this.child});

  final String title;
  final Widget? trailing;
  final Widget child;

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
                  title,
                  style: AppTypography.h3.copyWith(color: scheme.onSurface),
                ),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}
