import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';

/// CTMS-063 statuses from `GET /trips/:tripId/schedule-progress` (CTMS-319).
enum ScheduleStatus { onTrack, behind, severelyBehind, locationUnknown }

ScheduleStatus _statusFromJson(String value) => switch (value) {
  'BEHIND' => ScheduleStatus.behind,
  'SEVERELY_BEHIND' => ScheduleStatus.severelyBehind,
  'LOCATION_UNKNOWN' => ScheduleStatus.locationUnknown,
  _ => ScheduleStatus.onTrack,
};

class ScheduleReference {
  const ScheduleReference({
    required this.checkpointId,
    required this.checkpointName,
    required this.porterArrivedAt,
  });

  final String checkpointId;
  final String checkpointName;
  final DateTime porterArrivedAt;

  factory ScheduleReference.fromJson(Map<String, Object?> json) =>
      ScheduleReference(
        checkpointId: json['checkpointId'] as String,
        checkpointName: json['checkpointName'] as String,
        porterArrivedAt: DateTime.parse(json['porterArrivedAt'] as String),
      );
}

class MemberScheduleProgress {
  const MemberScheduleProgress({
    required this.userId,
    required this.fullName,
    required this.status,
    required this.reference,
    required this.lagMinutes,
    required this.safeCheckpointName,
    required this.guidance,
    required this.lastValidSampleAt,
  });

  final String userId;
  final String? fullName;
  final ScheduleStatus status;
  final ScheduleReference? reference;
  final int? lagMinutes;

  /// Null when the server found no safe Checkpoint; [guidance] then carries the fallback text.
  final String? safeCheckpointName;

  /// Policy text from the server, shown verbatim (spec §13.3/§13.4).
  final String? guidance;
  final DateTime? lastValidSampleAt;

  bool get isWarning =>
      status == ScheduleStatus.behind ||
      status == ScheduleStatus.severelyBehind;

  factory MemberScheduleProgress.fromJson(Map<String, Object?> json) {
    final reference = json['reference'];
    final safe = json['safeCheckpoint'];
    final lastSample = json['lastValidSampleAt'] as String?;
    return MemberScheduleProgress(
      userId: json['userId'] as String,
      fullName: json['fullName'] as String?,
      status: _statusFromJson(json['status'] as String),
      reference: reference == null
          ? null
          : ScheduleReference.fromJson(
              Map<String, Object?>.from(reference as Map),
            ),
      lagMinutes: (json['lagMinutes'] as num?)?.toInt(),
      safeCheckpointName: safe == null ? null : (safe as Map)['name'] as String,
      guidance: json['guidance'] as String?,
      lastValidSampleAt: lastSample == null ? null : DateTime.parse(lastSample),
    );
  }
}

class ScheduleProgress {
  const ScheduleProgress({
    required this.tripStatus,
    required this.evaluatedAt,
    required this.behindLagMinutes,
    required this.severelyBehindLagMinutes,
    required this.members,
  });

  final String tripStatus;
  final DateTime evaluatedAt;
  final int behindLagMinutes;
  final int severelyBehindLagMinutes;
  final List<MemberScheduleProgress> members;

  bool get isOngoing => tripStatus == 'ongoing';

  factory ScheduleProgress.fromJson(Map<String, Object?> json) {
    final thresholds = Map<String, Object?>.from(json['thresholds'] as Map);
    return ScheduleProgress(
      tripStatus: json['tripStatus'] as String,
      evaluatedAt: DateTime.parse(json['evaluatedAt'] as String),
      behindLagMinutes: (thresholds['behindLagMinutes'] as num).toInt(),
      severelyBehindLagMinutes: (thresholds['severelyBehindLagMinutes'] as num)
          .toInt(),
      members: (json['members'] as List)
          .map(
            (item) => MemberScheduleProgress.fromJson(
              Map<String, Object?>.from(item as Map),
            ),
          )
          .toList(),
    );
  }
}

abstract interface class ScheduleProgressApi {
  Future<ScheduleProgress> fetch(String tripId);
}

class HttpScheduleProgressApi implements ScheduleProgressApi {
  HttpScheduleProgressApi(this.client);
  final ApiClient client;

  @override
  Future<ScheduleProgress> fetch(String tripId) async {
    final response = await client.get<Map<String, Object?>>(
      ApiEndpoints.trips.scheduleProgress(tripId),
    );
    return ScheduleProgress.fromJson(response.data!);
  }
}
