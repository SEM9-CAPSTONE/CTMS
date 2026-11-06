import 'dart:math';

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

/// Generates an RFC 4122 version 4 UUID for client-side stable emergency identities (CTMS-076, BR-244).
String newSosId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  final hex = bytes.map((v) => v.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

enum SosSyncState { pending, synced, failed }

class SosAlert {
  const SosAlert({
    required this.id,
    required this.tripId,
    required this.senderId,
    required this.emergencyType,
    required this.status,
    required this.eventTime,
    this.isLocalPending = false,
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
  final bool isLocalPending;
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

  String get statusLabel {
    if (isLocalPending) return 'Chờ đồng bộ ngoại tuyến';
    return switch (status) {
      'active' => 'Đang hoạt động (Chờ tiếp nhận)',
      'acknowledged' => 'Đã tiếp nhận (Đang xử lý)',
      'cancelled' => 'Đã hủy (Gửi nhầm)',
      'closed' => 'Đã đóng (Xử lý xong)',
      _ => status,
    };
  }

  factory SosAlert.fromJson(Map<String, dynamic> json) {
    return SosAlert(
      id: json['id'] as String,
      tripId: json['tripId'] as String,
      senderId: json['senderId'] as String? ?? '',
      emergencyType: json['emergencyType'] as String? ?? 'other',
      status: json['status'] as String? ?? 'active',
      isLocalPending: json['isLocalPending'] as bool? ?? false,
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
    'isLocalPending': isLocalPending,
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

/// Represents an offline or buffered SOS alert stored locally on the device (PB AC-2, BR-256).
class LocalSosAlert {
  const LocalSosAlert({
    required this.id,
    required this.tripId,
    required this.senderId,
    required this.emergencyType,
    required this.eventTime,
    this.location,
    this.batteryLevel,
    this.notes,
    this.syncState = SosSyncState.pending,
    this.serverAlert,
    this.attempts = 0,
    this.error,
    this.lastAttemptAt,
  });

  final String id;
  final String tripId;
  final String senderId;
  final String emergencyType;
  final DateTime eventTime;
  final SosLocation? location;
  final int? batteryLevel;
  final String? notes;
  final SosSyncState syncState;
  final SosAlert? serverAlert;
  final int attempts;
  final String? error;
  final DateTime? lastAttemptAt;

  bool get isPending => syncState == SosSyncState.pending;
  bool get isSynced => syncState == SosSyncState.synced;
  bool get isFailed => syncState == SosSyncState.failed;

  LocalSosAlert delivery({
    required SosSyncState syncState,
    SosAlert? serverAlert,
    int? attempts,
    String? error,
    DateTime? lastAttemptAt,
  }) {
    return LocalSosAlert(
      id: id,
      tripId: tripId,
      senderId: senderId,
      emergencyType: emergencyType,
      eventTime: eventTime,
      location: location,
      batteryLevel: batteryLevel,
      notes: notes,
      syncState: syncState,
      serverAlert: serverAlert ?? this.serverAlert,
      attempts: attempts ?? this.attempts,
      error: error,
      lastAttemptAt: lastAttemptAt ?? this.lastAttemptAt,
    );
  }

  SosAlert toSosAlert() {
    if (serverAlert != null) {
      return serverAlert!;
    }
    return SosAlert(
      id: id,
      tripId: tripId,
      senderId: senderId,
      emergencyType: emergencyType,
      status: 'active',
      isLocalPending: isPending,
      eventTime: eventTime,
      location: location,
      batteryLevel: batteryLevel,
      notes: notes,
      createdAt: eventTime,
    );
  }

  factory LocalSosAlert.fromJson(Map<String, dynamic> json) {
    return LocalSosAlert(
      id: json['id'] as String,
      tripId: json['tripId'] as String,
      senderId: json['senderId'] as String? ?? '',
      emergencyType: json['emergencyType'] as String? ?? 'other',
      eventTime: DateTime.parse(json['eventTime'] as String),
      location: json['location'] != null
          ? SosLocation.fromJson(Map<String, dynamic>.from(json['location'] as Map))
          : null,
      batteryLevel: json['batteryLevel'] as int?,
      notes: json['notes'] as String?,
      syncState: SosSyncState.values.byName(json['syncState'] as String? ?? 'pending'),
      serverAlert: json['serverAlert'] != null
          ? SosAlert.fromJson(Map<String, dynamic>.from(json['serverAlert'] as Map))
          : null,
      attempts: json['attempts'] as int? ?? 0,
      error: json['error'] as String?,
      lastAttemptAt: json['lastAttemptAt'] != null
          ? DateTime.parse(json['lastAttemptAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'tripId': tripId,
    'senderId': senderId,
    'emergencyType': emergencyType,
    'eventTime': eventTime.toIso8601String(),
    if (location != null) 'location': location!.toJson(),
    if (batteryLevel != null) 'batteryLevel': batteryLevel,
    if (notes != null) 'notes': notes,
    'syncState': syncState.name,
    if (serverAlert != null) 'serverAlert': serverAlert!.toJson(),
    'attempts': attempts,
    if (error != null) 'error': error,
    if (lastAttemptAt != null) 'lastAttemptAt': lastAttemptAt!.toIso8601String(),
  };
}
