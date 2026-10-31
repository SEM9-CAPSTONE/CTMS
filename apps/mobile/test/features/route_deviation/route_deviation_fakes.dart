import 'dart:math';

import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';
import 'package:mobile/features/route_deviation/data/route_deviation_api.dart';
import 'package:mobile/features/route_deviation/data/route_deviation_store.dart';
import 'package:mobile/features/route_deviation/domain/route_deviation_models.dart';

import '../gps_tracking/gps_fakes.dart' show tripId;

export '../gps_tracking/gps_fakes.dart' show tripId, offline, httpError;

const routeLongitude = 108.4;

/// Straight north–south Route along [routeLongitude] (about 2.2 km long).
const routeCoordinates = [
  [routeLongitude, 11.50],
  [routeLongitude, 11.52],
];

RouteDeviationContext routeContext({
  bool eligible = true,
  String? reason,
  String routeVersion = 'route-v1',
  String configVersion = 'v3',
}) => RouteDeviationContext(
  tripId: tripId,
  eligible: eligible,
  reason: reason,
  participantRole: 'camper',
  routeId: '22222222-2222-4222-8222-222222222222',
  routeVersion: routeVersion,
  coordinates: routeCoordinates,
  configVersion: configVersion,
);

/// A sample [meters] east of the Route, halfway along it.
GpsSample sampleOffRoute(DateTime capturedAt, double meters, {double accuracy = 8}) {
  const latitude = 11.51;
  final longitude = routeLongitude + meters / (6371008.8 * cos(latitude * pi / 180)) * 180 / pi;
  return GpsSample(
    capturedAt: capturedAt,
    latitude: latitude,
    longitude: longitude,
    accuracyMeters: accuracy,
  );
}

class MemoryRouteDeviationStore implements RouteDeviationStore {
  final Map<String, RouteDeviationRecord> records = {};
  int writes = 0;

  @override
  Future<RouteDeviationRecord> read(String tripId) async =>
      records[tripId] ?? const RouteDeviationRecord();

  @override
  Future<RouteDeviationRecord> update(
    String tripId,
    RouteDeviationRecord Function(RouteDeviationRecord current) transform,
  ) async {
    writes++;
    final next = transform(records[tripId] ?? const RouteDeviationRecord());
    records[tripId] = next;
    return next;
  }
}

class FakeRouteDeviationApi implements RouteDeviationApi {
  RouteDeviationContext Function() contextResult = routeContext;
  Object? contextError;

  /// Outcome per event id; missing ids are accepted.
  final Map<String, ({String status, String? reason})> outcomes = {};
  Object? uploadError;
  final List<List<LocalSafetyEvent>> uploads = [];

  @override
  Future<RouteDeviationContext> context(String tripId) async {
    if (contextError != null) throw contextError!;
    return contextResult();
  }

  @override
  Future<List<SafetyEventUploadResult>> upload(
    String tripId,
    List<LocalSafetyEvent> events,
  ) async {
    uploads.add(events);
    if (uploadError != null) throw uploadError!;
    return [
      for (final event in events)
        SafetyEventUploadResult(
          id: event.id,
          status: outcomes[event.id]?.status ?? 'accepted',
          reason: outcomes[event.id]?.reason,
        ),
    ];
  }
}

LocalSafetyEvent offRouteEvent(DateTime at, {String id = '33333333-3333-4333-8333-333333333333'}) =>
    LocalSafetyEvent(
      id: id,
      tripId: tripId,
      type: SafetyEventType.offRoute,
      eventTime: at,
      latitude: 11.51,
      longitude: 108.401,
      accuracyMeters: 8,
      distanceToRouteMeters: 65,
      consecutiveValidSamples: 3,
      detectedOffline: true,
      routeVersion: 'route-v1',
      configVersion: 'v3',
    );
