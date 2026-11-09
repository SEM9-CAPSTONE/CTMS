import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/offline_map/data/offline_map_package_reader.dart';
import 'package:mobile/features/offline_packages/data/package_download_store.dart';
import 'package:mobile/features/offline_packages/data/package_integrity_service.dart';
import 'package:mobile/features/offline_packages/domain/offline_package.dart';

const kTestTripId = '11111111-2222-3333-4444-555555555555';
const kOtherTripId = '99999999-8888-7777-6666-555555555555';
const kTestPackageId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

/// Tạo ZIP nhị phân lưu trữ (Schema 1) chuẩn cho test offline map.
Uint8List buildTestPackageZip({
  required String tripId,
  int version = 1,
  String? routeGeoJson,
  String? checkpointsJson,
  List<int>? rawRouteBytes,
  List<int>? rawCheckpointsBytes,
}) {
  final defaultRoute = jsonEncode({
    'type': 'Feature',
    'properties': {
      'routeId': 'route-trekking-01',
      'fingerprint': 'fp-12345',
    },
    'geometry': {
      'type': 'LineString',
      'coordinates': [
        [108.1500, 16.2100, 150.0],
        [108.1550, 16.2150, 200.0],
        [108.1600, 16.2200, 250.0],
      ],
    },
  });

  final defaultCheckpoints = jsonEncode([
    {
      'id': 'cp-01',
      'routeId': 'route-trekking-01',
      'name': 'Trạm Xuất Phát',
      'type': 'START',
      'location': {
        'type': 'Point',
        'coordinates': [108.1500, 16.2100],
      },
      'radiusMeters': 20.0,
      'instructions': 'Chuẩn bị xuất phát',
      'routePosition': 0,
      'expectedArrivalOffset': 0,
    },
    {
      'id': 'cp-02',
      'routeId': 'route-trekking-01',
      'name': 'Trạm Dừng Chân',
      'type': 'CAMPSITE',
      'location': {
        'type': 'Point',
        'coordinates': [108.1600, 16.2200],
      },
      'radiusMeters': 30.0,
      'instructions': 'Nghỉ ngơi và bổ sung nước',
      'routePosition': 1,
      'expectedArrivalOffset': 3600,
    },
  ]);

  final files = <String, List<int>>{
    'route.geojson': rawRouteBytes ?? utf8.encode(routeGeoJson ?? defaultRoute),
    'checkpoints.json': rawCheckpointsBytes ?? utf8.encode(checkpointsJson ?? defaultCheckpoints),
    'waypoints.json': utf8.encode('[]'),
    'hazards.geojson': utf8.encode('{"type":"FeatureCollection","features":[]}'),
    'guidance.json': utf8.encode('[]'),
  };

  final manifest = {
    'schemaVersion': 1,
    'tripId': tripId,
    'packageVersion': version,
    'files': [
      for (final entry in files.entries)
        {
          'path': entry.key,
          'sha256': sha256.convert(entry.value).toString(),
          'sizeBytes': entry.value.length,
        },
    ],
  };

  final entries = [
    (name: 'manifest.json', bytes: utf8.encode(jsonEncode(manifest))),
    for (final entry in files.entries) (name: entry.key, bytes: entry.value),
  ];

  final local = BytesBuilder();
  final directory = BytesBuilder();

  for (final entry in entries) {
    final name = ascii.encode(entry.name);
    final payload = Uint8List.fromList(entry.bytes);
    final compressed = Uint8List.fromList(gzip.encode(payload));
    final crc = ByteData.sublistView(compressed).getUint32(compressed.length - 8, Endian.little);
    final size = payload.length;

    final header = ByteData(30)
      ..setUint32(0, 0x04034b50, Endian.little)
      ..setUint16(4, 20, Endian.little)
      ..setUint16(6, 0, Endian.little)
      ..setUint16(8, 0, Endian.little)
      ..setUint32(14, crc, Endian.little)
      ..setUint32(18, size, Endian.little)
      ..setUint32(22, size, Endian.little)
      ..setUint16(26, name.length, Endian.little);

    final central = ByteData(46)
      ..setUint32(0, 0x02014b50, Endian.little)
      ..setUint16(4, 20, Endian.little)
      ..setUint32(42, local.length, Endian.little);

    central.buffer.asUint8List().setRange(6, 32, header.buffer.asUint8List(), 4);
    directory.add(central.buffer.asUint8List());
    directory.add(name);

    local.add(header.buffer.asUint8List());
    local.add(name);
    local.add(payload);
  }

  final end = ByteData(22)
    ..setUint32(0, 0x06054b50, Endian.little)
    ..setUint16(8, entries.length, Endian.little)
    ..setUint16(10, entries.length, Endian.little)
    ..setUint32(12, directory.length, Endian.little)
    ..setUint32(16, local.length, Endian.little);

  return (local
        ..add(directory.takeBytes())
        ..add(end.buffer.asUint8List()))
      .takeBytes();
}

class SpyPackageIntegrityService extends PackageIntegrityService {
  SpyPackageIntegrityService(super.store);
  int openActivePackageCalls = 0;

  @override
  Future<({OfflinePackage package, Uint8List bytes})?> openActivePackage(
    String tripId, {
    CancelToken? cancel,
  }) {
    openActivePackageCalls++;
    return super.openActivePackage(tripId, cancel: cancel);
  }
}

void main() {
  late Directory tempDir;
  late PackageDownloadStore store;
  late PackageIntegrityService integrity;
  late DefaultOfflineMapPackageReader reader;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('offline_map_reader_test_');
    store = PackageDownloadStore(tempDir);
    integrity = PackageIntegrityService(store);
    reader = DefaultOfflineMapPackageReader(store: store, integrity: integrity);
  });

  tearDown(() async {
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  Future<OfflinePackage> setupActivePackage({
    String tripId = kTestTripId,
    int version = 1,
    String? routeGeoJson,
    String? checkpointsJson,
    List<int>? rawRouteBytes,
    List<int>? rawCheckpointsBytes,
  }) async {
    final zipBytes = buildTestPackageZip(
      tripId: tripId,
      version: version,
      routeGeoJson: routeGeoJson,
      checkpointsJson: checkpointsJson,
      rawRouteBytes: rawRouteBytes,
      rawCheckpointsBytes: rawCheckpointsBytes,
    );

    final package = OfflinePackage(
      id: kTestPackageId,
      tripId: tripId,
      packageVersion: version,
      sha256: sha256.convert(zipBytes).toString(),
      sizeBytes: zipBytes.length,
      generatedAt: DateTime.utc(2026, 11, 9),
      activationAllowed: true,
    );

    final archiveFile = store.archive(package);
    await archiveFile.parent.create(recursive: true);
    await archiveFile.writeAsBytes(zipBytes, flush: true);

    await store.save(LocalPackageDownload(package, PackageDownloadStatus.downloaded, zipBytes.length));
    await store.saveVerification(package, PackageVerificationStatus.verified, () {});
    await store.saveActive(package, () {});

    return package;
  }

  group('OfflineMapPackageReader - Access Denial & Pre-checks', () {
    test('kiểm tra cờ .access-denied TRƯỚC TIÊN và không hề mở file ZIP', () async {
      final package = await setupActivePackage();
      await store.setAccessDenied(kTestTripId, true);

      // Cố tình làm hỏng file ZIP để kiểm chứng file hoàn toàn không bị đụng tới
      await store.archive(package).writeAsBytes([0x00, 0x01, 0x02]);

      expect(
        () => reader.readActivePackage(kTestTripId),
        throwsA(isA<OfflineMapAccessDeniedException>()),
      );
    });

    test('trả về null khi chuyến đi chưa có active package nào', () async {
      final result = await reader.readActivePackage('22222222-3333-4444-5555-666666666666');
      expect(result, isNull);
    });

    test('ném ngoại lệ khi active package có tripId không khớp với chuyến đi', () async {
      final package = await setupActivePackage(tripId: kTestTripId);
      // Giả mạo active file của kOtherTripId trỏ tới package của kTestTripId
      final otherActiveFile = File('${tempDir.path}/$kOtherTripId.active');
      await otherActiveFile.writeAsString(jsonEncode({'package': package.toJson()}));

      // Khi đọc kOtherTripId: store.active trả về package có tripId khác
      final result = await reader.readActivePackage(kOtherTripId);
      expect(result, isNull);
    });
  });

  group('OfflineMapPackageReader - Integrity & Size Limits', () {
    test('ném OfflineMapPackageInvalidException khi hash SHA-256 bị sai lệch', () async {
      final package = await setupActivePackage();
      // Làm hỏng 1 byte nội dung file zip
      final file = store.archive(package);
      final bytes = await file.readAsBytes();
      bytes[10] ^= 0xFF;
      await file.writeAsBytes(bytes);

      expect(
        () => reader.readActivePackage(kTestTripId),
        throwsA(isA<OfflineMapPackageInvalidException>()),
      );
    });

    test('giới hạn kích thước payload: ném lỗi khi route.geojson sau giải nén vượt quá 5MB', () async {
      // 5MB + 1024 bytes
      final oversizedBytes = List<int>.filled(5 * 1024 * 1024 + 1024, 0x20);
      await setupActivePackage(rawRouteBytes: oversizedBytes);

      expect(
        () => reader.readActivePackage(kTestTripId),
        throwsA(predicate((e) =>
            e is OfflineMapPackageInvalidException &&
            e.message.contains('vượt quá giới hạn an toàn 5MB'))),
      );
    });

    test('giới hạn kích thước payload: ném lỗi khi checkpoints.json sau giải nén vượt quá 5MB', () async {
      final oversizedBytes = List<int>.filled(5 * 1024 * 1024 + 512, 0x20);
      await setupActivePackage(rawCheckpointsBytes: oversizedBytes);

      expect(
        () => reader.readActivePackage(kTestTripId),
        throwsA(predicate((e) =>
            e is OfflineMapPackageInvalidException &&
            e.message.contains('checkpoints.json vượt quá giới hạn an toàn 5MB'))),
      );
    });
  });

  group('OfflineMapPackageReader - Coordinate Validation & Parsing', () {
    test('từ chối tọa độ latitude ngoài khoảng [-90, 90]', () async {
      final badRoute = jsonEncode({
        'type': 'Feature',
        'properties': {'routeId': 'r1'},
        'geometry': {
          'type': 'LineString',
          'coordinates': [
            [108.15, 91.0], // lat = 91.0 > 90
            [108.16, 16.0],
          ],
        },
      });
      await setupActivePackage(routeGeoJson: badRoute);

      expect(
        () => reader.readActivePackage(kTestTripId),
        throwsA(isA<OfflineMapPackageInvalidException>()),
      );
    });

    test('từ chối tọa độ longitude ngoài khoảng [-180, 180]', () async {
      final badRoute = jsonEncode({
        'type': 'Feature',
        'properties': {'routeId': 'r1'},
        'geometry': {
          'type': 'LineString',
          'coordinates': [
            [181.0, 16.0], // lon = 181.0 > 180
            [108.16, 16.0],
          ],
        },
      });
      await setupActivePackage(routeGeoJson: badRoute);

      expect(
        () => reader.readActivePackage(kTestTripId),
        throwsA(isA<OfflineMapPackageInvalidException>()),
      );
    });

    test('từ chối LineString có ít hơn 2 điểm tọa độ', () async {
      final badRoute = jsonEncode({
        'type': 'Feature',
        'properties': {'routeId': 'r1'},
        'geometry': {
          'type': 'LineString',
          'coordinates': [
            [108.15, 16.0], // Chỉ có 1 điểm
          ],
        },
      });
      await setupActivePackage(routeGeoJson: badRoute);

      expect(
        () => reader.readActivePackage(kTestTripId),
        throwsA(isA<OfflineMapPackageInvalidException>()),
      );
    });

    test('từ chối checkpoint có tọa độ không hợp lệ', () async {
      final badCheckpoints = jsonEncode([
        {
          'id': 'cp-bad',
          'routeId': 'r1',
          'name': 'Trạm Hỏng',
          'type': 'START',
          'location': {
            'type': 'Point',
            'coordinates': [108.15, 100.0], // lat = 100
          },
          'radiusMeters': 20.0,
        }
      ]);
      await setupActivePackage(checkpointsJson: badCheckpoints);

      expect(
        () => reader.readActivePackage(kTestTripId),
        throwsA(isA<OfflineMapPackageInvalidException>()),
      );
    });

    test('đọc và chuyển đổi chính xác GeoJSON [lon, lat, alt] thành OfflineRouteGeometry và Checkpoints', () async {
      await setupActivePackage();

      final context = await reader.readActivePackage(kTestTripId);
      expect(context, isNotNull);
      expect(context!.tripId, equals(kTestTripId));
      expect(context.packageVersion, equals(1));
      expect(context.route.routeId, equals('route-trekking-01'));
      expect(context.route.points.length, equals(3));

      // Điểm 1: [108.1500, 16.2100, 150.0] -> lon: 108.15, lat: 16.21, alt: 150.0
      final p1 = context.route.points[0];
      expect(p1.longitude, closeTo(108.1500, 0.0001));
      expect(p1.latitude, closeTo(16.2100, 0.0001));
      expect(p1.altitudeMeters, closeTo(150.0, 0.1));

      // Bounding box và center
      expect(context.route.minLatitude, closeTo(16.2100, 0.0001));
      expect(context.route.maxLatitude, closeTo(16.2200, 0.0001));

      // Checkpoints
      expect(context.checkpoints.length, equals(2));
      final cp1 = context.checkpoints[0];
      expect(cp1.id, equals('cp-01'));
      expect(cp1.name, equals('Trạm Xuất Phát'));
      expect(cp1.longitude, closeTo(108.1500, 0.0001));
      expect(cp1.latitude, closeTo(16.2100, 0.0001));
      expect(cp1.radiusMeters, equals(20.0));
    });

    test('khi có 2 phiên bản (v1 và v2), reader luôn luôn chỉ đọc phiên bản active', () async {
      // Setup v1
      await setupActivePackage(version: 1);

      // Setup v2 active
      final v2GeoJson = jsonEncode({
        'type': 'Feature',
        'properties': {'routeId': 'route-v2'},
        'geometry': {
          'type': 'LineString',
          'coordinates': [
            [108.20, 16.30],
            [108.21, 16.31],
          ],
        },
      });
      await setupActivePackage(version: 2, routeGeoJson: v2GeoJson);

      final context = await reader.readActivePackage(kTestTripId);
      expect(context, isNotNull);
      expect(context!.packageVersion, equals(2));
      expect(context.route.routeId, equals('route-v2'));
    });
  });
}
