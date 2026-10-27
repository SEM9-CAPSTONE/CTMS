class SosLocation {
  const SosLocation({required this.latitude, required this.longitude});

  final double latitude;
  final double longitude;

  factory SosLocation.fromJson(Map<String, dynamic> json) {
    return SosLocation(
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
    'latitude': latitude,
    'longitude': longitude,
  };
}

class SosAlert {
  const SosAlert({
    required this.id,
    required this.tripId,
    required this.senderId,
    required this.emergencyType,
    required this.status,
    required this.eventTime,
    this.location,
    this.batteryLevel,
    this.cancelledBy,
    this.cancelledAt,
    this.cancellationReason,
    this.acknowledgedBy,
    this.acknowledgedAt,
    this.closedBy,
    this.closedAt,
    this.resolutionNote,
    this.notes,
    this.receivedAt,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String tripId;
  final String senderId;
  final String emergencyType;
  final String status;
  final DateTime eventTime;
  final SosLocation? location;
  final int? batteryLevel;
  final String? cancelledBy;
  final DateTime? cancelledAt;
  final String? cancellationReason;
  final String? acknowledgedBy;
  final DateTime? acknowledgedAt;
  final String? closedBy;
  final DateTime? closedAt;
  final String? resolutionNote;
  final String? notes;
  final DateTime? receivedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  bool get isActive => status == 'active';
  bool get isCancelled => status == 'cancelled';
  bool get isAcknowledged => status == 'acknowledged';
  bool get isClosed => status == 'closed';

  String get emergencyTypeLabel => switch (emergencyType) {
    'medical' => 'Cấp cứu y tế',
    'injury' => 'Chấn thương thể chất',
    'lost' => 'Lạc đường / Tách đoàn',
    'natural_hazard' => 'Thiên tai / Sạt lở / Lũ',
    _ => 'Khẩn cấp khác',
  };

  String get statusLabel => switch (status) {
    'active' => 'Đang hoạt động (Chờ tiếp nhận)',
    'acknowledged' => 'Đã tiếp nhận (Đang xử lý)',
    'cancelled' => 'Đã hủy (Gửi nhầm)',
    'closed' => 'Đã đóng (Xử lý xong)',
    _ => status,
  };

  factory SosAlert.fromJson(Map<String, dynamic> json) {
    return SosAlert(
      id: json['id'] as String,
      tripId: json['tripId'] as String,
      senderId: json['senderId'] as String,
      emergencyType: json['emergencyType'] as String? ?? 'other',
      status: json['status'] as String? ?? 'active',
      eventTime: json['eventTime'] != null
          ? DateTime.parse(json['eventTime'] as String)
          : DateTime.now(),
      location: json['location'] != null
          ? SosLocation.fromJson(Map<String, dynamic>.from(json['location'] as Map))
          : null,
      batteryLevel: json['batteryLevel'] as int?,
      cancelledBy: json['cancelledBy'] as String?,
      cancelledAt: json['cancelledAt'] != null
          ? DateTime.parse(json['cancelledAt'] as String)
          : null,
      cancellationReason: json['cancellationReason'] as String?,
      acknowledgedBy: json['acknowledgedBy'] as String?,
      acknowledgedAt: json['acknowledgedAt'] != null
          ? DateTime.parse(json['acknowledgedAt'] as String)
          : null,
      closedBy: json['closedBy'] as String?,
      closedAt: json['closedAt'] != null
          ? DateTime.parse(json['closedAt'] as String)
          : null,
      resolutionNote: json['resolutionNote'] as String?,
      notes: json['notes'] as String?,
      receivedAt: json['receivedAt'] != null
          ? DateTime.parse(json['receivedAt'] as String)
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'tripId': tripId,
    'senderId': senderId,
    'emergencyType': emergencyType,
    'status': status,
    'eventTime': eventTime.toIso8601String(),
    if (location != null) 'location': location!.toJson(),
    if (batteryLevel != null) 'batteryLevel': batteryLevel,
    if (cancelledBy != null) 'cancelledBy': cancelledBy,
    if (cancelledAt != null) 'cancelledAt': cancelledAt!.toIso8601String(),
    if (cancellationReason != null) 'cancellationReason': cancellationReason,
    if (acknowledgedBy != null) 'acknowledgedBy': acknowledgedBy,
    if (acknowledgedAt != null) 'acknowledgedAt': acknowledgedAt!.toIso8601String(),
    if (closedBy != null) 'closedBy': closedBy,
    if (closedAt != null) 'closedAt': closedAt!.toIso8601String(),
    if (resolutionNote != null) 'resolutionNote': resolutionNote,
    if (notes != null) 'notes': notes,
    if (receivedAt != null) 'receivedAt': receivedAt!.toIso8601String(),
    if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
    if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
  };
}
