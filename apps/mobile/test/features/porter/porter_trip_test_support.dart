import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/emergency_broadcasts/application/emergency_broadcasts_controller.dart';
import 'package:mobile/features/emergency_broadcasts/data/emergency_broadcast_seen_store.dart';
import 'package:mobile/features/emergency_broadcasts/data/emergency_broadcasts_api.dart';
import 'package:mobile/features/gps_tracking/application/gps_tracking_controller.dart';
import 'package:mobile/features/member_locations/application/member_locations_controller.dart';
import 'package:mobile/features/member_locations/data/member_locations_api.dart';
import 'package:mobile/features/offline_map/application/offline_map_controller.dart';
import 'package:mobile/features/offline_map/domain/offline_map_models.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';
import 'package:mobile/features/route_deviation/application/route_deviation_controller.dart';
import 'package:mobile/features/schedule_progress/application/schedule_progress_controller.dart';
import 'package:mobile/features/schedule_progress/data/schedule_progress_api.dart';
import '../gps_tracking/gps_fakes.dart' as gps;
import '../route_deviation/route_deviation_fakes.dart' as deviation;

const tripOne = '11111111-1111-4111-8111-111111111111';
const tripTwo = '22222222-2222-4222-8222-222222222222';

class IdleDownload extends PackageDownloadController {
  IdleDownload(String id) : super(id, () => throw StateError('Not requested')) {
    loading = false;
  }
}

class RecordingGps extends GpsTrackingController {
  RecordingGps(String id)
    : super(
        tripId: id,
        api: gps.FakeGpsTrackingApi(),
        store: gps.MemoryGpsLogStore(),
        location: gps.FakeLocationSource(),
        autoStart: false,
      );
  bool wasDisposed = false;
  @override
  void dispose() {
    wasDisposed = true;
    super.dispose();
  }
}

class IdleMap extends OfflineMapController {
  IdleMap(String id) : super(tripId: id, autoStart: false);
  int reloads = 0;
  @override
  OfflineMapState get state => OfflineMapState(
    tripId: tripId,
    packageStatus: OfflineMapPackageStatus.packageMissing,
  );
  @override
  Future<void> reloadPackage({bool force = false}) async {
    reloads++;
  }
}

class _MemberApi implements MemberLocationsApi {
  @override
  Future<TripMemberLocations> fetch(String tripId) async =>
      TripMemberLocations.fromJson({
        'generatedAt': DateTime.now().toIso8601String(),
        'freshnessMaxAgeSeconds': 120,
        'members': [
          {
            'id': 'member-$tripId',
            'name': tripId == tripOne ? 'Trần Minh An' : 'Lê Thu Hà',
            'role': 'camper',
            'memberStatus': 'joined',
            'lastSeenAt': null,
            'lastSyncedAt': null,
            'safety': {
              'route': {'type': 'OFF_ROUTE', 'distanceToRouteMeters': 75},
            },
          },
        ],
      });
}

class _ScheduleApi implements ScheduleProgressApi {
  @override
  Future<ScheduleProgress> fetch(String tripId) async =>
      ScheduleProgress.fromJson({
        'tripId': tripId,
        'tripStatus': 'ongoing',
        'evaluatedAt': DateTime.now().toIso8601String(),
        'viewer': 'porter',
        'configVersion': 'v3',
        'thresholds': {'behindMinutes': 30, 'severelyBehindMinutes': 60},
        'members': <Map<String, Object?>>[],
      });
}

class _BroadcastApi implements EmergencyBroadcastsApi {
  @override
  Future<List<EmergencyBroadcast>> fetch(String tripId) async => [];
}

class _Seen implements EmergencyBroadcastSeenStore {
  @override
  Future<Set<String>> read(String tripId) async => {};
  @override
  Future<void> save(String tripId, Set<String> ids) async {}
}

List<Override> trackingOverrides({Map<String, RecordingGps>? createdGps}) => [
  packageDownloadControllerProvider.overrideWith((ref, id) => IdleDownload(id)),
  offlineMapControllerProvider.overrideWith((ref, id) => IdleMap(id)),
  gpsTrackingControllerProvider.overrideWith((ref, id) {
    final controller = RecordingGps(id);
    createdGps?[id] = controller;
    return controller;
  }),
  routeDeviationControllerProvider.overrideWith(
    (ref, id) => RouteDeviationController(
      tripId: id,
      gps: ref.watch(gpsTrackingControllerProvider(id)),
      api: deviation.FakeRouteDeviationApi(),
      store: deviation.MemoryRouteDeviationStore(),
      autoStart: false,
    ),
  ),
  memberLocationsApiProvider.overrideWithValue(_MemberApi()),
  scheduleProgressApiProvider.overrideWithValue(_ScheduleApi()),
  emergencyBroadcastsControllerProvider.overrideWith(
    (ref, id) => EmergencyBroadcastsController(
      tripId: id,
      api: _BroadcastApi(),
      seenStore: _Seen(),
      connectivity: const Stream.empty(),
    ),
  ),
];
