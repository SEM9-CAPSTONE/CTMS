import 'package:mobile/features/offline_map/domain/offline_map_models.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';
import 'package:mobile/features/route_recovery/domain/recovery_state.dart';

final recoveryNow = DateTime.utc(2026, 11, 11, 4);
OfflineMapContext recoveryContext({
  int version = 1,
  String? routeFingerprint,
}) => OfflineMapContext(
  tripId: 'trip',
  packageId: 'package-$version',
  packageVersion: version,
  packageSha256: 'a' * 64,
  route: OfflineRouteGeometry(
    routeId: 'route',
    fingerprint: routeFingerprint ?? 'b' * 64,
    points: const [
      OfflineRoutePoint(latitude: 0, longitude: 0),
      OfflineRoutePoint(latitude: 0, longitude: .01),
    ],
  ),
  checkpoints: const [],
);
RecoveryInput recoveryInput({
  OfflineMapContext? context,
  double accuracy = 5,
  double latitude = .001,
  DateTime? at,
  bool offRoute = true,
  bool matches = true,
}) => RecoveryInput(
  OfflineMapState(
    tripId: 'trip',
    packageStatus: OfflineMapPackageStatus.ready,
    context: context ?? recoveryContext(),
    location: OfflineMapLocationState(
      status: OfflineMapGpsStatus.ready,
      sample: GpsSample(
        capturedAt: at ?? recoveryNow,
        latitude: latitude,
        longitude: .005,
        accuracyMeters: accuracy,
      ),
    ),
  ),
  offRoute: offRoute,
  detectionActive: true,
  detectionRouteId: matches ? 'route' : 'other',
  detectionCoordinates: const [
    [0, 0],
    [.01, 0],
  ],
);
