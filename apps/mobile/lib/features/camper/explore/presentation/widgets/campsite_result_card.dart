import 'package:flutter/material.dart';

import '../../../../../core/theme/app_radius.dart';
import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../../domain/campsite_search_models.dart';

/// CTMS-17-T02 (mobile) / BR-048 field fidelity: renders exactly what
/// CampsiteSearchItemDto carries -- name, location, cover image. No price
/// (that's a filter input, not a result field), no rating, no safety
/// badge (Figma Frame #21 has them, the backend doesn't). No "active
/// routes" section either: `activeRoutes` is always `[]` today, so there
/// is nothing real to show -- a placeholder for it would fabricate a
/// feature that doesn't exist yet.
class CampsiteResultCard extends StatelessWidget {
  const CampsiteResultCard({super.key, required this.campsite});

  final CampsiteSearchItem campsite;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final coverImage = campsite.coverImage;

    return Container(
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: scheme.outline),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 96,
            width: double.infinity,
            child: coverImage == null
                ? _CoverPlaceholder(scheme: scheme)
                : Image.network(
                    coverImage,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) => _CoverPlaceholder(scheme: scheme),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  campsite.name,
                  style: AppTypography.bodyStrong.copyWith(color: scheme.onSurface),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Icon(Icons.location_on_outlined, size: 14, color: scheme.onSurfaceVariant),
                    const SizedBox(width: 2),
                    Expanded(
                      child: Text(
                        campsite.location.province,
                        style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CoverPlaceholder extends StatelessWidget {
  const _CoverPlaceholder({required this.scheme});

  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: scheme.surfaceContainerHighest,
      child: Icon(Icons.terrain_outlined, size: 32, color: scheme.onSurfaceVariant),
    );
  }
}
