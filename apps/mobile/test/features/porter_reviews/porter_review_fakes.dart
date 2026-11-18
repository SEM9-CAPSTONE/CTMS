import 'dart:async';
import 'package:mobile/features/porter_reviews/data/porter_reviews_api.dart';
import 'package:mobile/features/porter_reviews/domain/porter_review_models.dart';

final serverTime = DateTime.utc(2026, 11, 18, 3);
PorterReviewContext reviewContext({
  bool saved = false,
  bool assigned = true,
  bool expired = false,
  int revision = 1,
  int rating = 4,
  String? comment = 'Hỗ trợ chu đáo',
  String? reason,
  DateTime? deadline,
}) => PorterReviewContext.fromJson({
  'serverTime': serverTime.toIso8601String(),
  'expiresAt': (deadline ?? serverTime.add(Duration(hours: expired ? -1 : 1)))
      .toIso8601String(),
  'eligible': assigned && !expired,
  'reason':
      reason ??
      (expired
          ? 'WINDOW_EXPIRED'
          : !assigned
          ? 'NO_ELIGIBLE_ASSIGNMENT'
          : null),
  'porters': [
    if (assigned)
      {
        'porterId': 'porter-a',
        'porterName': 'Nguyễn Minh Sơn',
        'canCreate': !saved && !expired,
      },
  ],
  'reviews': [
    if (saved)
      {
        'id': 'review-a',
        'porterId': 'porter-a',
        'porterName': 'Nguyễn Minh Sơn',
        'rating': rating,
        'comment': comment,
        'revision': revision,
        'canEdit': !expired,
        'moderationStatus': 'visible',
        'editExpiresAt':
            (deadline ?? serverTime.add(Duration(hours: expired ? -1 : 1)))
                .toIso8601String(),
      },
  ],
});
PorterParticipation participation({
  String id = 'booking-a',
  String title = 'Khám phá bán đảo Sơn Trà',
}) => PorterParticipation(
  bookingId: id,
  tripId: 'trip-a',
  tripTitle: title,
  startsAt: serverTime.subtract(const Duration(days: 1)),
  completedAt: serverTime.subtract(const Duration(hours: 1)),
  expiresAt: serverTime.add(const Duration(hours: 23)),
  eligible: true,
  reason: null,
);

class FakePorterApi implements PorterReviewsApi {
  PorterReviewContext snapshot = reviewContext();
  List<PorterParticipation> trips = [participation()];
  Object? listFailure, contextFailure, writeFailure;
  Completer<PorterReviewContext>? contextPending;
  Completer<void>? writePending;
  VoidCallback? onWrite;
  int reads = 0, writes = 0;
  int? sentRevision;
  String? sentComment;
  bool disposed = false;
  @override
  Future<PorterParticipationPage> participations(int page) async {
    if (listFailure != null) throw listFailure!;
    return PorterParticipationPage(items: trips, page: page, hasMore: false);
  }

  @override
  Future<PorterReviewContext> context(String bookingId) async {
    reads++;
    if (contextPending != null) return contextPending!.future;
    if (contextFailure != null) throw contextFailure!;
    return snapshot;
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
    writes++;
    sentRevision = expectedRevision;
    sentComment = comment;
    if (writePending != null) await writePending!.future;
    onWrite?.call();
    if (writeFailure != null) throw writeFailure!;
    snapshot = reviewContext(
      saved: true,
      rating: rating,
      comment: comment,
      revision: (expectedRevision ?? 0) + 1,
    );
  }

  @override
  void dispose() {
    disposed = true;
  }
}

typedef VoidCallback = void Function();
