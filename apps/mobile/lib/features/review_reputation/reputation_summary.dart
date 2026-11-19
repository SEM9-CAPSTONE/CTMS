import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import 'review_reputation.dart';

class ReputationSummary extends StatelessWidget {
  const ReputationSummary({super.key, this.value});
  final ReviewReputation? value;
  @override
  Widget build(BuildContext context) {
    final rating = value;
    if (rating == null) return const SizedBox.shrink();
    return Semantics(
      label: rating.semantics,
      excludeSemantics: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.star_outline_rounded,
            size: 20,
            color: AppColors.statusWarning,
          ),
          const SizedBox(width: AppSpacing.xs),
          Expanded(child: Text(rating.label, style: AppTypography.bodyStrong)),
        ],
      ),
    );
  }
}
