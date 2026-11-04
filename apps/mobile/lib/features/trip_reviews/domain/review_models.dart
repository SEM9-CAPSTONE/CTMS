enum ReviewTarget { trip, host }

class SavedReview {
  const SavedReview({
    required this.id,
    required this.target,
    required this.rating,
    required this.comment,
    required this.revision,
    this.images = const [],
    this.canEdit = false,
    this.editExpiresAt,
  });
  final String id;
  final ReviewTarget target;
  final int rating;
  final String? comment;
  final int revision;
  final List<String> images;
  final bool canEdit;
  final DateTime? editExpiresAt;

  factory SavedReview.fromJson(Map<String, Object?> json) => SavedReview(
    id: json['id'] as String,
    target: ReviewTarget.values.byName(json['target'] as String),
    rating: json['rating'] as int,
    comment: json['comment'] as String?,
    revision: json['revision'] as int,
    images: (json['images'] as List? ?? []).cast<String>(),
    canEdit: json['canEdit'] == true,
    editExpiresAt: DateTime.tryParse(json['editExpiresAt'] as String? ?? ''),
  );
}

class ReviewContext {
  ReviewContext({
    required this.eligible,
    required this.reason,
    required this.tripId,
    required this.hostId,
    required this.serverTime,
    required this.expiresAt,
    required this.reviews,
  });
  final bool eligible;
  final String? reason;
  final String tripId;
  final String hostId;
  final DateTime serverTime;
  final DateTime? expiresAt;
  final List<SavedReview> reviews;

  factory ReviewContext.fromJson(Map<String, Object?> json) => ReviewContext(
    eligible: json['eligible'] as bool,
    reason: json['reason'] as String?,
    tripId: json['tripId'] as String,
    hostId: json['hostId'] as String,
    serverTime: DateTime.parse(json['serverTime'] as String),
    expiresAt: json['expiresAt'] == null
        ? null
        : DateTime.parse(json['expiresAt'] as String),
    reviews: (json['reviews'] as List)
        .map(
          (item) =>
              SavedReview.fromJson(Map<String, Object?>.from(item as Map)),
        )
        .toList(),
  );
  SavedReview? review(ReviewTarget target) {
    for (final item in reviews) {
      if (item.target == target) return item;
    }
    return null;
  }
}

class ReviewBooking {
  const ReviewBooking({
    required this.id,
    required this.title,
    required this.hostName,
    required this.status,
    required this.createdAt,
    this.startsAt,
  });
  final String id;
  final String title;
  final String? hostName;
  final String? status;
  final DateTime createdAt;
  final DateTime? startsAt;
  factory ReviewBooking.fromJson(Map<String, Object?> json) {
    final presentation = json['tripPresentation'] as Map?;
    return ReviewBooking(
      id: json['id'] as String,
      title: presentation?['currentTitle'] as String? ?? 'Chuyến đi',
      hostName: presentation?['hostName'] as String?,
      status: json['status'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      startsAt: json['tripStartsAtSnapshot'] == null
          ? null
          : DateTime.parse(json['tripStartsAtSnapshot'] as String),
    );
  }
}
