import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';

/// §2.7 FilterBar chip row — active chip = solid `brand.primary` on white
/// text, inactive = `surface.muted` pill with `border`.
///
/// ```dart
/// CtmsFilterChipRow(
///   options: const ['Tất cả', 'Bình thường', 'Cần chú ý', 'Ngoại tuyến'],
///   selected: selectedFilter,
///   onSelected: (value) => setState(() => selectedFilter = value),
/// )
/// ```
class CtmsFilterChipRow extends StatelessWidget {
  const CtmsFilterChipRow({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
  });

  final List<String> options;
  final String selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: options.length,
        separatorBuilder: (context, _) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (context, index) {
          final option = options[index];
          final isSelected = option == selected;

          return GestureDetector(
            onTap: () => onSelected(option),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isSelected ? AppColors.brandPrimary : AppColors.surfaceMuted,
                borderRadius: AppRadius.pillBorderRadius,
                border: Border.all(
                  color: isSelected ? AppColors.brandPrimary : AppColors.border,
                ),
              ),
              child: Text(
                option,
                style: AppTypography.caption.copyWith(
                  color: isSelected ? Colors.white : AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
