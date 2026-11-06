import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/sos/application/sos_sync.dart';
import 'package:mobile/features/sos/data/sos_api.dart';
import 'package:mobile/features/sos/domain/sos_alert.dart';

class MockSosApi implements SosApi {
  int createCalls = 0;
  String? lastCreatedId;
  String? lastEmergencyType;
  DateTime? lastEventTime;
  Exception? errorToThrow;

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
    createCalls++;
    lastCreatedId = id;
    lastEmergencyType = emergencyType;
    lastEventTime = eventTime;

    if (errorToThrow != null) {
      throw errorToThrow!;
    }

    return SosAlert(
      id: id ?? newSosId(),
      tripId: tripId,
      senderId: 'user-1',
      emergencyType: emergencyType,
      status: 'active',
      eventTime: eventTime ?? DateTime.now(),
      notes: notes,
    );
  }

  @override
  Future<SosAlert> acknowledge(String tripId, String sosId) => throw UnimplementedError();
  @override
  Future<SosAlert> cancel(String tripId, String sosId, String reason) => throw UnimplementedError();
  @override
  Future<SosAlert> close(String tripId, String sosId, String resolutionNote) => throw UnimplementedError();
  @override
  Future<List<SosAlert>> list(String tripId) async => [];
}

void main() {
  const tripId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  test('synchronizeSosAlert transitions pending alert to synced and preserves UUID (PB AC-6, BR-244)', () async {
    final api = MockSosApi();
    final alertId = newSosId();
    final eventTime = DateTime.parse('2026-10-27T10:00:00.000Z');
    final local = LocalSosAlert(
      id: alertId,
      tripId: tripId,
      senderId: 'user-1',
      emergencyType: 'medical',
      eventTime: eventTime,
      notes: 'Bị ong bắp cày đốt',
      syncState: SosSyncState.pending,
    );

    final updated = await synchronizeSosAlert(local, api, DateTime.now());

    expect(updated.syncState, SosSyncState.synced);
    expect(updated.isSynced, isTrue);
    expect(updated.serverAlert, isNotNull);
    expect(updated.serverAlert!.id, alertId);
    expect(api.createCalls, 1);
    expect(api.lastCreatedId, alertId);
    expect(api.lastEventTime, eventTime);
  });

  test('synchronizeSosAlert preserves pending state and increments attempts on network failure (BR-256)', () async {
    final api = MockSosApi()
      ..errorToThrow = ApiException('Không có kết nối mạng', statusCode: null);

    final alertId = newSosId();
    final local = LocalSosAlert(
      id: alertId,
      tripId: tripId,
      senderId: 'user-1',
      emergencyType: 'natural_hazard',
      eventTime: DateTime.now(),
      syncState: SosSyncState.pending,
      attempts: 0,
    );

    final updated = await synchronizeSosAlert(local, api, DateTime.now());

    expect(updated.syncState, SosSyncState.pending);
    expect(updated.isPending, isTrue);
    expect(updated.attempts, 1);
    expect(updated.error, 'Không có kết nối mạng');
  });
}
