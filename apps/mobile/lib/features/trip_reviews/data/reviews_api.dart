import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/review_models.dart';

final reviewsApiProvider = Provider(
  (ref) => ReviewsApi(ref.watch(apiClientProvider)),
);

class ReviewsApi {
  ReviewsApi(this.client);
  final ApiClient client;

  Future<Map<String, ({int count, bool canCreate})>> summary() async {
    final response = await client.get<List<Object?>>('/trip-reviews/summary');
    return {
      for (final raw in response.data!)
        (raw as Map)['bookingId'] as String: (
          count: raw['count'] as int,
          canCreate: raw['canCreate'] == true,
        ),
    };
  }

  Future<List<ReviewBooking>> bookings() async {
    final response = await client.get<List<Object?>>(
      ApiEndpoints.bookings.getAll,
    );
    return response.data!
        .map(
          (item) =>
              ReviewBooking.fromJson(Map<String, Object?>.from(item as Map)),
        )
        .toList();
  }

  Future<ReviewContext> context(String bookingId) async {
    final response = await client.get<Map<String, Object?>>(
      ApiEndpoints.bookings.reviewContext(bookingId),
    );
    return ReviewContext.fromJson(response.data!);
  }

  Future<String> upload(XFile file) async {
    final response = await client.post<Map<String, Object?>>(
      '/trip-reviews/images',
      data: FormData.fromMap({
        'file': MultipartFile.fromBytes(
          await file.readAsBytes(),
          filename: file.name,
          contentType: DioMediaType.parse(file.mimeType ?? _mime(file.name)),
        ),
      }),
    );
    return response.data!['url'] as String;
  }

  String _mime(String name) => name.toLowerCase().endsWith('.png')
      ? 'image/png'
      : name.toLowerCase().endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';

  Future<void> save(
    String bookingId,
    ReviewTarget target,
    int rating,
    String comment,
    SavedReview? existing,
    List<String> images,
  ) async {
    final body = <String, Object?>{
      'rating': rating,
      'images': images,
      'comment': comment.trim().isEmpty ? null : comment.trim(),
    };
    if (existing == null) {
      await client.post<Object?>(
        ApiEndpoints.bookings.reviews(bookingId),
        data: {...body, 'target': target.name},
      );
    } else {
      await client.patch<Object?>(
        ApiEndpoints.bookings.review(existing.id),
        data: {...body, 'expectedRevision': existing.revision},
      );
    }
  }
}
