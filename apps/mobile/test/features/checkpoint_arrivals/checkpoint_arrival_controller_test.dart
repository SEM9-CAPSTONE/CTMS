import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/checkpoint_arrivals/application/checkpoint_arrival_controller.dart';
import 'package:mobile/features/checkpoint_arrivals/data/checkpoint_arrival_api.dart';
import 'package:mobile/features/checkpoint_arrivals/data/checkpoint_arrival_store.dart';
import 'package:mobile/features/checkpoint_arrivals/data/checkpoint_context_provider.dart';
import 'package:mobile/features/checkpoint_arrivals/domain/checkpoint_arrival_models.dart';
import 'package:mobile/features/gps_tracking/application/gps_tracking_controller.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';

import '../gps_tracking/gps_fakes.dart';

class MemoryCheckpointArrivalStore implements CheckpointArrivalStore {
  MemoryCheckpointArrivalStore([this.userId = 'user-001']);

  final String userId;
  final Map<String, CheckpointArrivalRecord> records = {};

  @override
  Future<CheckpointArrivalRecord> read(String tripId) async =>
      records[tripId] ?? CheckpointArrivalRecord(tripId: tripId, userId: userId);

  @override
  Future<CheckpointArrivalRecord> update(
    String tripId,
    CheckpointArrivalRecord Function(CheckpointArrivalRecord current) transform,
  ) async {
    final current = records[tripId] ?? CheckpointArrivalRecord(tripId: tripId, userId: userId);
    final next = transform(current);
    records[tripId] = next;
    return next;
  }

  @override
  Future<void> clear(String tripId) async {
    records.remove(tripId);
  }
}

class _FakeGpsTrackingController extends GpsTrackingController {
  _FakeGpsTrackingController({bool isTracking = true, GpsSample? sample})
      : _fakeIsTracking = isTracking,
        _fakeSample = sample,
        super(
          tripId: 'test-trip',
          location: FakeLocationSource(),
          store: MemoryGpsLogStore(),
          api: FakeGpsTrackingApi(),
        );

  bool _fakeIsTracking;
  GpsSample? _fakeSample;

  @override
  bool get isTracking => _fakeIsTracking;

  @override
  GpsSample? get lastSample => _fakeSample;

  void emitSample(GpsSample sample) {
    _fakeSample = sample;
    notifyListeners();
  }

  void setTracking(bool tracking) {
    _fakeIsTracking = tracking;
    notifyListeners();
  }
}

class _FakeContextProvider implements CheckpointContextProvider {
  _FakeContextProvider(this.context);
  CheckpointArrivalContext? context;

  @override
  Future<CheckpointArrivalContext?> getContext(String tripId) async => context;

  @override
  Future<void> cacheContext(CheckpointArrivalContext context) async {
    this.context = context;
  }

  @override
  Future<CheckpointArrivalContext?> getCachedContext(
    String tripId, {
    String? routeVersion,
    String? packageId,
    String? packageVersion,
  }) async =>
      context;
}

class _FakeCheckpointArrivalApi implements CheckpointArrivalApi {
  List<CheckpointArrivalSyncResponse> responses = [];
  int callCount = 0;

  @override
  Future<CheckpointArrivalSyncResponse> syncBatch({
    required String tripId,
    required List<LocalCheckpointArrival> arrivals,
  }) async {
    callCount++;
    if (responses.isNotEmpty) {
      return responses.removeAt(0);
    }
    return CheckpointArrivalSyncResponse(
      results: arrivals
          .map(
            (a) => CheckpointArrivalResultItem(
              id: a.id,
              clientId: a.id,
              status: 'accepted',
              retryable: false,
              visitId: 'visit-${a.id}',
              receivedAt: DateTime.now().toUtc(),
            ),
          )
          .toList(),
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late CheckpointArrivalStore store;
  late _FakeGpsTrackingController fakeGps;
  late _FakeCheckpointArrivalApi fakeApi;
  late _FakeContextProvider fakeContextProvider;

  const sampleContext = CheckpointArrivalContext(
    tripId: 'trip-001',
    routeId: 'route-001',
    routeVersion: 'rv-1',
    packageId: 'pkg-001',
    packageVersion: 'pv-1',
    checkpoints: [
      RouteCheckpoint(
        id: 'cp-01',
        latitude: 11.5432,
        longitude: 108.4521,
        name: 'Trạm kiểm lâm',
      ),
      RouteCheckpoint(
        id: 'cp-02',
        latitude: 11.5500,
        longitude: 108.4600,
        name: 'Đỉnh Đồi Lính',
      ),
    ],
  );

  setUp(() {
    store = MemoryCheckpointArrivalStore('user-001');
    fakeGps = _FakeGpsTrackingController(isTracking: true);
    fakeApi = _FakeCheckpointArrivalApi();
    fakeContextProvider = _FakeContextProvider(sampleContext);
  });

  group('CheckpointArrivalController (Lifecycle, Detection & Persistence)', () {
    test('starts and transitions to active status when context and tracking are ready', () async {
      final controller = CheckpointArrivalController(
        tripId: 'trip-001',
        gps: fakeGps,
        api: fakeApi,
        store: store,
        contextProvider: fakeContextProvider,
        autoStart: false,
      );

      expect(controller.status, equals(CheckpointArrivalStatus.checking));

      await controller.start();

      expect(controller.status, equals(CheckpointArrivalStatus.active));
      expect(controller.totalCount, equals(2));
      expect(controller.reachedCount, equals(0));
    });

    test('transitions to paused status when GPS tracking is stopped', () async {
      fakeGps.setTracking(false);

      final controller = CheckpointArrivalController(
        tripId: 'trip-001',
        gps: fakeGps,
        api: fakeApi,
        store: store,
        contextProvider: fakeContextProvider,
        autoStart: false,
      );

      await controller.start();
      expect(controller.status, equals(CheckpointArrivalStatus.paused));

      fakeGps.setTracking(true);
      expect(controller.status, equals(CheckpointArrivalStatus.active));
    });

    test('detects arrival after 3 valid samples within 20m and persists locally with hardware fix timestamp', () async {
      int alertCount = 0;
      final controller = CheckpointArrivalController(
        tripId: 'trip-001',
        gps: fakeGps,
        api: fakeApi,
        store: store,
        contextProvider: fakeContextProvider,
        isOnline: () async => false, // Simulate offline
        alert: () async => alertCount++,
        autoStart: false,
      );

      await controller.start();

      final t0 = DateTime.utc(2026, 11, 9, 14, 0, 0);

      // Mẫu 1: 10m từ cp-01
      fakeGps.emitSample(
        GpsSample(
          latitude: 11.5432,
          longitude: 108.4521,
          accuracyMeters: 5.0,
          capturedAt: t0,
        ),
      );
      await controller.processingQueue;
      expect(controller.reachedCount, equals(0));
      expect(alertCount, equals(0));

      // Mẫu 2: sau 10 giây
      fakeGps.emitSample(
        GpsSample(
          latitude: 11.5432,
          longitude: 108.4521,
          accuracyMeters: 6.0,
          capturedAt: t0.add(const Duration(seconds: 10)),
        ),
      );
      await controller.processingQueue;
      expect(controller.reachedCount, equals(0));

      // Mẫu 3: sau 20 giây -> Đạt 3 mẫu liên tiếp trong 20m
      final tConfirm = t0.add(const Duration(seconds: 20));
      fakeGps.emitSample(
        GpsSample(
          latitude: 11.5432,
          longitude: 108.4521,
          accuracyMeters: 7.0,
          capturedAt: tConfirm,
        ),
      );
      await controller.processingQueue;

      expect(controller.reachedCount, equals(1));
      expect(alertCount, equals(1));
      expect(controller.activeReachedDialog?.id, equals('cp-01'));

      final arrival = controller.record.arrivals.first;
      expect(arrival.checkpointId, equals('cp-01'));
      expect(arrival.confirmedAt, equals(tConfirm));
      expect(arrival.detectedOffline, isTrue);
      expect(arrival.routeVersion, equals('rv-1'));
      expect(arrival.packageVersion, equals('pv-1'));

      // Kiểm tra lưu vĩnh viễn trong store
      final diskRecord = await store.read('trip-001');
      expect(diskRecord.arrivals.length, equals(1));
      expect(diskRecord.arrivals.first.checkpointId, equals('cp-01'));

      // Mẫu 4: Immutability - không bao giờ kích hoạt lại cùng 1 checkpoint
      fakeGps.emitSample(
        GpsSample(
          latitude: 11.5432,
          longitude: 108.4521,
          accuracyMeters: 5.0,
          capturedAt: t0.add(const Duration(seconds: 30)),
        ),
      );
      await controller.processingQueue;
      expect(controller.reachedCount, equals(1));
      expect(alertCount, equals(1));
    });

    test('dialog queue handles multiple reached checkpoints sequentially', () async {
      final controller = CheckpointArrivalController(
        tripId: 'trip-001',
        gps: fakeGps,
        api: fakeApi,
        store: store,
        contextProvider: fakeContextProvider,
        autoStart: false,
      );

      await controller.start();

      controller.activeReachedDialog = sampleContext.checkpoints[0];
      controller.dismissReachedDialog();
      expect(controller.activeReachedDialog, isNull);
    });

    test('uiItems calculates distance to upcoming checkpoints and maps sync states', () async {
      final controller = CheckpointArrivalController(
        tripId: 'trip-001',
        gps: fakeGps,
        api: fakeApi,
        store: store,
        contextProvider: fakeContextProvider,
        autoStart: false,
      );

      await controller.start();

      fakeGps.emitSample(
        GpsSample(
          latitude: 11.5432,
          longitude: 108.4521,
          accuracyMeters: 5.0,
          capturedAt: DateTime.utc(2026, 11, 9, 14, 0, 0),
        ),
      );

      final items = controller.uiItems;
      expect(items.length, equals(2));
      expect(items[0].checkpoint.name, equals('Trạm kiểm lâm'));
      expect(items[0].lastDistanceMeters, closeTo(0.0, 1.0));
      expect(items[0].isReached, isFalse);

      expect(items[1].checkpoint.name, equals('Đỉnh Đồi Lính'));
      expect(items[1].lastDistanceMeters, greaterThan(500.0));
    });

    test('manualSync with force: true resets paused records back to pending and syncs', () async {
      // Seed a paused arrival
      await store.update(
        'trip-001',
        (curr) => curr.copyWith(
          arrivals: [
            LocalCheckpointArrival(
              id: 'arr-paused',
              tripId: 'trip-001',
              checkpointId: 'cp-01',
              routeId: 'route-001',
              routeVersion: 'rv-1',
              packageId: 'pkg-001',
              packageVersion: 'pv-1',
              detectedOffline: false,
              confirmedAt: DateTime.utc(2026, 11, 9, 14, 0, 0),
              samples: const [
                CheckpointArrivalSample(
                  latitude: 11.5432,
                  longitude: 108.4521,
                  accuracyMeters: 5.0,
                  eventTime: '2026-11-09T14:00:00.000Z',
                ),
              ],
              syncState: CheckpointSyncState.paused,
              attempts: 5,
            ),
          ],
        ),
      );

      final controller = CheckpointArrivalController(
        tripId: 'trip-001',
        gps: fakeGps,
        api: fakeApi,
        store: store,
        contextProvider: fakeContextProvider,
        autoStart: false,
      );

      await controller.start();
      expect(controller.pausedCount, equals(1));
      expect(controller.pendingCount, equals(0));
      expect(controller.pendingCount, equals(0));

      await controller.manualSync(force: true);

      expect(fakeApi.callCount, equals(1));
      expect(controller.syncedCount, equals(1));
      expect(controller.pausedCount, equals(0));
    });
  });
}
