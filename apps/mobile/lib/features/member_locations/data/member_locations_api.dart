import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';

/// CTMS-066 `GET /trips/:tripId/member-locations` (CTMS-329, spec §13).
enum LocationFreshness { fresh, stale, unavailable }

class SyncedLocation {
  const SyncedLocation({
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
    required this.eventTime,
  });

  factory SyncedLocation.fromJson(Map<String, Object?> json) => SyncedLocation(
    latitude: (json['latitude'] as num).toDouble(),
    longitude: (json['longitude'] as num).toDouble(),
    accuracyMeters: (json['accuracyMeters'] as num).toDouble(),
    eventTime: DateTime.parse(json['eventTime'] as String),
  );

  final double latitude;
  final double longitude;
  final double accuracyMeters;
  final DateTime eventTime;
}

class MemberLocation {
  const MemberLocation({
    required this.id,
    required this.name,
    required this.isPorter,
    required this.hasLeft,
    required this.location,
    required this.lastSeenAt,
    required this.lastSyncedAt,
    this.offRoute = false,
    this.gpsDegraded = false,
    this.lastCheckpointName,
    this.lastCheckpointAt,
    this.behindStatus,
    this.lagMinutes,
  });

  factory MemberLocation.fromJson(Map<String, Object?> json) {
    final safety =
        (json['safety'] as Map?)?.cast<String, Object?>() ?? const {};
    final route = (safety['route'] as Map?)?.cast<String, Object?>();
    final gps = (safety['gps'] as Map?)?.cast<String, Object?>();
    final checkpoint = (safety['lastCheckpoint'] as Map?)
        ?.cast<String, Object?>();
    final behind = (safety['behindSchedule'] as Map?)?.cast<String, Object?>();
    final location = (json['location'] as Map?)?.cast<String, Object?>();
    DateTime? date(Object? value) =>
        value is String ? DateTime.parse(value) : null;
    return MemberLocation(
      id: json['id'] as String,
      name: json['name'] as String?,
      isPorter: json['role'] == 'porter',
      hasLeft: json['memberStatus'] == 'left',
      location: location == null ? null : SyncedLocation.fromJson(location),
      lastSeenAt: date(json['lastSeenAt']),
      lastSyncedAt: date(json['lastSyncedAt']),
      offRoute: route?['type'] == 'OFF_ROUTE',
      gpsDegraded: gps?['type'] == 'GPS_DEGRADED',
      lastCheckpointName: checkpoint?['checkpointName'] as String?,
      lastCheckpointAt: date(checkpoint?['arrivedAt']),
      behindStatus: behind?['status'] as String?,
      lagMinutes: (behind?['lagMinutes'] as num?)?.toInt(),
    );
  }

  final String id;
  final String? name;
  final bool isPorter;
  final bool hasLeft;
  final SyncedLocation? location;
  final DateTime? lastSeenAt;
  final DateTime? lastSyncedAt;
  final bool offRoute;
  final bool gpsDegraded;
  final String? lastCheckpointName;
  final DateTime? lastCheckpointAt;

  /// Server CTMS-063 status (`BEHIND`, `SEVERELY_BEHIND`, …); null when not evaluated.
  final String? behindStatus;
  final int? lagMinutes;

  bool get isBehind =>
      behindStatus == 'BEHIND' || behindStatus == 'SEVERELY_BEHIND';
  bool get hasSafetyWarning => offRoute || gpsDegraded || isBehind;

  /// Freshness at [now] from the server's capture time and threshold, so a position never stays
  /// "fresh" as time passes. A future-dated capture is never fresh.
  LocationFreshness freshnessAt(DateTime now, int maxAgeSeconds) {
    final seen = lastSeenAt;
    if (seen == null) return LocationFreshness.unavailable;
    final age = now.difference(seen).inMilliseconds / 1000;
    return age >= 0 && age <= maxAgeSeconds
        ? LocationFreshness.fresh
        : LocationFreshness.stale;
  }
}

class TripMemberLocations {
  const TripMemberLocations({
    required this.generatedAt,
    required this.freshnessMaxAgeSeconds,
    required this.members,
  });

  factory TripMemberLocations.fromJson(Map<String, Object?> json) =>
      TripMemberLocations(
        generatedAt: DateTime.parse(json['generatedAt'] as String),
        freshnessMaxAgeSeconds: (json['freshnessMaxAgeSeconds'] as num).toInt(),
        members: [
          for (final item in (json['members'] as List? ?? const []))
            MemberLocation.fromJson((item as Map).cast<String, Object?>()),
        ],
      );

  final DateTime generatedAt;
  final int freshnessMaxAgeSeconds;
  final List<MemberLocation> members;
}

abstract interface class MemberLocationsApi {
  Future<TripMemberLocations> fetch(String tripId);
}

class HttpMemberLocationsApi implements MemberLocationsApi {
  HttpMemberLocationsApi(this.client);
  final ApiClient client;

  @override
  Future<TripMemberLocations> fetch(String tripId) async {
    final response = await client.get<Map<String, Object?>>(
      ApiEndpoints.trips.memberLocations(tripId),
    );
    return TripMemberLocations.fromJson(response.data!);
  }
}
