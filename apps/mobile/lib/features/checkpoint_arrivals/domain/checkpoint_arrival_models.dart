import 'dart:convert';
import 'package:crypto/crypto.dart';

import '../../gps_tracking/domain/gps_tracking_models.dart';

/// Ngưỡng phát hiện điểm kiểm tra cố định V3 (BR-239).
const double checkpointArrivalDistanceMeters = 20.0;
const int checkpointArrivalSampleCount = 3;
const int checkpointArrivalBatchSize = 100;
const double validSampleMaxAccuracyMeters = 20.0;

/// Thông tin điểm kiểm tra thuộc tuyến đường.
class RouteCheckpoint {
  const RouteCheckpoint({
    required this.id,
    required this.latitude,
    required this.longitude,
    this.name = '',
    this.order = 0,
    this.description,
  });

  final String id;
  final double latitude;
  final double longitude;
  final String name;
  final int order;
  final String? description;

  factory RouteCheckpoint.fromJson(Map<String, Object?> json) => RouteCheckpoint(
    id: json['id'] as String,
    latitude: (json['latitude'] as num).toDouble(),
    longitude: (json['longitude'] as num).toDouble(),
    name: (json['name'] as String?) ?? '',
    order: (json['order'] as num?)?.toInt() ?? 0,
    description: json['description'] as String?,
  );

  Map<String, Object?> toJson() => {
    'id': id,
    'latitude': latitude,
    'longitude': longitude,
    if (name.isNotEmpty) 'name': name,
    'order': order,
    if (description != null) 'description': description,
  };
}

/// Ngữ cảnh điểm kiểm tra đã ghim bất biến cho chuyến đi.
class CheckpointArrivalContext {
  const CheckpointArrivalContext({
    required this.tripId,
    required this.routeId,
    required this.routeVersion,
    required this.packageId,
    required this.packageVersion,
    required this.checkpoints,
    this.contextSource = 'authoritative',
  });

  final String tripId;
  final String routeId;
  final String routeVersion;
  final String packageId;
  final String packageVersion;
  final List<RouteCheckpoint> checkpoints;
  final String contextSource;

  factory CheckpointArrivalContext.fromJson(Map<String, Object?> json) {
    final rawList = json['checkpoints'] as List<dynamic>? ?? [];
    return CheckpointArrivalContext(
      tripId: json['tripId'] as String,
      routeId: json['routeId'] as String,
      routeVersion: json['routeVersion'] as String,
      packageId: json['packageId'] as String,
      packageVersion: json['packageVersion'] as String,
      checkpoints: [
        for (final item in rawList)
          RouteCheckpoint.fromJson(Map<String, Object?>.from(item as Map)),
      ],
      contextSource: (json['contextSource'] as String?) ?? 'authoritative',
    );
  }

  Map<String, Object?> toJson() => {
    'tripId': tripId,
    'routeId': routeId,
    'routeVersion': routeVersion,
    'packageId': packageId,
    'packageVersion': packageVersion,
    'checkpoints': [for (final cp in checkpoints) cp.toJson()],
    'contextSource': contextSource,
  };
}

/// Mẫu GPS thành phần được lưu giữ làm chứng cứ cho lượt đến.
class CheckpointArrivalSample {
  const CheckpointArrivalSample({
    required this.eventTime,
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
  });

  final String eventTime; // Chuỗi ISO-8601 UTC gốc
  final double latitude;
  final double longitude;
  final double accuracyMeters;

  factory CheckpointArrivalSample.fromGpsSample(GpsSample sample) =>
      CheckpointArrivalSample(
        eventTime: sample.capturedAt.toUtc().toIso8601String(),
        latitude: sample.latitude,
        longitude: sample.longitude,
        accuracyMeters: sample.accuracyMeters,
      );

  factory CheckpointArrivalSample.fromJson(Map<String, Object?> json) =>
      CheckpointArrivalSample(
        eventTime: json['eventTime'] as String,
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        accuracyMeters: (json['accuracyMeters'] as num).toDouble(),
      );

  Map<String, Object?> toJson() => {
    'eventTime': eventTime,
    'latitude': latitude,
    'longitude': longitude,
    'accuracyMeters': accuracyMeters,
  };
}

/// Trạng thái đồng bộ của bản ghi lượt đến.
enum CheckpointSyncState {
  pending,  // Đang chờ gửi
  synced,   // Đã được server xác nhận
  paused,   // Đã hết 5 lượt retry, tạm dừng chờ sự kiện mới
  failed,   // Lỗi vĩnh viễn (retryable: false)
}

/// Mã từ chối từ Server (khớp CheckpointArrivalRejection BE).
enum CheckpointArrivalRejection {
  contextMismatch('context_mismatch'),
  checkpointNotInPackage('checkpoint_not_in_package'),
  thresholdNotMet('threshold_not_met'),
  invalidSampleSequence('invalid_sample_sequence'),
  idConflict('id_conflict'),
  eventTimeInFuture('event_time_in_future'),
  tripCompletedWindowExpired('trip_completed_window_expired'),
  tripNotTrackable('trip_not_trackable'),
  participationNotEligible('participation_not_eligible'),
  eventTimeOutsideParticipation('event_time_outside_participation'),
  processingError('processing_error');

  const CheckpointArrivalRejection(this.wireValue);
  final String wireValue;

  static CheckpointArrivalRejection? fromWire(String? value) {
    if (value == null) return null;
    for (final e in values) {
      if (e.wireValue == value) return e;
    }
    return null;
  }
}

/// Một bản ghi xác nhận đã đến Checkpoint được lưu cục bộ trên thiết bị.
class LocalCheckpointArrival {
  const LocalCheckpointArrival({
    required this.id,
    required this.tripId,
    required this.checkpointId,
    required this.routeId,
    required this.routeVersion,
    required this.packageId,
    required this.packageVersion,
    required this.detectedOffline,
    required this.samples,
    required this.confirmedAt,
    this.syncState = CheckpointSyncState.pending,
    this.attempts = 0,
    this.nextRetryAt,
    this.lastError,
    this.rejectionReason,
    this.serverVisitId,
    this.serverReceivedAt,
  });

  final String id;
  final String tripId;
  final String checkpointId;
  final String routeId;
  final String routeVersion;
  final String packageId;
  final String packageVersion;
  final bool detectedOffline;
  final List<CheckpointArrivalSample> samples;
  final DateTime confirmedAt;

  final CheckpointSyncState syncState;
  final int attempts;
  final DateTime? nextRetryAt;
  final String? lastError;
  final CheckpointArrivalRejection? rejectionReason;
  final String? serverVisitId;
  final DateTime? serverReceivedAt;

  /// Tạo payload JSON chuẩn để gửi lên server (khớp CheckpointArrivalInputDto).
  Map<String, Object?> toServerPayload() => {
    'id': id,
    'checkpointId': checkpointId,
    'routeId': routeId,
    'routeVersion': routeVersion,
    'packageId': packageId,
    'packageVersion': packageVersion,
    'detectedOffline': detectedOffline,
    'samples': [for (final s in samples) s.toJson()],
  };

  /// Tạo fingerprint SHA-256 khớp chuẩn BE (độc lập với thứ tự key/timezone).
  String calculateFingerprint() {
    final payloadList = [
      checkpointId,
      routeId,
      routeVersion,
      packageId,
      packageVersion,
      detectedOffline,
      [
        for (final s in samples)
          [
            DateTime.parse(s.eventTime).toUtc().toIso8601String(),
            s.latitude,
            s.longitude,
            s.accuracyMeters,
          ],
      ],
    ];
    final jsonStr = jsonEncode(payloadList);
    return sha256.convert(utf8.encode(jsonStr)).toString();
  }

  LocalCheckpointArrival resetForRetry() => LocalCheckpointArrival(
    id: id,
    tripId: tripId,
    checkpointId: checkpointId,
    routeId: routeId,
    routeVersion: routeVersion,
    packageId: packageId,
    packageVersion: packageVersion,
    detectedOffline: detectedOffline,
    samples: samples,
    confirmedAt: confirmedAt,
    syncState: CheckpointSyncState.pending,
    attempts: 0,
    nextRetryAt: null,
    lastError: null,
    rejectionReason: null,
    serverVisitId: serverVisitId,
    serverReceivedAt: serverReceivedAt,
  );

  LocalCheckpointArrival copyWith({
    String? routeId,
    String? routeVersion,
    String? packageId,
    String? packageVersion,
    CheckpointSyncState? syncState,
    int? attempts,
    DateTime? nextRetryAt,
    bool clearNextRetryAt = false,
    String? lastError,
    bool clearLastError = false,
    CheckpointArrivalRejection? rejectionReason,
    String? serverVisitId,
    DateTime? serverReceivedAt,
  }) => LocalCheckpointArrival(
    id: id,
    tripId: tripId,
    checkpointId: checkpointId,
    routeId: routeId ?? this.routeId,
    routeVersion: routeVersion ?? this.routeVersion,
    packageId: packageId ?? this.packageId,
    packageVersion: packageVersion ?? this.packageVersion,
    detectedOffline: detectedOffline,
    samples: samples,
    confirmedAt: confirmedAt,
    syncState: syncState ?? this.syncState,
    attempts: attempts ?? this.attempts,
    nextRetryAt: clearNextRetryAt ? null : (nextRetryAt ?? this.nextRetryAt),
    lastError: clearLastError ? null : (lastError ?? this.lastError),
    rejectionReason: rejectionReason ?? this.rejectionReason,
    serverVisitId: serverVisitId ?? this.serverVisitId,
    serverReceivedAt: serverReceivedAt ?? this.serverReceivedAt,
  );

  factory LocalCheckpointArrival.fromJson(Map<String, Object?> json) =>
      LocalCheckpointArrival(
        id: json['id'] as String,
        tripId: json['tripId'] as String,
        checkpointId: json['checkpointId'] as String,
        routeId: json['routeId'] as String,
        routeVersion: json['routeVersion'] as String,
        packageId: json['packageId'] as String,
        packageVersion: json['packageVersion'] as String,
        detectedOffline: json['detectedOffline'] as bool,
        samples: [
          for (final s in (json['samples'] as List<dynamic>))
            CheckpointArrivalSample.fromJson(Map<String, Object?>.from(s as Map)),
        ],
        confirmedAt: DateTime.parse(json['confirmedAt'] as String),
        syncState: CheckpointSyncState.values.byName(json['syncState'] as String),
        attempts: (json['attempts'] as num?)?.toInt() ?? 0,
        nextRetryAt: json['nextRetryAt'] == null
            ? null
            : DateTime.tryParse(json['nextRetryAt'] as String),
        lastError: json['lastError'] as String?,
        rejectionReason: CheckpointArrivalRejection.fromWire(
          json['rejectionReason'] as String?,
        ),
        serverVisitId: json['serverVisitId'] as String?,
        serverReceivedAt: json['serverReceivedAt'] == null
            ? null
            : DateTime.tryParse(json['serverReceivedAt'] as String),
      );

  Map<String, Object?> toJson() => {
    'id': id,
    'tripId': tripId,
    'checkpointId': checkpointId,
    'routeId': routeId,
    'routeVersion': routeVersion,
    'packageId': packageId,
    'packageVersion': packageVersion,
    'detectedOffline': detectedOffline,
    'samples': [for (final s in samples) s.toJson()],
    'confirmedAt': confirmedAt.toIso8601String(),
    'syncState': syncState.name,
    'attempts': attempts,
    'nextRetryAt': nextRetryAt?.toIso8601String(),
    'lastError': lastError,
    'rejectionReason': rejectionReason?.wireValue,
    'serverVisitId': serverVisitId,
    'serverReceivedAt': serverReceivedAt?.toIso8601String(),
  };
}

/// Trạng thái tổng hợp cho một điểm kiểm tra tại UI.
class CheckpointUiItem {
  const CheckpointUiItem({
    required this.checkpoint,
    required this.isReached,
    this.confirmedAt,
    this.syncState,
    this.lastDistanceMeters,
    this.qualifyingSamplesCount = 0,
  });

  final RouteCheckpoint checkpoint;
  final bool isReached;
  final DateTime? confirmedAt;
  final CheckpointSyncState? syncState;
  final double? lastDistanceMeters;
  final int qualifyingSamplesCount;
}

