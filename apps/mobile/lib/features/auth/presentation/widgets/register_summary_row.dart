import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';

/// A single label/value line in the Step 5 recap — shared by
/// [RegisterVerificationStep] and [RegisterPorterCoverageSummary].
class RegisterSummaryRow extends StatelessWidget {
  const RegisterSummaryRow({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(label, style: AppTypography.caption.copyWith(color: AppColors.textMuted)),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? '—' : value,
              textAlign: TextAlign.end,
              style: AppTypography.bodyStrong,
            ),
          ),
        ],
      ),
    );
  }
}
