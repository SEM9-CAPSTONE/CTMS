import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/sos/application/sos_controller.dart';
import 'package:mobile/features/sos/data/sos_api.dart';
import 'package:mobile/features/sos/data/sos_store.dart';
import 'package:mobile/features/sos/domain/sos_alert.dart';

class FailingSosApi implements SosApi {
  @override
  Future<SosAlert> create(
    String tripId, {
    String? id,
    required String emergencyType,
    String? notes,
    double? latitude,
    double? longitude,
    int? batteryLevel,
    DateTime? eventTime,
  }) async {
    throw ApiException('Thiết bị đang ngắt kết nối', statusCode: null);
  }

  @override
  Future<List<SosAlert>> list(String tripId) async {
    throw ApiException('Mất kết nối mạng', statusCode: null);
  }

  @override
  Future<SosAlert> acknowledge(String tripId, String sosId) => throw UnimplementedError();
  @override
  Future<SosAlert> cancel(String tripId, String sosId, String reason) => throw UnimplementedError();
  @override
  Future<SosAlert> close(String tripId, String sosId, String resolutionNote) => throw UnimplementedError();
}

void main() {
  const tripId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const userId = '11111111-2222-3333-4444-555555555555';

  test('SosController creates SOS offline, saves locally, and immediately activates in UI (PB AC-1, PB AC-2)', () async {
    final store = InMemorySosStore();
    final api = FailingSosApi();

    final controller = SosController(
      tripId: tripId,
      api: api,
      store: store,
      userId: userId,
    );

    // Initial state
    await Future<void>.delayed(Duration.zero);
    expect(controller.activeAlert, isNull);

    // Trigger SOS while offline
    final alert = await controller.triggerSos(
      emergencyType: 'lost',
      notes: 'Lạc trong rừng thông',
      latitude: 11.54,
      longitude: 108.45,
    );

    expect(alert, isNotNull);
    expect(alert!.emergencyType, 'lost');
    expect(alert.notes, 'Lạc trong rừng thông');
    expect(alert.isLocalPending, isTrue);
    expect(controller.activeAlert, isNotNull);
    expect(controller.activeAlert!.id, alert.id);

    // Verify persisted in store
    final stored = await store.read(tripId);
    expect(stored, hasLength(1));
    expect(stored.first.id, alert.id);
    expect(stored.first.syncState, SosSyncState.pending);
  });

  test('SosController restores pending offline alert after simulated restart (PB AC-2)', () async {
    final store = InMemorySosStore();
    final alertId = newSosId();

    // Pre-seed store with offline alert
    await store.put(LocalSosAlert(
      id: alertId,
      tripId: tripId,
      senderId: userId,
      emergencyType: 'injury',
      eventTime: DateTime.now(),
      syncState: SosSyncState.pending,
    ));

    // New controller instance (simulating app restart)
    final controller = SosController(
      tripId: tripId,
      api: FailingSosApi(),
      store: store,
      userId: userId,
    );

    await Future<void>.delayed(Duration.zero);

    expect(controller.activeAlert, isNotNull);
    expect(controller.activeAlert!.id, alertId);
    expect(controller.activeAlert!.emergencyType, 'injury');
    expect(controller.activeAlert!.isLocalPending, isTrue);
  });
}
