enum OperationalTripStatus {
  published('Chờ khởi hành'),
  ongoing('Đang diễn ra'),
  completed('Đã kết thúc'),
  cancelled('Đã hủy'),
  unavailable('Chưa có thông tin trạng thái');

  const OperationalTripStatus(this.label);
  final String label;

  static OperationalTripStatus parse(Object? value) => values.firstWhere(
    (status) => status.name == value,
    orElse: () => unavailable,
  );
}

class OperationalTrip {
  const OperationalTrip({
    required this.id,
    required this.title,
    required this.status,
    required this.startsAt,
    required this.endsAt,
    this.routeName,
  });

  factory OperationalTrip.fromJson(Map<String, Object?> json) =>
      OperationalTrip(
        id: json['tripId'] as String,
        title: json['title'] as String,
        status: OperationalTripStatus.parse(json['status']),
        startsAt: json['startsAt'] as String,
        endsAt: json['endsAt'] as String,
        routeName: json['routeName'] as String?,
      );

  final String id;
  final String title;
  final OperationalTripStatus status;
  final String startsAt;
  final String endsAt;
  final String? routeName;
}

class TripLifecycle {
  TripLifecycle.fromJson(Map<String, Object?> json)
    : status = OperationalTripStatus.parse(json['status']),
      actualStartedAt = json['actualStartedAt'] as String?,
      actualEndedAt = json['actualEndedAt'] as String?,
      canStart = json['canStart'] == true,
      canEnd = json['canEnd'] == true,
      startBlockedReason = json['startBlockedReason'] as String?;

  final OperationalTripStatus status;
  final String? actualStartedAt;
  final String? actualEndedAt;
  final bool canStart;
  final bool canEnd;
  final String? startBlockedReason;
}
