import 'dart:math';

/// Server view of whether the caller may record breadcrumbs now (BR-237), with the
/// fixed V3 intervals (BR-368/396) — `GET /trips/:tripId/gps-tracking/context`.
class GpsTrackingContext {
  const GpsTrackingContext({
    required this.tripId,
    required this.eligible,
    required this.reason,
    required this.participantRole,
    required this.samplingIntervalSeconds,
    required this.loggingIntervalSeconds,
    required this.configVersion,
  });

  final String tripId;
  final bool eligible;
  final String? reason;
  final String participantRole;
  final int samplingIntervalSeconds;
  final int loggingIntervalSeconds;
  final String configVersion;

  factory GpsTrackingContext.fromJson(Map<String, Object?> json) =>
      GpsTrackingContext(
        tripId: json['tripId'] as String,
        eligible: json['eligible'] as bool,
        reason: json['reason'] as String?,
        participantRole: json['participantRole'] as String,
        samplingIntervalSeconds: (json['samplingIntervalSeconds'] as num).toInt(),
        loggingIntervalSeconds: (json['loggingIntervalSeconds'] as num).toInt(),
        configVersion: json['configVersion'] as String,
      );
}

/// One runtime reading taken by the device. [capturedAt] is the time the
/// position was measured, never the time it was used.
class GpsSample {
  const GpsSample({
    required this.capturedAt,
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
    this.altitudeMeters,
  });

  final DateTime capturedAt;
  final double latitude;
  final double longitude;
  final double accuracyMeters;
  final double? altitudeMeters;

  Duration ageAt(DateTime now) => now.difference(capturedAt);
}

enum GpsLogSyncState { pending, synced, failed }

/// Raw breadcrumb persisted at a logging boundary. Identity and capture data are
/// immutable; synchronization only changes the delivery fields.
class LocalGpsLog {
  const LocalGpsLog({
    required this.id,
    required this.tripId,
    required this.eventTime,
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
    required this.configVersion,
    this.altitudeMeters,
    this.batteryLevel,
    this.packageVersion,
    this.syncState = GpsLogSyncState.pending,
    this.rejectionReason,
    this.attempts = 0,
    this.nextAttemptAt,
    this.error,
  });

  final String id;
  final String tripId;
  final DateTime eventTime;
  final double latitude;
  final double longitude;
  final double accuracyMeters;
  final double? altitudeMeters;
  final int? batteryLevel;
  final String? packageVersion;
  final String configVersion;
  final GpsLogSyncState syncState;
  final String? rejectionReason;
  final int attempts;
  final DateTime? nextAttemptAt;
  final String? error;

  factory LocalGpsLog.fromSample({
    required String id,
    required String tripId,
    required GpsSample sample,
    required String configVersion,
  }) => LocalGpsLog(
    id: id,
    tripId: tripId,
    eventTime: sample.capturedAt,
    latitude: sample.latitude,
    longitude: sample.longitude,
    accuracyMeters: sample.accuracyMeters,
    altitudeMeters: sample.altitudeMeters,
    configVersion: configVersion,
  );

  bool isDueForSync(DateTime now) =>
      syncState == GpsLogSyncState.pending &&
      (nextAttemptAt == null || !nextAttemptAt!.isAfter(now));

  LocalGpsLog delivery({
    required GpsLogSyncState syncState,
    String? rejectionReason,
    int? attempts,
    DateTime? nextAttemptAt,
    String? error,
  }) => LocalGpsLog(
    id: id,
    tripId: tripId,
    eventTime: eventTime,
    latitude: latitude,
    longitude: longitude,
    accuracyMeters: accuracyMeters,
    altitudeMeters: altitudeMeters,
    batteryLevel: batteryLevel,
    packageVersion: packageVersion,
    configVersion: configVersion,
    syncState: syncState,
    rejectionReason: rejectionReason,
    attempts: attempts ?? this.attempts,
    nextAttemptAt: nextAttemptAt,
    error: error,
  );

  /// Body item for `POST /trips/:tripId/gps-logs` (timestamp with offset, BR-188).
  Map<String, Object?> toPayload() => {
    'id': id,
    'eventTime': eventTime.toUtc().toIso8601String(),
    'latitude': latitude,
    'longitude': longitude,
    'accuracyMeters': accuracyMeters,
    if (altitudeMeters != null) 'altitudeMeters': altitudeMeters,
    if (batteryLevel != null) 'batteryLevel': batteryLevel,
    if (packageVersion != null) 'packageVersion': packageVersion,
    'configVersion': configVersion,
  };

  Map<String, Object?> toJson() => {
    ...toPayload(),
    'tripId': tripId,
    'syncState': syncState.name,
    'rejectionReason': rejectionReason,
    'attempts': attempts,
    'nextAttemptAt': nextAttemptAt?.toUtc().toIso8601String(),
    'error': error,
  };

  factory LocalGpsLog.fromJson(Map<String, Object?> json) => LocalGpsLog(
    id: json['id'] as String,
    tripId: json['tripId'] as String,
    eventTime: DateTime.parse(json['eventTime'] as String),
    latitude: (json['latitude'] as num).toDouble(),
    longitude: (json['longitude'] as num).toDouble(),
    accuracyMeters: (json['accuracyMeters'] as num).toDouble(),
    altitudeMeters: (json['altitudeMeters'] as num?)?.toDouble(),
    batteryLevel: (json['batteryLevel'] as num?)?.toInt(),
    packageVersion: json['packageVersion'] as String?,
    configVersion: json['configVersion'] as String,
    syncState: GpsLogSyncState.values.byName(json['syncState'] as String),
    rejectionReason: json['rejectionReason'] as String?,
    attempts: (json['attempts'] as num?)?.toInt() ?? 0,
    nextAttemptAt: json['nextAttemptAt'] == null
        ? null
        : DateTime.parse(json['nextAttemptAt'] as String),
    error: json['error'] as String?,
  );
}

/// Picks the sample to persist at a logging boundary (BR-396): the latest sample
/// captured after the previous boundary. Returns null when there is no fresh
/// sample, so an old coordinate is never re-logged as a new breadcrumb.
GpsSample? selectBoundarySample({
  required GpsSample? latest,
  required DateTime? previousBoundary,
  required DateTime boundary,
  required Duration loggingInterval,
}) {
  if (latest == null) return null;
  if (latest.capturedAt.isAfter(boundary)) return null;
  final windowStart = previousBoundary ?? boundary.subtract(loggingInterval);
  if (!latest.capturedAt.isAfter(windowStart)) return null;
  return latest;
}

/// RFC 4122 version 4 identifier for a breadcrumb, generated on the device so
/// retried uploads stay idempotent (BR-244).
String newGpsLogId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  final hex = bytes.map((v) => v.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-'
      '${hex.substring(16, 20)}-${hex.substring(20)}';
}
