import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/checkpoint_arrivals/application/checkpoint_arrival_controller.dart';
import 'package:mobile/features/checkpoint_arrivals/data/checkpoint_arrival_api.dart';
import 'package:mobile/features/checkpoint_arrivals/data/checkpoint_arrival_store.dart';
import 'package:mobile/features/checkpoint_arrivals/data/checkpoint_context_provider.dart';
import 'package:mobile/features/checkpoint_arrivals/domain/checkpoint_arrival_models.dart';
import 'package:mobile/features/checkpoint_arrivals/presentation/checkpoint_arrival_panel.dart';
import 'package:mobile/features/gps_tracking/application/gps_tracking_controller.dart';

import '../gps_tracking/gps_fakes.dart';

class _MockStore implements CheckpointArrivalStore {
  CheckpointArrivalRecord record = const CheckpointArrivalRecord();

  @override
  Future<CheckpointArrivalRecord> read(String tripId) async => record;

  @override
  Future<CheckpointArrivalRecord> update(
    String tripId,
    CheckpointArrivalRecord Function(CheckpointArrivalRecord current) transform,
  ) async {
    record = transform(record);
    return record;
  }

  @override
  Future<void> clear(String tripId) async {
    record = const CheckpointArrivalRecord();
  }
}

class _MockContextProvider implements CheckpointContextProvider {
  _MockContextProvider(this.context);
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
  }) async => context;
}

class _MockApi implements CheckpointArrivalApi {
  int syncCallCount = 0;

  @override
  Future<CheckpointArrivalSyncResponse> syncBatch({
    required String tripId,
    required List<LocalCheckpointArrival> arrivals,
  }) async {
    syncCallCount++;
    return CheckpointArrivalSyncResponse(
      results: arrivals
          .map(
            (a) => CheckpointArrivalResultItem(
              id: a.id,
              clientId: a.id,
              status: 'accepted',
              retryable: false,
              visitId: 'visit-1',
              receivedAt: DateTime.now().toUtc(),
            ),
          )
          .toList(),
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const tripId = 'test-trip-001';

  const sampleContext = CheckpointArrivalContext(
    tripId: tripId,
    routeId: 'route-001',
    routeVersion: 'rv-1',
    packageId: 'pkg-001',
    packageVersion: 'pv-1',
    checkpoints: [
      RouteCheckpoint(
        id: 'cp-01',
        latitude: 11.5432,
        longitude: 108.4521,
        name: 'Trạm kiểm lâm số 1',
      ),
      RouteCheckpoint(
        id: 'cp-02',
        latitude: 11.5500,
        longitude: 108.4600,
        name: 'Đỉnh Lang Biang',
      ),
    ],
  );

  Future<void> pumpPanel(
    WidgetTester tester, {
    required CheckpointArrivalController controller,
    ValueChanged<RouteCheckpoint>? onSelectCheckpoint,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          checkpointArrivalControllerProvider(
            tripId,
          ).overrideWith((_) => controller),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: SingleChildScrollView(
              child: CheckpointArrivalPanel(
                tripId: tripId,
                onSelectCheckpoint: onSelectCheckpoint,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('renders placeholder when checkpoint context is null', (
    tester,
  ) async {
    final gps = GpsTrackingController(
      tripId: tripId,
      location: FakeLocationSource(),
      store: MemoryGpsLogStore(),
      api: FakeGpsTrackingApi(),
      autoStart: false,
    );
    final controller = CheckpointArrivalController(
      tripId: tripId,
      gps: gps,
      api: _MockApi(),
      store: _MockStore(),
      contextProvider: _MockContextProvider(null),
      isOnline: () async => false,
      alert: () async {},
      autoStart: false,
    );
    await tester.runAsync(() async {
      await controller.start();
    });

    await pumpPanel(tester, controller: controller);

    expect(find.text('Điểm kiểm tra tự động'), findsOneWidget);
    expect(
      find.text('Chưa phát hiện được vì chưa có dữ liệu điểm kiểm tra'),
      findsOneWidget,
    );
  });

  testWidgets(
    'renders checkpoints list, summary row, and distances when context is available',
    (tester) async {
      final gps = GpsTrackingController(
        tripId: tripId,
        location: FakeLocationSource(),
        store: MemoryGpsLogStore(),
        api: FakeGpsTrackingApi(),
        autoStart: false,
      );
      final controller = CheckpointArrivalController(
        tripId: tripId,
        gps: gps,
        api: _MockApi(),
        store: _MockStore(),
        contextProvider: _MockContextProvider(sampleContext),
        isOnline: () async => false,
        alert: () async {},
        autoStart: false,
      );
      await tester.runAsync(() async {
        await controller.start();
      });

      await pumpPanel(tester, controller: controller);

      expect(find.text('Điểm kiểm tra tự động'), findsOneWidget);
      expect(find.text('Đã ghi nhận: 0/2 trạm'), findsOneWidget);
      expect(find.text('Trạm kiểm lâm số 1'), findsOneWidget);
      expect(find.text('Đỉnh Lang Biang'), findsOneWidget);
      expect(find.text('Đồng bộ ngay'), findsOneWidget);
      RouteCheckpoint? selected;
      await pumpPanel(
        tester,
        controller: controller,
        onSelectCheckpoint: (cp) => selected = cp,
      );
      await tester.tap(find.text('Trạm kiểm lâm số 1'));
      expect(selected?.id, 'cp-01');
      expect(controller.reachedCount, 0);
    },
  );

  testWidgets(
    'triggers reached dialog and shows updated count when checkpoint is reached',
    (tester) async {
      final gps = GpsTrackingController(
        tripId: tripId,
        location: FakeLocationSource(),
        store: MemoryGpsLogStore(),
        api: FakeGpsTrackingApi(),
        autoStart: false,
      );
      final controller = CheckpointArrivalController(
        tripId: tripId,
        gps: gps,
        api: _MockApi(),
        store: _MockStore(),
        contextProvider: _MockContextProvider(sampleContext),
        isOnline: () async => false,
        alert: () async {},
        autoStart: false,
      );
      await tester.runAsync(() async {
        await controller.start();
      });

      await pumpPanel(tester, controller: controller);

      // Trigger reached dialog
      controller.activeReachedDialog = sampleContext.checkpoints.first;
      controller.notifyListeners();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(
        find.byKey(const Key('checkpoint-reached-dialog')),
        findsOneWidget,
      );
      expect(find.text('Đã đến điểm kiểm tra!'), findsOneWidget);
      expect(
        find.text('Trạm kiểm lâm số 1'),
        findsNWidgets(2),
      ); // in list and dialog

      // Tap dismiss
      await tester.tap(
        find.byKey(const Key('checkpoint-reached-dialog-dismiss')),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.byKey(const Key('checkpoint-reached-dialog')), findsNothing);
    },
  );

  testWidgets('tapping manual sync button triggers controller manualSync', (
    tester,
  ) async {
    final mockApi = _MockApi();
    final gps = GpsTrackingController(
      tripId: tripId,
      location: FakeLocationSource(),
      store: MemoryGpsLogStore(),
      api: FakeGpsTrackingApi(),
      autoStart: false,
    );
    final controller = CheckpointArrivalController(
      tripId: tripId,
      gps: gps,
      api: mockApi,
      store: _MockStore(),
      contextProvider: _MockContextProvider(sampleContext),
      isOnline: () async => false,
      alert: () async {},
      autoStart: false,
    );
    await tester.runAsync(() async {
      await controller.start();
    });

    await pumpPanel(tester, controller: controller);

    await tester.tap(find.byKey(const Key('checkpoint-arrivals-manual-sync')));
    await tester.pump();

    expect(controller.status, isNotNull);
  });
}
