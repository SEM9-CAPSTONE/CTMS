import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

typedef IncidentJson = Map<String, Object?>;

enum IncidentSyncState { pending, synced, failed }

enum IncidentMediaState { none, pending, uploaded, failed }

const incidentCategories = {
  'injury': 'Chấn thương',
  'illness': 'Bệnh / sức khỏe',
  'lost_member': 'Thất lạc thành viên',
  'equipment_failure': 'Hỏng thiết bị',
  'weather_hazard': 'Thời tiết nguy hiểm',
  'route_obstruction': 'Đường bị cản trở',
  'wildlife': 'Động vật hoang dã',
  'other': 'Khác',
};
const incidentSeverities = {
  'low': 'Thấp',
  'medium': 'Trung bình',
  'high': 'Cao',
  'critical': 'Nghiêm trọng',
};
const incidentPhotoMaxBytes = 5 * 1024 * 1024;
const incidentDescriptionMaxLength = 2000;

String newIncidentId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  final hex = bytes.map((v) => v.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

class IncidentTrip {
  const IncidentTrip({
    required this.id,
    required this.title,
    required this.status,
  });
  final String id;
  final String title;
  final String status;
  bool get canReport => status == 'ongoing';
  factory IncidentTrip.fromJson(IncidentJson json) => IncidentTrip(
    id: json['tripId'] as String,
    title: json['title'] as String,
    status: json['status'] as String,
  );
  IncidentJson toJson() => {'tripId': id, 'title': title, 'status': status};
}

/// Immutable event identity/time; synchronization only changes delivery metadata.
class LocalIncident {
  const LocalIncident({
    required this.tripId,
    required this.payload,
    this.syncState = IncidentSyncState.pending,
    this.mediaState = IncidentMediaState.none,
    this.photo,
    this.server,
    this.error,
    this.attempts = 0,
    this.nextAttemptAt,
  });
  final String tripId;
  final IncidentJson payload;
  final IncidentSyncState syncState;
  final IncidentMediaState mediaState;
  final Uint8List? photo;
  final IncidentJson? server;
  final String? error;
  final int attempts;
  final DateTime? nextAttemptAt;
  String get id => payload['id'] as String;
  bool get hasWork =>
      syncState == IncidentSyncState.pending ||
      (syncState == IncidentSyncState.synced &&
          mediaState == IncidentMediaState.pending);
  bool due(DateTime now) =>
      hasWork && (nextAttemptAt == null || !nextAttemptAt!.isAfter(now));

  LocalIncident delivery({
    IncidentSyncState? sync,
    IncidentMediaState? media,
    IncidentJson? server,
    String? error,
    int attempts = 0,
    DateTime? nextAttemptAt,
    bool clearPhoto = false,
  }) => LocalIncident(
    tripId: tripId,
    payload: payload,
    syncState: sync ?? syncState,
    mediaState: media ?? mediaState,
    photo: clearPhoto ? null : photo,
    server: server ?? this.server,
    error: error,
    attempts: attempts,
    nextAttemptAt: nextAttemptAt,
  );
  IncidentJson toJson() => {
    'tripId': tripId,
    'payload': payload,
    'syncState': syncState.name,
    'mediaState': mediaState.name,
    'photo': photo == null ? null : base64Encode(photo!),
    'server': server,
    'error': error,
    'attempts': attempts,
    'nextAttemptAt': nextAttemptAt?.toUtc().toIso8601String(),
  };
  factory LocalIncident.fromJson(IncidentJson json) => LocalIncident(
    tripId: json['tripId'] as String,
    payload: Map<String, Object?>.from(json['payload'] as Map),
    syncState: IncidentSyncState.values.byName(json['syncState'] as String),
    mediaState: IncidentMediaState.values.byName(json['mediaState'] as String),
    photo: json['photo'] == null ? null : base64Decode(json['photo'] as String),
    server: json['server'] == null
        ? null
        : Map<String, Object?>.from(json['server'] as Map),
    error: json['error'] as String?,
    attempts: json['attempts'] as int,
    nextAttemptAt: json['nextAttemptAt'] == null
        ? null
        : DateTime.parse(json['nextAttemptAt'] as String),
  );
}
