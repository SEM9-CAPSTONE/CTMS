import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';

/// A compact "label ..... value" line, caption-sized — for dense card
/// content (e.g. a `DataTable`-turned-card's extra fields) where a full
/// body-sized summary row would be too tall.
///
/// ```dart
/// CtmsKeyValueRow(label: 'Ngày lưu trú', value: '20/07/2026')
/// ```
class CtmsKeyValueRow extends StatelessWidget {
  const CtmsKeyValueRow({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Text(label, style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant)),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: AppTypography.caption.copyWith(
                color: scheme.onSurface,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
