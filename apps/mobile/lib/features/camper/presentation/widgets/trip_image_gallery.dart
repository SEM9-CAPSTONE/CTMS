import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../data/trip_images_api.dart';
import 'trip_cover_image.dart';
import 'trip_image_viewer.dart';

class TripImageGallery extends ConsumerWidget {
  const TripImageGallery({
    super.key,
    required this.tripId,
    required this.tripTitle,
    this.coverImageUrl,
    this.loadImages = false,
  });

  final String tripId;
  final String tripTitle;
  final String? coverImageUrl;
  final bool loadImages;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // List cards fetch their full gallery only when opened.
    final images = loadImages ? ref.watch(tripImagesProvider(tripId)) : null;
    final urls = tripGalleryUrls(coverImageUrl, images?.valueOrNull);

    void open(String? initialImageUrl) => Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => TripImageViewer(
          tripId: tripId,
          tripTitle: tripTitle,
          coverImageUrl: coverImageUrl,
          initialImageUrl: initialImageUrl,
        ),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          button: true,
          label: 'Xem ảnh chuyến đi: $tripTitle',
          child: InkWell(
            borderRadius: AppRadius.controlBorderRadius,
            onTap: () => open(urls.firstOrNull),
            child: ExcludeSemantics(
              child: Stack(
                children: [
                  TripCoverImage(
                    imageUrl: urls.firstOrNull,
                    tripTitle: tripTitle,
                  ),
                  Positioned(
                    right: AppSpacing.sm,
                    bottom: AppSpacing.sm,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm,
                        vertical: AppSpacing.xs,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.65),
                        borderRadius: AppRadius.controlBorderRadius,
                      ),
                      child: Text(
                        images?.hasValue == true && urls.isNotEmpty
                            ? 'Xem ${urls.length} ảnh'
                            : 'Xem ảnh',
                        style: const TextStyle(color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (images?.hasError == true)
          TextButton.icon(
            onPressed: () => ref.invalidate(tripImagesProvider(tripId)),
            icon: const Icon(Icons.refresh),
            label: const Text('Thử tải lại danh sách ảnh'),
          ),
        if (loadImages && urls.length > 1) ...[
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 64,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: urls.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (_, index) => SizedBox(
                width: 96,
                child: Semantics(
                  button: true,
                  label: 'Xem ảnh ${index + 1} của $tripTitle',
                  child: InkWell(
                    onTap: () => open(urls[index]),
                    child: ExcludeSemantics(
                      child: TripCoverImage(
                        imageUrl: urls[index],
                        tripTitle: tripTitle,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
