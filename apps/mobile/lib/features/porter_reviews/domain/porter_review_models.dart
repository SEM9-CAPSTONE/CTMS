import '../../review_reputation/review_reputation.dart';

class PorterParticipation {
  const PorterParticipation({
    required this.bookingId,
    required this.tripId,
    required this.tripTitle,
    required this.startsAt,
    required this.completedAt,
    required this.expiresAt,
    required this.eligible,
    required this.reason,
  });
  final String bookingId, tripId, tripTitle;
  final DateTime startsAt, completedAt;
  final DateTime? expiresAt;
  final bool eligible;
  final String? reason;
  factory PorterParticipation.fromJson(Map<String, Object?> json) =>
      PorterParticipation(
        bookingId: json['bookingId'] as String,
        tripId: json['tripId'] as String,
        tripTitle: json['tripTitle'] as String,
        startsAt: DateTime.parse(json['startsAt'] as String),
        completedAt: DateTime.parse(json['completedAt'] as String),
        expiresAt: _date(json['expiresAt']),
        eligible: json['eligible'] as bool,
        reason: json['reason'] as String?,
      );
}

class PorterParticipationPage {
  PorterParticipationPage({
    required this.items,
    required this.page,
    required this.hasMore,
  });
  final List<PorterParticipation> items;
  final int page;
  final bool hasMore;
  factory PorterParticipationPage.fromJson(Map<String, Object?> json) =>
      PorterParticipationPage(
        page: json['page'] as int,
        hasMore: json['hasMore'] as bool,
        items: (json['items'] as List)
            .map((item) => PorterParticipation.fromJson(_map(item)))
            .toList(),
      );
}

class SavedPorterReview {
  const SavedPorterReview({
    required this.id,
    required this.porterId,
    required this.porterName,
    required this.rating,
    required this.comment,
    required this.revision,
    required this.canEdit,
    required this.editExpiresAt,
    required this.moderationStatus,
    this.reputation,
  });
  final String id, porterId, moderationStatus;
  final String? porterName, comment;
  final int rating, revision;
  final bool canEdit;
  final DateTime editExpiresAt;
  final ReviewReputation? reputation;
  factory SavedPorterReview.fromJson(Map<String, Object?> json) =>
      SavedPorterReview(
        id: json['id'] as String,
        porterId: json['porterId'] as String,
        porterName: json['porterName'] as String?,
        rating: json['rating'] as int,
        comment: json['comment'] as String?,
        revision: json['revision'] as int,
        canEdit: json['canEdit'] == true,
        editExpiresAt: DateTime.parse(json['editExpiresAt'] as String),
        moderationStatus: json['moderationStatus'] as String,
        reputation: ReviewReputation.fromJson(json['reputation']),
      );
}

class ReviewPorter {
  const ReviewPorter({
    required this.id,
    required this.name,
    required this.canCreate,
    this.saved,
    required this.assigned,
    this.reputation,
  });
  final String id;
  final String? name;
  final bool canCreate, assigned;
  final SavedPorterReview? saved;
  final ReviewReputation? reputation;
}

class PorterReviewContext {
  PorterReviewContext({
    required this.serverTime,
    required this.expiresAt,
    required this.eligible,
    required this.reason,
    required this.porters,
  });
  final DateTime serverTime;
  final DateTime? expiresAt;
  final bool eligible;
  final String? reason;
  final List<ReviewPorter> porters;
  ReviewPorter? porter(String id) {
    for (final porter in porters) {
      if (porter.id == id) return porter;
    }
    return null;
  }

  factory PorterReviewContext.fromJson(Map<String, Object?> json) {
    final saved = (json['reviews'] as List)
        .map((item) => SavedPorterReview.fromJson(_map(item)))
        .toList();
    final assigned = (json['porters'] as List).map(_map).toList();
    final people = <String, ReviewPorter>{
      for (final item in assigned)
        item['porterId'] as String: ReviewPorter(
          id: item['porterId'] as String,
          name: item['porterName'] as String?,
          canCreate: item['canCreate'] == true,
          assigned: true,
          reputation: ReviewReputation.fromJson(item['reputation']),
        ),
    };
    for (final review in saved) {
      final current = people[review.porterId];
      people[review.porterId] = ReviewPorter(
        id: review.porterId,
        // A retained review's own context supplies its name, even after assignment removal.
        name: review.porterName,
        canCreate: false,
        saved: review,
        assigned: current != null,
        reputation: review.reputation,
      );
    }
    return PorterReviewContext(
      serverTime: DateTime.parse(json['serverTime'] as String),
      expiresAt: _date(json['expiresAt']),
      eligible: json['eligible'] as bool,
      reason: json['reason'] as String?,
      porters: people.values.toList(),
    );
  }
}

class PorterReviewDraft {
  PorterReviewDraft({
    this.rating = 0,
    this.comment = '',
    this.baseRevision,
    this.editing = true,
  });
  int rating;
  String comment;
  int? baseRevision;
  bool editing, conflict = false, retained = false;
  String? get normalizedComment =>
      comment.trim().isEmpty ? null : comment.trim();
  int get commentLength => comment.trim().runes.length;
  bool matches(SavedPorterReview saved) =>
      rating == saved.rating && normalizedComment == saved.comment;
}

DateTime? _date(Object? value) =>
    value == null ? null : DateTime.parse(value as String);
Map<String, Object?> _map(Object? value) =>
    Map<String, Object?>.from(value as Map);
