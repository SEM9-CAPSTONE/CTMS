import 'package:flutter/material.dart';

import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../../domain/campsite_search_models.dart';

/// CTMS-17-T02 (mobile). Pure presentation -- [disabled] is driven by the
/// controller's `isLoading` (BR-241): paging during an in-flight request
/// would race a second concurrent `GET /campsites`.
class CampsitePaginationBar extends StatelessWidget {
  const CampsitePaginationBar({
    super.key,
    required this.pagination,
    required this.disabled,
    required this.onPageChanged,
  });

  final CampsiteSearchPagination pagination;
  final bool disabled;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final totalPages = pagination.totalPages < 1 ? 1 : pagination.totalPages;
    final canGoPrevious = !disabled && pagination.page > 1;
    final canGoNext = !disabled && pagination.page < pagination.totalPages;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          'Tổng cộng ${pagination.total} campsite',
          style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
        ),
        Row(
          children: [
            IconButton(
              tooltip: 'Trang trước',
              icon: const Icon(Icons.chevron_left),
              onPressed: canGoPrevious ? () => onPageChanged(pagination.page - 1) : null,
            ),
            Text('Trang ${pagination.page} / $totalPages', style: AppTypography.caption),
            const SizedBox(width: AppSpacing.xs),
            IconButton(
              tooltip: 'Trang sau',
              icon: const Icon(Icons.chevron_right),
              onPressed: canGoNext ? () => onPageChanged(pagination.page + 1) : null,
            ),
          ],
        ),
      ],
    );
  }
}
