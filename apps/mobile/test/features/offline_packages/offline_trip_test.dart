import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/features/offline_packages/application/offline_trip_providers.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';
import 'package:mobile/features/offline_packages/data/offline_trip_repository.dart';
import 'package:mobile/features/offline_packages/data/package_download_store.dart';
import 'package:mobile/features/offline_packages/data/package_integrity_service.dart';
import 'package:mobile/features/offline_packages/domain/offline_package.dart';
import 'package:mobile/features/offline_packages/domain/offline_trip.dart';
import 'package:mobile/features/offline_packages/presentation/offline_route_diagram.dart';
import 'package:mobile/features/offline_packages/presentation/saved_offline_packages_screen.dart';

import 'package_integrity_fixture.dart';

final _account = StateProvider((ref) => 'camper-1');
const _guideText =
    'Dừng lại, kiểm tra môi trường xung quanh và báo cho trưởng đoàn.';
const _versionId = 'source-version-3';
const _checkpoint = 'Trạm kiểm lâm';

Uint8List _tripZip({String tripId = testTripId, bool malformed = false}) =>
    packageZip(
      tripId: tripId,
      manifestFields: const {
        'route': {'routeId': 'route-1', 'fingerprint': 'route-fingerprint'},
        'hazardSourceSummary': [
          {
            'sourceId': 'source-a',
            'checkedAt': '2026-11-06T06:00:00Z',
            'validUntil': null,
            'outcome': 'UNKNOWN',
          },
        ],
      },
      payloads: {
        'route.geojson': {
          'type': 'Feature',
          'properties': {
            'routeId': 'route-1',
            'fingerprint': 'route-fingerprint',
          },
          'geometry': {
            'type': 'LineString',
            'coordinates': [
              [108.45, 11.11],
              [108.48, malformed ? 111 : 11.15],
            ],
          },
        },
        'checkpoints.json': [
          {
            'routeId': 'route-1',
            'name': _checkpoint,
            'type': 'rest',
            'location': {
              'type': 'Point',
              'coordinates': [108.46, 11.13],
            },
            'instructions': 'Nghỉ 10 phút tại đây.',
          },
        ],
        'guidance.json': [
          {
            'topic': 'Giữ an toàn khi đi rừng',
            'content': _guideText,
            'sourceTitle': 'Sổ tay an toàn',
            'documentVersionId': _versionId,
            'attribution': 'Đơn vị xuất bản',
            'sourceUrl': 'https://example.test/safety.pdf',
            'pageRefs': [
              {'page': 4, 'itemRef': '4.2'},
            ],
          },
        ],
      },
    );

void main() {
  late Directory root;
  late PackageDownloadStore store;
  late PackageIntegrityService integrity;
  late OfflineTripRepository repository;

  setUp(() async {
    root = await Directory.systemTemp.createTemp('ctms224-');
    store = PackageDownloadStore(root);
    integrity = PackageIntegrityService(store);
    repository = OfflineTripRepository(integrity);
  });
  tearDown(() => root.delete(recursive: true));

  Future<OfflinePackage> activate(Uint8List bytes, {String? title}) async {
    final package = zipMetadata(bytes);
    await store.archive(package).writeAsBytes(bytes);
    expect(await integrity.finalize(package, CancelToken(), tripTitle: title), (
      PackageVerificationStatus.verified,
      true,
    ));
    return package;
  }

  test('opens only the selected account, Trip and active version', () async {
    final package = await activate(_tripZip());
    final trip = (await repository.read(testTripId, 1))!;
    expect(trip.route.last, (longitude: 108.48, latitude: 11.15));
    expect(trip.checkpoints.single.name, _checkpoint);
    expect(trip.guides.single.content, _guideText);
    expect(trip.guides.single.documentVersionId, _versionId);
    expect(trip.hazardSources.single.outcome, OfflineHazardOutcome.unknown);
    expect(
      (await store.activePackages()).single.package.sameArtifact(package),
      isTrue,
    );
    expect(await repository.read(testTripId, 2), isNull);
    expect(await repository.read(otherTripId, 1), isNull);

    final secondAccount = PackageDownloadStore(Directory('${root.path}/other'));
    expect(await secondAccount.activePackages(), isEmpty);
    expect(
      await OfflineTripRepository(
        PackageIntegrityService(secondAccount),
      ).read(testTripId, 1),
      isNull,
    );
    await store.setAccessDenied(testTripId, true);
    expect(await repository.read(testTripId, 1), isNull);
    expect(await store.activePackages(), isEmpty);
  });

  test(
    'rejects a verified ZIP whose view payload has an invalid coordinate',
    () async {
      final package = await activate(_tripZip(malformed: true));
      expect(await repository.read(testTripId, 1), isNull);
      expect(
        await store.verification(package),
        PackageVerificationStatus.failed,
      );
    },
  );

  test('rejects a missing archive after activation', () async {
    final package = await activate(_tripZip());
    await store.archive(package).delete();
    expect(await repository.read(testTripId, 1), isNull);
  });

  test('keeps a denied Trip closed if the denial cannot be written', () async {
    await activate(_tripZip());
    await Directory('${root.path}/$testTripId.access-denied').create();
    await expectLater(
      store.setAccessDenied(testTripId, true),
      throwsA(isA<FileSystemException>()),
    );

    final reopenedStore = PackageDownloadStore(root);
    final reopenedRepository = OfflineTripRepository(
      PackageIntegrityService(reopenedStore),
    );
    expect(await reopenedRepository.read(testTripId, 1), isNull);
    await reopenedStore.setAccessDenied(testTripId, false);
    expect(await reopenedRepository.read(testTripId, 1), isNotNull);
  });

  testWidgets(
    'opens saved content with no API and removes it on account switch',
    (tester) async {
      final container = ProviderContainer(
        overrides: [
          offlinePackageAccountProvider.overrideWith(
            (ref) => ref.watch(_account),
          ),
          packageDownloadStoreProvider.overrideWith((ref) async => store),
          apiClientProvider.overrideWith(
            (ref) => throw StateError('Offline view must not use the API'),
          ),
        ],
      );
      addTearDown(container.dispose);

      // File and isolate I/O must start in the real async zone in a widget test.
      final saved = savedOfflinePackagesProvider('camper-1');
      final content = offlineTripProvider((
        accountId: 'camper-1',
        tripId: testTripId,
        version: 1,
      ));
      await tester.runAsync(() async {
        await activate(_tripZip(), title: 'Đường rừng Đà Lạt');
        container.listen(saved, (_, _) {});
        container.listen(content, (_, _) {});
        await container.read(saved.future);
        await container.read(content.future);
      });

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: Scaffold(body: SavedOfflinePackagesButton()),
          ),
        ),
      );

      await tester.tap(find.byTooltip('Dữ liệu ngoại tuyến đã lưu'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Đường rừng Đà Lạt'));
      await tester.pumpAndSettle();
      expect(find.byType(OfflineRouteDiagram), findsOneWidget);
      expect(
        tester.getSize(find.byType(OfflineRouteDiagram)).width,
        greaterThan(100),
      );

      await tester.tap(find.text('Điểm dừng'));
      await tester.pumpAndSettle();
      expect(find.text('1. $_checkpoint'), findsOneWidget);
      expect(find.text('Nghỉ 10 phút tại đây.'), findsOneWidget);

      await tester.tap(find.text('Hướng dẫn'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Giữ an toàn khi đi rừng'));
      await tester.pumpAndSettle();
      expect(find.text(_guideText), findsOneWidget);
      expect(find.text('Phiên bản tài liệu · $_versionId'), findsOneWidget);

      container.read(_account.notifier).state = 'camper-2';
      await tester.pumpAndSettle();
      expect(find.text(_guideText), findsNothing);
      expect(find.text('Dữ liệu ngoại tuyến không khả dụng'), findsOneWidget);
    },
  );
}
