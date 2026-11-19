import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../data/trip_images_api.dart';
import 'trip_cover_image.dart';

class TripImageViewer extends ConsumerStatefulWidget {
  const TripImageViewer({
    super.key,
    required this.tripId,
    required this.tripTitle,
    this.coverImageUrl,
    this.initialImageUrl,
  });

  final String tripId;
  final String tripTitle;
  final String? coverImageUrl;
  final String? initialImageUrl;

  @override
  ConsumerState<TripImageViewer> createState() => _TripImageViewerState();
}

class _TripImageViewerState extends ConsumerState<TripImageViewer> {
  PageController? _controller;
  int _index = 0;

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  void _move(int index) => _controller?.animateToPage(
    index,
    duration: const Duration(milliseconds: 200),
    curve: Curves.easeOut,
  );

  @override
  Widget build(BuildContext context) {
    final images = ref.watch(tripImagesProvider(widget.tripId));
    final urls = tripGalleryUrls(widget.coverImageUrl, images.valueOrNull);
    if (_controller == null) {
      final initial = urls.indexOf(widget.initialImageUrl ?? '');
      _index = initial < 0 ? 0 : initial;
      _controller = PageController(initialPage: _index);
    }

    return Scaffold(
      backgroundColor: AppColors.brandDark,
      appBar: AppBar(
        backgroundColor: AppColors.brandDark,
        foregroundColor: Colors.white,
        leading: IconButton(
          tooltip: 'Đóng ảnh',
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          widget.tripTitle,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (images.isLoading) const LinearProgressIndicator(),
            if (images.hasError)
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  children: [
                    const Text(
                      'Không tải được danh sách ảnh chuyến đi.',
                      style: TextStyle(color: Colors.white),
                    ),
                    TextButton(
                      onPressed: () =>
                          ref.invalidate(tripImagesProvider(widget.tripId)),
                      child: const Text(
                        'Thử lại',
                        style: TextStyle(color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: urls.isEmpty
                  ? const Center(
                      child: Text(
                        'Chưa có ảnh chuyến đi',
                        style: TextStyle(color: Colors.white),
                      ),
                    )
                  : PageView.builder(
                      controller: _controller,
                      itemCount: urls.length,
                      onPageChanged: (index) => setState(() => _index = index),
                      itemBuilder: (_, index) => InteractiveViewer(
                        key: ValueKey('trip-gallery-image-$index'),
                        maxScale: 4,
                        child: SizedBox.expand(
                          child: TripCoverImage(
                            imageUrl: urls[index],
                            tripTitle: widget.tripTitle,
                            fit: BoxFit.contain,
                            aspectRatio: null,
                          ),
                        ),
                      ),
                    ),
            ),
            if (urls.isNotEmpty)
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      tooltip: 'Ảnh trước',
                      color: Colors.white,
                      disabledColor: Colors.white38,
                      onPressed: _index > 0 ? () => _move(_index - 1) : null,
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Text(
                      '${_index + 1} / ${urls.length}',
                      semanticsLabel: 'Ảnh ${_index + 1} trên ${urls.length}',
                      style: const TextStyle(color: Colors.white),
                    ),
                    IconButton(
                      tooltip: 'Ảnh tiếp theo',
                      color: Colors.white,
                      disabledColor: Colors.white38,
                      onPressed: _index < urls.length - 1
                          ? () => _move(_index + 1)
                          : null,
                      icon: const Icon(Icons.chevron_right),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
