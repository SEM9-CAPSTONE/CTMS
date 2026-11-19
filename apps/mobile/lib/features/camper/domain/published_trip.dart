import '../../review_reputation/review_reputation.dart';

class PublishedTrip {
  const PublishedTrip({
    required this.id,
    required this.title,
    required this.description,
    required this.difficulty,
    required this.startsAt,
    required this.endsAt,
    required this.bookingDeadline,
    required this.durationNights,
    required this.pricePerPerson,
    required this.remainingSeats,
    required this.isBookable,
    this.areaName,
    this.coverImageUrl,
    this.imageUrls = const [],
    this.hostReputation,
    this.hostName,
    this.loadedForAccount,
  });

  factory PublishedTrip.fromJson(
    Map<String, Object?> json, {
    String? loadedForAccount,
  }) {
    final area = json['area'] as Map<String, Object?>?;
    final itinerary = json['itinerary'] as Map<String, Object?>?;
    final names = {
      (area?['name'] as String?)?.trim(),
      (area?['provinceName'] as String?)?.trim(),
    }.nonNulls.where((name) => name.isNotEmpty);
    return PublishedTrip(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      difficulty: json['difficulty'] as String?,
      startsAt: DateTime.parse(json['startsAt'] as String),
      endsAt: DateTime.parse(json['endsAt'] as String),
      bookingDeadline: DateTime.parse(json['bookingDeadline'] as String),
      durationNights: (json['durationNights'] as num).toInt(),
      pricePerPerson: json['pricePerPerson'] as num,
      remainingSeats: (json['remainingSeats'] as num?)?.toInt(),
      isBookable: json['isBookable'] as bool,
      areaName: names.isEmpty ? null : names.join(', '),
      coverImageUrl: (json['coverImageUrl'] as String?)?.trim(),
      imageUrls: [
        for (final image in itinerary?['images'] as List<Object?>? ?? const [])
          if (image is String && image.trim().isNotEmpty) image.trim(),
      ],
      hostReputation: ReviewReputation.fromJson(json['hostReputation']),
      hostName: (json['host'] as Map?)?['fullName'] as String?,
      loadedForAccount: loadedForAccount,
    );
  }

  final String id;
  final String title;
  final String? description;
  final String? difficulty;
  final DateTime startsAt;
  final DateTime endsAt;
  final DateTime bookingDeadline;
  final int durationNights;
  final num pricePerPerson;
  final int? remainingSeats;
  final bool isBookable;
  final String? areaName;
  final String? coverImageUrl;
  final List<String> imageUrls;
  final ReviewReputation? hostReputation;
  final String? hostName;

  /// Local ownership metadata; never serialized to the API.
  final String? loadedForAccount;
}
