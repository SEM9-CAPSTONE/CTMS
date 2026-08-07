import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';

/// §2.11 ChecklistCard row — 16px box (done = solid `status.success` + white
/// check, pending = empty `border.strong` outline) + label.
///
/// ```dart
/// CtmsChecklistItem(label: 'Danh sách thành viên', isDone: true)
/// CtmsChecklistItem(
///   label: 'Dữ liệu ngoại tuyến',
///   isDone: false,
///   onTap: () => markDone('offline_data'),
/// )
/// ```
class CtmsChecklistItem extends StatelessWidget {
  const CtmsChecklistItem({super.key, required this.label, required this.isDone, this.onTap});

  final String label;
  final bool isDone;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final row = Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 16,
          height: 16,
          decoration: BoxDecoration(
            color: isDone ? AppColors.statusSuccess : Colors.transparent,
            borderRadius: const BorderRadius.all(Radius.circular(4)),
            border: isDone ? null : Border.all(color: AppColors.borderStrong),
          ),
          child: isDone ? const Icon(Icons.check, size: 12, color: Colors.white) : null,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            label,
            style: AppTypography.body.copyWith(
              color: isDone ? AppColors.textPrimary : AppColors.textSecondary,
            ),
          ),
        ),
      ],
    );

    if (onTap == null) return row;
    return InkWell(onTap: onTap, child: Padding(padding: EdgeInsets.zero, child: row));
  }
}
