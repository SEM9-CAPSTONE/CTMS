import '../../gps_tracking/domain/gps_tracking_models.dart';
import 'route_deviation_models.dart';
import 'route_geometry.dart';

/// Fixed V3 thresholds (spec Section 8). They must not be replaced by configurable
/// values unless the Product Backlog / Business Rules are revised.
const validSampleMaxAccuracyMeters = 20.0;
const offRouteMinDistanceMeters = 50.0;
const onRouteMaxDistanceMeters = 20.0;
const routeDeviationConsecutiveSamples = 3;
const gpsDegradedAfter = Duration(seconds: 120);

/// A transition confirmed by the detector, with the context that confirmed it.
class DetectedTransition {
  const DetectedTransition({
    required this.type,
    required this.eventTime,
    this.sample,
    this.distanceToRouteMeters,
    this.consecutiveValidSamples,
    this.noValidSampleSince,
  });

  final SafetyEventType type;
  final DateTime eventTime;

  /// Confirming sample; for GPS_DEGRADED the last known sample, if any.
  final GpsSample? sample;
  final double? distanceToRouteMeters;
  final int? consecutiveValidSamples;
  final DateTime? noValidSampleSince;
}

/// On-device route-deviation and GPS-quality state machine (CTMS-060, spec
/// Sections 6–7). Pure and synchronous so every Business Rule is unit-testable.
class RouteDeviationDetector {
  RouteDeviationDetector({
    required this.route,
    required DateTime startedAt,
    this.navigation = RouteNavigationState.onRoute,
    this.quality = GpsQualityState.normal,
  }) : _noValidSampleSince = startedAt;

  final List<List<double>> route;
  RouteNavigationState navigation;
  GpsQualityState quality;

  /// Consecutive VALID samples beyond 50 m while ON_ROUTE (BR-377).
  int offRouteCount = 0;

  /// Consecutive VALID samples within 20 m while OFF_ROUTE (BR-383).
  int recoveryCount = 0;

  GpsSample? lastSample;
  bool? lastSampleValid;
  double? lastDistanceMeters;

  /// Last VALID sample time, or the detection start when there was none yet.
  DateTime _noValidSampleSince;
  DateTime get noValidSampleSince => _noValidSampleSince;

  void _resetCounters() {
    offRouteCount = 0;
    recoveryCount = 0;
  }

  /// Processes one new GPS sample and returns the transitions it confirms.
  List<DetectedTransition> onSample(GpsSample sample) {
    lastSample = sample;
    if (sample.accuracyMeters > validSampleMaxAccuracyMeters) {
      // BR-378: an INVALID sample resets every consecutive counter; it is not paused.
      lastSampleValid = false;
      _resetCounters();
      return const [];
    }
    lastSampleValid = true;
    _noValidSampleSince = sample.capturedAt;
    final transitions = <DetectedTransition>[];

    if (quality == GpsQualityState.degraded) {
      // BR-388: back to NORMAL; counters from before the degraded period are gone.
      quality = GpsQualityState.normal;
      _resetCounters();
      transitions.add(
        DetectedTransition(
          type: SafetyEventType.gpsRestored,
          eventTime: sample.capturedAt,
          sample: sample,
        ),
      );
    }

    final distance = distanceToRouteMeters(
      latitude: sample.latitude,
      longitude: sample.longitude,
      route: route,
    );
    lastDistanceMeters = distance;

    switch (navigation) {
      case RouteNavigationState.onRoute:
        recoveryCount = 0;
        // Any VALID sample that fails the threshold (buffer or on route) resets it.
        offRouteCount = distance > offRouteMinDistanceMeters ? offRouteCount + 1 : 0;
        if (offRouteCount >= routeDeviationConsecutiveSamples) {
          transitions.add(
            DetectedTransition(
              type: SafetyEventType.offRoute,
              eventTime: sample.capturedAt,
              sample: sample,
              distanceToRouteMeters: distance,
              consecutiveValidSamples: offRouteCount,
            ),
          );
          navigation = RouteNavigationState.offRoute;
          offRouteCount = 0;
        }
      case RouteNavigationState.offRoute:
        offRouteCount = 0;
        recoveryCount = distance < onRouteMaxDistanceMeters ? recoveryCount + 1 : 0;
        if (recoveryCount >= routeDeviationConsecutiveSamples) {
          transitions.add(
            DetectedTransition(
              type: SafetyEventType.onRouteRecovered,
              eventTime: sample.capturedAt,
              sample: sample,
              distanceToRouteMeters: distance,
              consecutiveValidSamples: recoveryCount,
            ),
          );
          navigation = RouteNavigationState.onRoute;
          recoveryCount = 0;
        }
    }
    return transitions;
  }

  /// Time-based check (BR-387): no VALID sample for at least two minutes while
  /// tracking means GPS_DEGRADED. It never changes the navigation state.
  List<DetectedTransition> onTick(DateTime now) {
    if (quality == GpsQualityState.degraded) return const [];
    if (now.difference(_noValidSampleSince) < gpsDegradedAfter) return const [];
    quality = GpsQualityState.degraded;
    _resetCounters();
    return [
      DetectedTransition(
        type: SafetyEventType.gpsDegraded,
        eventTime: now,
        sample: lastSample,
        noValidSampleSince: _noValidSampleSince,
      ),
    ];
  }
}
