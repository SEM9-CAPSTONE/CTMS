import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/published_trip.dart';

final tripImagesProvider = FutureProvider.autoDispose
    .family<List<String>, String>((ref, tripId) async {
      final client = ref.watch(apiClientProvider);
      final response = await client.get<List<Object?>>(
        ApiEndpoints.trips.images(tripId),
      );
      final urls = [
        for (final item in response.data!)
          (item as Map<String, Object?>)['url'] as String,
      ];
      if (urls.isNotEmpty) return urls;
      // Older seeded trips keep their gallery in itinerary.images.
      final details = await client.get<Map<String, Object?>>(
        ApiEndpoints.trips.getById(tripId),
      );
      return PublishedTrip.fromJson(details.data!).imageUrls;
    });

/// Keep the cover first and avoid repeating it when it is also in the gallery.
List<String> tripGalleryUrls(String? cover, List<String>? images) {
  final unique = <String, String>{};
  for (final source in [?cover, ...?images]) {
    final url = source.trim();
    if (url.isEmpty) continue;
    final uri = Uri.tryParse(url);
    // Seed covers and itinerary photos can use different sizes of the same photo.
    final key = uri != null && uri.host == 'images.unsplash.com'
        ? uri.replace(query: '').toString()
        : url;
    unique.putIfAbsent(key, () => url);
  }
  return unique.values.toList();
}
