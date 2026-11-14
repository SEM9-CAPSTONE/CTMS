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
  });

  factory PublishedTrip.fromJson(Map<String, Object?> json) => PublishedTrip(
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
  );

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
}
