import 'package:dio/dio.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/porter_review_models.dart';

abstract interface class PorterReviewsApi {
  Future<PorterParticipationPage> participations(int page);
  Future<PorterReviewContext> context(String bookingId);
  Future<void> write({
    required String bookingId,
    required String porterId,
    required int rating,
    required String? comment,
    String? reviewId,
    int? expectedRevision,
  });
  void dispose();
}

class HttpPorterReviewsApi implements PorterReviewsApi {
  HttpPorterReviewsApi(this.client, this.accountId);
  final ApiClient client;
  final String accountId;
  final _cancel = CancelToken();

  @override
  Future<PorterParticipationPage> participations(int page) async {
    final response = await client.get<Map<String, Object?>>(
      ApiEndpoints.porterReviews.participations,
      queryParameters: {'page': page, 'limit': 10},
      expectedUserId: accountId,
      cancelToken: _cancel,
    );
    return PorterParticipationPage.fromJson(response.data!);
  }

  @override
  Future<PorterReviewContext> context(String bookingId) async {
    final response = await client.get<Map<String, Object?>>(
      ApiEndpoints.porterReviews.context(bookingId),
      expectedUserId: accountId,
      cancelToken: _cancel,
    );
    return PorterReviewContext.fromJson(response.data!);
  }

  @override
  Future<void> write({
    required String bookingId,
    required String porterId,
    required int rating,
    required String? comment,
    String? reviewId,
    int? expectedRevision,
  }) async {
    final body = <String, Object?>{'rating': rating, 'comment': comment};
    if (reviewId == null) {
      await client.post<Object?>(
        ApiEndpoints.porterReviews.create(bookingId),
        data: {...body, 'porterId': porterId},
        expectedUserId: accountId,
        cancelToken: _cancel,
      );
    } else {
      await client.patch<Object?>(
        ApiEndpoints.porterReviews.update(reviewId),
        data: {...body, 'expectedRevision': expectedRevision},
        expectedUserId: accountId,
        cancelToken: _cancel,
      );
    }
  }

  @override
  void dispose() => _cancel.cancel();
}
