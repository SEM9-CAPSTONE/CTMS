import 'dart:math';

const _earthRadiusMeters = 6371008.8;

/// Shortest distance in meters from a GPS position to the Route LineString
/// (`[longitude, latitude]` positions), computed on the device (BR-238, BR-375).
///
/// Each segment is projected onto a local equirectangular plane centred on the
/// position, which is accurate to well under a meter at the distances that
/// matter for the 20 m / 50 m thresholds.
double distanceToRouteMeters({
  required double latitude,
  required double longitude,
  required List<List<double>> route,
}) {
  if (route.isEmpty) {
    throw ArgumentError('Route geometry has no positions');
  }
  final cosLatitude = cos(latitude * pi / 180);
  (double, double) toPlane(List<double> position) => (
    (position[0] - longitude) * pi / 180 * _earthRadiusMeters * cosLatitude,
    (position[1] - latitude) * pi / 180 * _earthRadiusMeters,
  );

  if (route.length == 1) {
    final (x, y) = toPlane(route.first);
    return sqrt(x * x + y * y);
  }

  var best = double.infinity;
  var (ax, ay) = toPlane(route.first);
  for (var index = 1; index < route.length; index++) {
    final (bx, by) = toPlane(route[index]);
    final dx = bx - ax;
    final dy = by - ay;
    final lengthSquared = dx * dx + dy * dy;
    // Projection of the position (the origin) onto the segment, clamped to it.
    final t = lengthSquared == 0 ? 0.0 : ((-ax * dx - ay * dy) / lengthSquared).clamp(0.0, 1.0);
    final px = ax + t * dx;
    final py = ay + t * dy;
    best = min(best, sqrt(px * px + py * py));
    ax = bx;
    ay = by;
  }
  return best;
}
