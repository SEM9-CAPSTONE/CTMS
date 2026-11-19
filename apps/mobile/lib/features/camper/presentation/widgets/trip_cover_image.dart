import 'package:flutter/material.dart';

import '../../../../core/env/env.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';

class TripCoverImage extends StatelessWidget {
  const TripCoverImage({
    super.key,
    required this.tripTitle,
    this.imageUrl,
    this.fit = BoxFit.cover,
    this.aspectRatio = 16 / 9,
  });

  final String tripTitle;
  final String? imageUrl;
  final BoxFit fit;
  final double? aspectRatio;

  @override
  Widget build(BuildContext context) {
    final source = imageUrl?.trim();
    final image = source == null || source.isEmpty
        ? _placeholder('Chưa có ảnh chuyến đi')
        : Image.network(
            Uri.parse(Env.apiBaseUrl).resolve(source).toString(),
            fit: fit,
            semanticLabel: 'Ảnh chuyến đi: $tripTitle',
            // External image hosts may not allow canvas image requests on web.
            webHtmlElementStrategy: WebHtmlElementStrategy.fallback,
            errorBuilder: (_, _, _) =>
                _placeholder('Không tải được ảnh chuyến đi'),
          );
    return ClipRRect(
      borderRadius: AppRadius.controlBorderRadius,
      child: aspectRatio == null
          ? image
          : AspectRatio(aspectRatio: aspectRatio!, child: image),
    );
  }

  Widget _placeholder(String message) => LayoutBuilder(
    builder: (_, constraints) {
      if (constraints.maxWidth < 160 || constraints.maxHeight < 120) {
        return ColoredBox(
          color: AppColors.surfaceMuted,
          child: Center(
            child: Icon(
              Icons.landscape_outlined,
              color: AppColors.textMuted,
              semanticLabel: message,
            ),
          ),
        );
      }
      return _fullPlaceholder(message);
    },
  );

  Widget _fullPlaceholder(String message) => ColoredBox(
    color: AppColors.surfaceMuted,
    child: Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ExcludeSemantics(
              child: Icon(Icons.landscape_outlined, color: AppColors.textMuted),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    ),
  );
}
