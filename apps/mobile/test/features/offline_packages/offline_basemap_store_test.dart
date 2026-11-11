import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/offline_packages/data/offline_basemap_store.dart';
import 'package:mobile/features/offline_packages/data/package_download_store.dart';
import 'package_integrity_fixture.dart';

void main() {
  late Directory root;
  final package = zipMetadata(packageZip());
  final bytes = utf8.encode('local immutable raster test');
  late Map<String, Object?> metadata;
  late OfflineBasemapStore store;
  setUp(() async {
    root = await Directory.systemTemp.createTemp('ctms-sidecar-test-');
    metadata = {
      'packageId': package.id,
      'tripId': package.tripId,
      'packageVersion': package.packageVersion,
      'sha256': sha256.convert(bytes).toString(),
      'sizeBytes': bytes.length,
      'bounds': [108.0, 16.0, 109.0, 17.0],
      'minZoom': 12,
      'maxZoom': 16,
      'attribution': '© OpenStreetMap contributors',
      'licenseUrl': 'https://www.openstreetmap.org/copyright',
    };
    store = OfflineBasemapStore(
      Directory('${root.path}/user-a'),
      ApiClient(TokenStorage(const FlutterSecureStorage())),
      PackageDownloadStore(Directory('${root.path}/core-a')),
    );
    final dir = store.directory(package);
    await dir.create(recursive: true);
    await File('${dir.path}/metadata.json').writeAsString(jsonEncode(metadata));
    await File('${dir.path}/${metadata['sha256']}.mbtiles').writeAsBytes(bytes);
  });
  tearDown(() async {
    await root.delete(recursive: true);
  });
  test('metadata rejects a different trip, core version or digest', () {
    for (final change in <Map<String, Object?>>[
      {'tripId': otherTripId},
      {'packageVersion': 99},
      {'sha256': '../outside'},
      {'sizeBytes': maxBasemapBytes + 1},
      {
        'bounds': [109, 16, 108, 17],
      },
    ]) {
      expect(
        () => BasemapMetadata.parse({...metadata, ...change}, package),
        throwsFormatException,
      );
    }
  });
  test(
    'exact account artifact restores without network and corrupted bytes fail closed',
    () async {
      final path = await store.verifiedPath(package);
      expect(path, isNotNull);
      await File(path!).writeAsBytes(List.filled(bytes.length, 0));
      expect(await store.verifiedPath(package), isNull);
    },
  );
  test('other account has no access to locally cached basemap', () async {
    final other = OfflineBasemapStore(
      Directory('${root.path}/user-b'),
      store.client,
      PackageDownloadStore(Directory('${root.path}/core-b')),
    );
    expect(await other.verifiedPath(package), isNull);
  });
  test('core denial marker purges basemap before returning a path', () async {
    await store.coreStore.setAccessDenied(package.tripId, true);
    expect(await store.verifiedPath(package), isNull);
    expect(await store.directory(package).exists(), isFalse);
  });
}
