import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';

/// Generic empty-state body — e.g. an empty booking list or search result.
///
/// ```dart
/// CtmsEmptyState(
///   icon: Icons.explore_outlined,
///   title: 'Chưa có địa điểm nào',
///   message: 'Thử điều chỉnh bộ lọc để xem thêm kết quả.',
///   action: CtmsButton(label: 'Xoá bộ lọc', onPressed: clearFilters),
/// )
/// ```
class CtmsEmptyState extends StatelessWidget {
  const CtmsEmptyState({
    super.key,
    this.icon = Icons.inbox_outlined,
    required this.title,
    this.message,
    this.action,
  });

  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: scheme.onSurfaceVariant),
            const SizedBox(height: AppSpacing.lg),
            Text(
              title,
              textAlign: TextAlign.center,
              style: AppTypography.h3.copyWith(color: scheme.onSurface),
            ),
            if (message != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
              ),
            ],
            if (action != null)
              Padding(padding: const EdgeInsets.only(top: AppSpacing.lg), child: action),
          ],
        ),
      ),
    );
  }
}
