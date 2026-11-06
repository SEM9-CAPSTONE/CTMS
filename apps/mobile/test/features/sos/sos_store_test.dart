import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/sos/data/sos_store.dart';
import 'package:mobile/features/sos/domain/sos_alert.dart';

void main() {
  late Directory tempDir;
  const userId = '11111111-2222-3333-4444-555555555555';
  const otherUserId = '99999999-8888-7777-6666-555555555555';
  const tripId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('sos_store_test_');
  });

  tearDown(() async {
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  test('FileSosStore persists and retrieves pending SOS alert', () async {
    final store = FileSosStore(userId, root: tempDir);
    final alertId = newSosId();
    final alert = LocalSosAlert(
      id: alertId,
      tripId: tripId,
      senderId: userId,
      emergencyType: 'medical',
      eventTime: DateTime.parse('2026-10-27T08:00:00.000Z'),
      location: const SosLocation(latitude: 11.5432, longitude: 108.4521),
      batteryLevel: 85,
      notes: 'Khó thở, nghi dị ứng',
      syncState: SosSyncState.pending,
    );

    await store.put(alert);

    final retrieved = await store.read(tripId);
    expect(retrieved, hasLength(1));
    expect(retrieved.first.id, alertId);
    expect(retrieved.first.tripId, tripId);
    expect(retrieved.first.emergencyType, 'medical');
    expect(retrieved.first.location?.latitude, 11.5432);
    expect(retrieved.first.batteryLevel, 85);
    expect(retrieved.first.syncState, SosSyncState.pending);
    expect(retrieved.first.isPending, isTrue);
  });

  test('FileSosStore preserves data across new store instances (PB AC-2: survives app restart)', () async {
    final alertId = newSosId();
    final alert = LocalSosAlert(
      id: alertId,
      tripId: tripId,
      senderId: userId,
      emergencyType: 'injury',
      eventTime: DateTime.parse('2026-10-27T09:00:00.000Z'),
      notes: 'Trật khớp gối',
    );

    // Initial session
    final store1 = FileSosStore(userId, root: tempDir);
    await store1.put(alert);

    // Simulated app restart with new store instance
    final store2 = FileSosStore(userId, root: tempDir);
    final all = await store2.readAll();

    expect(all, hasLength(1));
    expect(all.first.id, alertId);
    expect(all.first.notes, 'Trật khớp gối');
  });

  test('FileSosStore isolates data between different accounts', () async {
    final storeUser1 = FileSosStore(userId, root: tempDir);
    final storeUser2 = FileSosStore(otherUserId, root: tempDir);

    final alert1 = LocalSosAlert(
      id: newSosId(),
      tripId: tripId,
      senderId: userId,
      emergencyType: 'lost',
      eventTime: DateTime.now(),
    );

    await storeUser1.put(alert1);

    expect(await storeUser1.readAll(), hasLength(1));
    expect(await storeUser2.readAll(), isEmpty);
  });

  test('FileSosStore deletes alert when resolved/removed', () async {
    final store = FileSosStore(userId, root: tempDir);
    final alertId = newSosId();
    final alert = LocalSosAlert(
      id: alertId,
      tripId: tripId,
      senderId: userId,
      emergencyType: 'other',
      eventTime: DateTime.now(),
    );

    await store.put(alert);
    expect(await store.readAll(), hasLength(1));

    await store.delete(tripId, alertId);
    expect(await store.readAll(), isEmpty);
  });
}
