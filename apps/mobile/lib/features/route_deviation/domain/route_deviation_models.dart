/// Route geometry and version the device detects against, from
/// `GET /trips/:tripId/route-deviation/context` (CTMS-060). Cached locally so
/// detection keeps working offline (BR-238, BR-242).
class RouteDeviationContext {
  const RouteDeviationContext({
    required this.tripId,
    required this.eligible,
    required this.reason,
    required this.participantRole,
    required this.routeId,
    required this.routeVersion,
    required this.coordinates,
    required this.configVersion,
  });

  final String tripId;
  final bool eligible;
  final String? reason;
  final String participantRole;
  final String routeId;
  final String routeVersion;

  /// GeoJSON LineString positions as `[longitude, latitude]`.
  final List<List<double>> coordinates;
  final String configVersion;

  factory RouteDeviationContext.fromJson(Map<String, Object?> json) {
    final geometry = Map<String, Object?>.from(json['geometry'] as Map);
    return RouteDeviationContext(
      tripId: json['tripId'] as String,
      eligible: json['eligible'] as bool,
      reason: json['reason'] as String?,
      participantRole: json['participantRole'] as String,
      routeId: json['routeId'] as String,
      routeVersion: json['routeVersion'] as String,
      coordinates: [
        for (final position in geometry['coordinates'] as List)
          [for (final value in position as List) (value as num).toDouble()],
      ],
      configVersion: json['configVersion'] as String,
    );
  }

  Map<String, Object?> toJson() => {
    'tripId': tripId,
    'eligible': eligible,
    'reason': reason,
    'participantRole': participantRole,
    'routeId': routeId,
    'routeVersion': routeVersion,
    'geometry': {'type': 'LineString', 'coordinates': coordinates},
    'configVersion': configVersion,
  };
}

/// Primary navigation state (spec Section 6).
enum RouteNavigationState { onRoute, offRoute }

/// GPS quality state (spec Section 6).
enum GpsQualityState { normal, degraded }

/// Transitions persisted as safety events; [wireName] is the API enum value.
enum SafetyEventType {
  offRoute('OFF_ROUTE'),
  onRouteRecovered('ON_ROUTE_RECOVERED'),
  gpsDegraded('GPS_DEGRADED'),
  gpsRestored('GPS_RESTORED');

  const SafetyEventType(this.wireName);
  final String wireName;

  static SafetyEventType fromWire(String value) =>
      values.firstWhere((type) => type.wireName == value);
}

enum SafetyEventSyncState { pending, synced, failed }

/// A transition confirmed on the device. Detection data is immutable; only the
/// delivery fields change while synchronizing (BR-243, BR-244).
class LocalSafetyEvent {
  const LocalSafetyEvent({
    required this.id,
    required this.tripId,
    required this.type,
    required this.eventTime,
    required this.detectedOffline,
    required this.routeVersion,
    required this.configVersion,
    this.latitude,
    this.longitude,
    this.accuracyMeters,
    this.distanceToRouteMeters,
    this.consecutiveValidSamples,
    this.noValidSampleSince,
    this.packageVersion,
    this.syncState = SafetyEventSyncState.pending,
    this.rejectionReason,
    this.attempts = 0,
    this.nextAttemptAt,
    this.error,
  });

  final String id;
  final String tripId;
  final SafetyEventType type;
  final DateTime eventTime;
  final double? latitude;
  final double? longitude;
  final double? accuracyMeters;
  final double? distanceToRouteMeters;
  final int? consecutiveValidSamples;
  final DateTime? noValidSampleSince;
  final bool detectedOffline;
  final String routeVersion;
  final String? packageVersion;
  final String configVersion;
  final SafetyEventSyncState syncState;
  final String? rejectionReason;
  final int attempts;
  final DateTime? nextAttemptAt;
  final String? error;

  bool isDueForSync(DateTime now) =>
      syncState == SafetyEventSyncState.pending &&
      (nextAttemptAt == null || !nextAttemptAt!.isAfter(now));

  LocalSafetyEvent delivery({
    required SafetyEventSyncState syncState,
    String? rejectionReason,
    int? attempts,
    DateTime? nextAttemptAt,
    String? error,
  }) => LocalSafetyEvent(
    id: id,
    tripId: tripId,
    type: type,
    eventTime: eventTime,
    latitude: latitude,
    longitude: longitude,
    accuracyMeters: accuracyMeters,
    distanceToRouteMeters: distanceToRouteMeters,
    consecutiveValidSamples: consecutiveValidSamples,
    noValidSampleSince: noValidSampleSince,
    detectedOffline: detectedOffline,
    routeVersion: routeVersion,
    packageVersion: packageVersion,
    configVersion: configVersion,
    syncState: syncState,
    rejectionReason: rejectionReason,
    attempts: attempts ?? this.attempts,
    nextAttemptAt: nextAttemptAt,
    error: error,
  );

  /// Body item for `POST /trips/:tripId/safety-events` (timestamps with offset, BR-188).
  Map<String, Object?> toPayload() => {
    'id': id,
    'eventType': type.wireName,
    'eventTime': eventTime.toUtc().toIso8601String(),
    if (latitude != null) 'latitude': latitude,
    if (longitude != null) 'longitude': longitude,
    if (accuracyMeters != null) 'accuracyMeters': accuracyMeters,
    if (distanceToRouteMeters != null) 'distanceToRouteMeters': distanceToRouteMeters,
    if (consecutiveValidSamples != null) 'consecutiveValidSamples': consecutiveValidSamples,
    if (noValidSampleSince != null)
      'noValidSampleSince': noValidSampleSince!.toUtc().toIso8601String(),
    'detectedOffline': detectedOffline,
    'routeVersion': routeVersion,
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

  factory LocalSafetyEvent.fromJson(Map<String, Object?> json) {
    DateTime? time(String key) => json[key] == null ? null : DateTime.parse(json[key] as String);
    return LocalSafetyEvent(
      id: json['id'] as String,
      tripId: json['tripId'] as String,
      type: SafetyEventType.fromWire(json['eventType'] as String),
      eventTime: DateTime.parse(json['eventTime'] as String),
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      accuracyMeters: (json['accuracyMeters'] as num?)?.toDouble(),
      distanceToRouteMeters: (json['distanceToRouteMeters'] as num?)?.toDouble(),
      consecutiveValidSamples: (json['consecutiveValidSamples'] as num?)?.toInt(),
      noValidSampleSince: time('noValidSampleSince'),
      detectedOffline: json['detectedOffline'] as bool,
      routeVersion: json['routeVersion'] as String,
      packageVersion: json['packageVersion'] as String?,
      configVersion: json['configVersion'] as String,
      syncState: SafetyEventSyncState.values.byName(json['syncState'] as String),
      rejectionReason: json['rejectionReason'] as String?,
      attempts: (json['attempts'] as num?)?.toInt() ?? 0,
      nextAttemptAt: time('nextAttemptAt'),
      error: json['error'] as String?,
    );
  }
}

/// Everything persisted per Trip in one file, so a confirmed transition and its
/// safety event are always written together (BR-386).
class RouteDeviationRecord {
  const RouteDeviationRecord({
    this.context,
    this.navigation = RouteNavigationState.onRoute,
    this.quality = GpsQualityState.normal,
    this.events = const [],
  });

  final RouteDeviationContext? context;
  final RouteNavigationState navigation;
  final GpsQualityState quality;
  final List<LocalSafetyEvent> events;

  RouteDeviationRecord copyWith({
    RouteDeviationContext? context,
    RouteNavigationState? navigation,
    GpsQualityState? quality,
    List<LocalSafetyEvent>? events,
  }) => RouteDeviationRecord(
    context: context ?? this.context,
    navigation: navigation ?? this.navigation,
    quality: quality ?? this.quality,
    events: events ?? this.events,
  );

  Map<String, Object?> toJson() => {
    'context': context?.toJson(),
    'navigation': navigation.name,
    'quality': quality.name,
    'events': events.map((event) => event.toJson()).toList(),
  };

  factory RouteDeviationRecord.fromJson(Map<String, Object?> json) => RouteDeviationRecord(
    context: json['context'] == null
        ? null
        : RouteDeviationContext.fromJson(Map<String, Object?>.from(json['context'] as Map)),
    navigation: RouteNavigationState.values.byName(json['navigation'] as String),
    quality: GpsQualityState.values.byName(json['quality'] as String),
    events: [
      for (final item in json['events'] as List)
        LocalSafetyEvent.fromJson(Map<String, Object?>.from(item as Map)),
    ],
  );
}
