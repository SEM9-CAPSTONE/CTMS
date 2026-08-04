import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';

/// §2.4 StatCard (KPI). Caller is responsible for zero-padding small counts
/// (`01`, `04`, `12`) and comma-grouping large ones (`1,284`) per
/// `docs/design/CTMS-DESIGN-SYSTEM.md` §4.
///
/// ```dart
/// CtmsStatCard(label: 'Chuyến hôm nay', value: '01')
/// CtmsStatCard(
///   label: 'Cảnh báo cần xử lý',
///   value: '03',
///   valueColor: AppColors.statusWarning,
///   icon: Icons.warning_amber_outlined,
/// )
/// CtmsStatCard(label: 'Tổng đơn hôm nay', value: '24', delta: '-12%')
/// ```
class CtmsStatCard extends StatelessWidget {
  const CtmsStatCard({
    super.key,
    required this.label,
    required this.value,
    this.delta,
    this.icon,
    this.valueColor,
  });

  final String label;
  final String value;
  final String? delta;
  final IconData? icon;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final deltaColor = delta == null
        ? scheme.onSurfaceVariant
        : delta!.startsWith('-')
        ? AppColors.statusDanger
        : delta!.startsWith('+')
        ? AppColors.statusSuccess
        : scheme.onSurfaceVariant;

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
                  label.toUpperCase(),
                  style: AppTypography.label.copyWith(color: scheme.onSurfaceVariant),
                ),
              ),
              if (icon != null) Icon(icon, size: 18, color: scheme.onSurfaceVariant),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                value,
                style: AppTypography.display.copyWith(color: valueColor ?? scheme.onSurface),
              ),
              if (delta != null) ...[
                const SizedBox(width: AppSpacing.sm),
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(delta!, style: AppTypography.caption.copyWith(color: deltaColor)),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
