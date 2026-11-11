import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/checkpoint_arrivals/data/package_checkpoint_context_provider.dart';
import 'package:mobile/features/checkpoint_arrivals/domain/checkpoint_arrival_models.dart';
import 'package:mobile/features/offline_map/domain/offline_map_models.dart';

void main() {
  const core = OfflineMapContext(
    tripId: 'son-tra',
    packageId: 'package-v2',
    packageVersion: 2,
    route: OfflineRouteGeometry(
      routeId: 'route',
      points: [OfflineRoutePoint(latitude: 16.1, longitude: 108.2)],
    ),
    checkpoints: [
      OfflineMapCheckpoint(
        id: 'cp',
        routeId: 'route',
        name: 'Sơn Trà',
        type: 'start',
        latitude: 16.1,
        longitude: 108.2,
        radiusMeters: 30,
      ),
    ],
  );
  CheckpointArrivalContext arrival({
    String trip = 'son-tra',
    String package = 'package-v2',
    String version = '2',
    String source = 'authoritative',
    double latitude = 16.1,
  }) => CheckpointArrivalContext(
    tripId: trip,
    routeId: 'route',
    routeVersion: 'v2',
    packageId: package,
    packageVersion: version,
    contextSource: source,
    checkpoints: [
      RouteCheckpoint(
        id: 'cp',
        name: 'Sơn Trà',
        latitude: latitude,
        longitude: 108.2,
      ),
    ],
  );
  test(
    'map and detector accept identical package identity and checkpoint geometry',
    () => expect(
      PackageCheckpointContextProvider.matches(core, arrival()),
      isTrue,
    ),
  );
  test(
    'different trip, package, version, geometry or fabricated source is rejected',
    () {
      for (final context in [
        arrival(trip: 'hai-van'),
        arrival(package: 'other'),
        arrival(version: '1'),
        arrival(source: 'dev-fallback'),
        arrival(latitude: 16.2),
      ]) {
        expect(
          PackageCheckpointContextProvider.matches(core, context),
          isFalse,
        );
      }
    },
  );
}
