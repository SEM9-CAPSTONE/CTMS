import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/route_deviation/domain/route_deviation_detector.dart';
import 'package:mobile/features/route_deviation/domain/route_deviation_models.dart';
import 'package:mobile/features/route_deviation/domain/route_geometry.dart';

import 'route_deviation_fakes.dart';

void main() {
  final start = DateTime.utc(2026, 10, 31, 2);

  group('distanceToRouteMeters (BR-238 / BR-375)', () {
    test('measures the perpendicular distance to the nearest segment', () {
      for (final meters in [0.0, 18.0, 30.0, 55.0, 250.0]) {
        final sample = sampleOffRoute(start, meters);
        expect(
          distanceToRouteMeters(
            latitude: sample.latitude,
            longitude: sample.longitude,
            route: routeCoordinates,
          ),
          closeTo(meters, 0.5),
        );
      }
    });

    test('uses the segment end when the position is beyond it', () {
      final distance = distanceToRouteMeters(
        latitude: 11.53,
        longitude: routeLongitude,
        route: routeCoordinates,
      );
      expect(distance, closeTo(1112, 2), reason: '0.01° of latitude past the last vertex');
    });

    test('picks the closest of several segments', () {
      final distance = distanceToRouteMeters(
        latitude: 11.51,
        longitude: routeLongitude + 0.01,
        route: const [
          [routeLongitude, 11.50],
          [routeLongitude, 11.52],
          [routeLongitude + 0.01, 11.52],
          [routeLongitude + 0.01, 11.50],
        ],
      );
      expect(distance, closeTo(0, 0.5));
    });
  });

  group('RouteDeviationDetector', () {
    late RouteDeviationDetector detector;
    var second = 0;

    setUp(() {
      second = 0;
      detector = RouteDeviationDetector(route: routeCoordinates, startedAt: start);
    });

    List<SafetyEventType> feed(List<double> distances, {double accuracy = 8}) => [
      for (final meters in distances)
        ...detector
            .onSample(
              sampleOffRoute(start.add(Duration(seconds: 10 * ++second)), meters, accuracy: accuracy),
            )
            .map((transition) => transition.type),
    ];

    test('accuracy above 20 m is INVALID and resets the counters (BR-378)', () {
      feed([55, 60]);
      expect(detector.offRouteCount, 2);
      expect(feed([70], accuracy: 25), isEmpty);
      expect(detector.lastSampleValid, isFalse);
      expect(detector.offRouteCount, 0);
    });

    test('accuracy of exactly 20 m is VALID', () {
      expect(feed([55, 60, 65], accuracy: 20), [SafetyEventType.offRoute]);
    });

    test('distances 55, 60, 65 m confirm OFF_ROUTE with its context (BR-377)', () {
      final transitions = [
        detector.onSample(sampleOffRoute(start.add(const Duration(seconds: 10)), 55)),
        detector.onSample(sampleOffRoute(start.add(const Duration(seconds: 20)), 60)),
        detector.onSample(sampleOffRoute(start.add(const Duration(seconds: 30)), 65)),
      ].expand((items) => items).toList();

      expect(transitions.single.type, SafetyEventType.offRoute);
      expect(transitions.single.eventTime, start.add(const Duration(seconds: 30)));
      expect(transitions.single.distanceToRouteMeters, closeTo(65, 0.5));
      expect(transitions.single.consecutiveValidSamples, 3);
      expect(detector.navigation, RouteNavigationState.offRoute);
    });

    test('two VALID samples beyond 50 m keep the current state', () {
      expect(feed([55, 60]), isEmpty);
      expect(detector.navigation, RouteNavigationState.onRoute);
    });

    test('distances 55, 60, 30 m do not confirm OFF_ROUTE and reset the counter', () {
      expect(feed([55, 60, 30]), isEmpty);
      expect(detector.offRouteCount, 0);
      expect(feed([55, 60]), isEmpty, reason: 'counting restarts after the reset');
    });

    test('an INVALID sample between qualifying samples breaks the sequence', () {
      feed([55, 60]);
      feed([65], accuracy: 30);
      expect(feed([70, 75]), isEmpty);
      expect(detector.navigation, RouteNavigationState.onRoute);
    });

    test('OFF_ROUTE then 18, 15, 12 m recovers to ON_ROUTE (BR-382 / BR-383)', () {
      feed([55, 60, 65]);
      expect(feed([18, 15, 12]), [SafetyEventType.onRouteRecovered]);
      expect(detector.navigation, RouteNavigationState.onRoute);
    });

    test('OFF_ROUTE then 18, 30, 15 m does not confirm recovery', () {
      feed([55, 60, 65]);
      expect(feed([18, 30, 15]), isEmpty);
      expect(detector.navigation, RouteNavigationState.offRoute);
      expect(detector.recoveryCount, 1);
    });

    test('20–50 m is a buffer: no transition from either state', () {
      expect(feed([30, 30, 30, 50]), isEmpty);
      expect(detector.navigation, RouteNavigationState.onRoute);
      feed([55, 60, 65]);
      expect(feed([30, 20, 45]), isEmpty);
      expect(detector.navigation, RouteNavigationState.offRoute);
    });

    group('GPS quality (BR-387 / BR-388)', () {
      test('no VALID sample for two minutes means GPS_DEGRADED, never OFF_ROUTE', () {
        expect(detector.onTick(start.add(const Duration(seconds: 119))), isEmpty);
        final transitions = detector.onTick(start.add(const Duration(seconds: 120)));

        expect(transitions.single.type, SafetyEventType.gpsDegraded);
        expect(transitions.single.noValidSampleSince, start);
        expect(detector.quality, GpsQualityState.degraded);
        expect(detector.navigation, RouteNavigationState.onRoute);
        expect(detector.onTick(start.add(const Duration(minutes: 5))), isEmpty);
      });

      test('INVALID samples do not count as signal for the two-minute rule', () {
        feed([10]);
        final lastValid = detector.noValidSampleSince;
        feed([10, 10, 10], accuracy: 35);
        final transitions = detector.onTick(lastValid.add(const Duration(minutes: 2)));
        expect(transitions.single.noValidSampleSince, lastValid);
        expect(transitions.single.sample?.accuracyMeters, 35, reason: 'last known fix');
      });

      test('a VALID sample restores NORMAL and counters restart from zero', () {
        feed([55, 60]);
        detector.onTick(start.add(const Duration(minutes: 3)));
        expect(detector.offRouteCount, 0);

        expect(feed([65]), [SafetyEventType.gpsRestored]);
        expect(detector.quality, GpsQualityState.normal);
        expect(detector.offRouteCount, 1, reason: 'only the new sample counts');
        expect(feed([70, 75]), [SafetyEventType.offRoute]);
      });
    });
  });
}
