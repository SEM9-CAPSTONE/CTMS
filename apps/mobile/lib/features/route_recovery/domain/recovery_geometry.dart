import 'dart:math';

const _radius = 6371008.8;
double _radians(double degrees) => degrees * pi / 180;
double _wrap(double degrees) => (degrees + 180) % 360 - 180;

class RecoveryPoint {
  const RecoveryPoint(this.latitude, this.longitude);
  final double latitude;
  final double longitude;
  bool get valid =>
      latitude.isFinite &&
      longitude.isFinite &&
      latitude.abs() <= 90 &&
      longitude.abs() <= 180;
}

class RecoveryTarget {
  const RecoveryTarget(
    this.origin,
    this.point,
    this.distanceMeters,
    this.bearingDegrees,
  );
  final RecoveryPoint origin;
  final RecoveryPoint point;
  final double distanceMeters;
  final double? bearingDegrees;
}

double recoveryDistance(RecoveryPoint a, RecoveryPoint b) {
  final lat = _radians(b.latitude - a.latitude);
  final lon = _radians(_wrap(b.longitude - a.longitude));
  final h =
      (pow(sin(lat / 2), 2) +
              cos(_radians(a.latitude)) *
                  cos(_radians(b.latitude)) *
                  pow(sin(lon / 2), 2))
          .clamp(0.0, 1.0);
  return 2 * _radius * atan2(sqrt(h), sqrt(1 - h));
}

/// Candidate points use a local equirectangular projection per segment.
/// Final distance and true-north initial bearing use spherical formulas.
/// Unwrap each segment at the antimeridian before projection; never connect it across Greenwich.
RecoveryTarget? nearestRecoveryTarget(
  RecoveryPoint origin,
  List<RecoveryPoint> route,
) {
  if (!origin.valid ||
      origin.latitude.abs() >= 89.9 ||
      route.length < 2 ||
      route.any((p) => !p.valid)) {
    return null;
  }
  final cosLat = cos(_radians(origin.latitude));
  RecoveryPoint? best;
  var distance = double.infinity;
  for (var i = 1; i < route.length; i++) {
    final a = route[i - 1];
    final b = route[i];
    final aLon = _wrap(a.longitude - origin.longitude);
    var bLon = aLon + _wrap(b.longitude - a.longitude);
    // Select the segment's equivalent world nearest the query point.
    final shift = ((aLon + bLon) / 2 / 360).round() * 360;
    final ax = _radians(aLon - shift) * cosLat;
    final ay = _radians(a.latitude - origin.latitude);
    bLon -= shift;
    final bx = _radians(bLon) * cosLat;
    final by = _radians(b.latitude - origin.latitude);
    final dx = bx - ax;
    final dy = by - ay;
    final length = dx * dx + dy * dy;
    final t = length == 0
        ? 0.0
        : (-(ax * dx + ay * dy) / length).clamp(0.0, 1.0);
    final candidate = RecoveryPoint(
      a.latitude + t * (b.latitude - a.latitude),
      _wrap(origin.longitude + (ax + t * dx) / cosLat * 180 / pi),
    );
    final metres = recoveryDistance(origin, candidate);
    if (metres < distance) {
      best = candidate;
      distance = metres;
    }
  }
  if (best == null) return null;
  // Sub-millimetre rounding noise must not manufacture a north bearing on-route.
  if (distance < 0.001) return RecoveryTarget(origin, best, 0, null);
  final lat1 = _radians(origin.latitude);
  final lat2 = _radians(best.latitude);
  final dLon = _radians(_wrap(best.longitude - origin.longitude));
  final bearing =
      atan2(
        sin(dLon) * cos(lat2),
        cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon),
      ) *
      180 /
      pi;
  return RecoveryTarget(origin, best, distance, (bearing + 360) % 360);
}

/// One vocabulary for both visual text and accessibility labels; absolute true north.
String recoveryDirection(double bearing) => const [
  'Bắc',
  'Đông Bắc',
  'Đông',
  'Đông Nam',
  'Nam',
  'Tây Nam',
  'Tây',
  'Tây Bắc',
][((bearing + 22.5) % 360 / 45).floor()];
