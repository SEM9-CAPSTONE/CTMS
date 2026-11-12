import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/route_recovery/domain/recovery_geometry.dart';
import '../../../test_driver/son_tra_preview_route.dart';

void main() {
  test('Son Tra return distance agrees with actual Mercator screen resolution', () {
    final anchor = sonTraPreviewRoute[sonTraPreviewRoute.length ~/ 2];
    final origin = RecoveryPoint(anchor.latitude + .003, anchor.longitude);
    final target = nearestRecoveryTarget(origin, sonTraPreviewRoute)!;
    expect(target.distanceMeters, inInclusiveRange(146, 148));
    // Independent GeographicLib 2.1 WGS84 inverse: this pair is 146.3328335 m.
    // Allow 0.4 m here for the documented spherical/ellipsoidal difference (~0.31 m).
    expect(target.distanceMeters, closeTo(146.33283348606992, .4));
    expect(target.bearingDegrees, inInclusiveRange(138, 140));
    final camera = MapCamera.initialCamera(
      MapOptions(
        initialCenter: LatLng(origin.latitude, origin.longitude),
        initialZoom: 15,
      ),
    ).withNonRotatedSize(const Size(600, 340));
    final a = camera.latLngToScreenOffset(
      LatLng(origin.latitude, origin.longitude),
    );
    final b = camera.latLngToScreenOffset(
      LatLng(target.point.latitude, target.point.longitude),
    );
    final resolution =
        2 *
        math.pi *
        6378137 *
        math.cos(origin.latitude * math.pi / 180) /
        (256 * math.pow(2, camera.zoom));
    // Mercator uses the WGS84 semi-major radius; haversine uses mean Earth radius.
    expect((a - b).distance * resolution, closeTo(target.distanceMeters, .3));
    expect(
      (a - b).distance / (200 / resolution),
      closeTo(target.distanceMeters / 200, .002),
    );
    final known = recoveryDistance(
      const RecoveryPoint(16.1, 108.28),
      const RecoveryPoint(16.101, 108.28),
    );
    expect(known, closeTo(111.19508, .001));
  });
  test(
    'projects onto segment and calculates spherical distance and south bearing',
    () {
      final result = nearestRecoveryTarget(
        const RecoveryPoint(.001, .005),
        const [RecoveryPoint(0, 0), RecoveryPoint(0, .01)],
      )!;
      expect(result.point.latitude, closeTo(0, 1e-10));
      expect(result.point.longitude, closeTo(.005, 1e-10));
      expect(result.distanceMeters, closeTo(111.195, .05));
      expect(result.bearingDegrees, closeTo(180, .001));
    },
  );
  test('on-route position has no invented north bearing', () {
    final result = nearestRecoveryTarget(const RecoveryPoint(0, .005), const [
      RecoveryPoint(0, 0),
      RecoveryPoint(0, .01),
    ])!;
    expect(result.distanceMeters, 0);
    expect(result.bearingDegrees, isNull);
  });
  test('zero length segment is handled without division by zero', () {
    final result = nearestRecoveryTarget(const RecoveryPoint(.001, 0), const [
      RecoveryPoint(0, 0),
      RecoveryPoint(0, 0),
    ])!;
    expect(result.distanceMeters, closeTo(111.195, .05));
    expect(result.bearingDegrees, closeTo(180, .01));
  });
  test('shared vertex produces deterministic target', () {
    final result = nearestRecoveryTarget(
      const RecoveryPoint(-.001, -.001),
      const [RecoveryPoint(0, .01), RecoveryPoint(0, 0), RecoveryPoint(.01, 0)],
    )!;
    expect(result.point.latitude, closeTo(0, 1e-10));
    expect(result.point.longitude, closeTo(0, 1e-10));
  });
  test('antimeridian route uses short segment, not a path via Greenwich', () {
    final result = nearestRecoveryTarget(const RecoveryPoint(.001, 180), const [
      RecoveryPoint(0, 179.99),
      RecoveryPoint(0, -179.99),
    ])!;
    expect(result.point.longitude.abs(), closeTo(180, 1e-9));
    expect(result.distanceMeters, closeTo(111.195, .05));
    final far = nearestRecoveryTarget(const RecoveryPoint(0, 0), const [
      RecoveryPoint(0, 179.99),
      RecoveryPoint(0, -179.99),
    ])!;
    expect(far.distanceMeters, greaterThan(19000000));
  });
  test('empty and singleton routes have no guidance', () {
    expect(nearestRecoveryTarget(const RecoveryPoint(0, 0), const []), isNull);
    expect(
      nearestRecoveryTarget(const RecoveryPoint(0, 0), const [
        RecoveryPoint(0, 0),
      ]),
      isNull,
    );
  });
  test('invalid GPS or route data cannot produce a target', () {
    for (final p in [
      RecoveryPoint(double.nan, 0),
      RecoveryPoint(0, double.infinity),
      const RecoveryPoint(91, 0),
      const RecoveryPoint(0, 181),
    ]) {
      expect(
        nearestRecoveryTarget(p, const [
          RecoveryPoint(0, 0),
          RecoveryPoint(0, .01),
        ]),
        isNull,
      );
      expect(
        nearestRecoveryTarget(const RecoveryPoint(0, 0), [
          const RecoveryPoint(0, 0),
          p,
        ]),
        isNull,
      );
    }
  });
  test('bearing vocabulary covers boundaries and all true-north octants', () {
    expect(
      [
        for (final b in [0.0, 45, 90, 135, 180, 225, 270, 315])
          recoveryDirection(b.toDouble()),
      ],
      [
        'Bắc',
        'Đông Bắc',
        'Đông',
        'Đông Nam',
        'Nam',
        'Tây Nam',
        'Tây',
        'Tây Bắc',
      ],
    );
    expect(recoveryDirection(359.99), 'Bắc');
    expect(recoveryDirection(22.5), 'Đông Bắc');
  });
}
