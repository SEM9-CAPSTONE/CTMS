import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/offline_packages/data/package_integrity_verifier.dart';
import 'package:mobile/features/offline_packages/domain/offline_package.dart';

import 'package_integrity_fixture.dart';

void main() {
  const verifier = PackageIntegrityVerifier();
  late Directory root;
  late File file;
  setUp(() async {
    root = await Directory.systemTemp.createTemp('ctms223-verifier-');
    file = File('${root.path}/package.zip');
  });
  tearDown(() => root.delete(recursive: true));

  test(
    'accepts the six-entry schema and returns the checked snapshot',
    () async {
      final bytes = packageZip();
      await file.writeAsBytes(bytes);
      final checked = await verifier.verify(
        zipMetadata(bytes),
        file.path,
        includeBytes: true,
      );
      expect(checked, bytes);
      expect(() => checked![0] = 0, throwsUnsupportedError);
    },
  );

  test('rejects same-size tampering and a truncated download', () async {
    final bytes = packageZip();
    final package = zipMetadata(bytes);
    bytes[40] ^= 1;
    await file.writeAsBytes(bytes);
    await expectLater(
      verifier.verify(package, file.path),
      throwsFormatException,
    );
    await file.writeAsBytes(bytes.sublist(0, bytes.length - 1));
    await expectLater(
      verifier.verify(package, file.path),
      throwsFormatException,
    );
  });

  final violations = <String, Uint8List Function()>{
    'invalid ZIP': () => Uint8List.fromList([1, 2, 3]),
    'missing entry': () => packageZip(removePath: 'guidance.json'),
    'extra entry': () => packageZip(extraPath: 'extra.txt'),
    'duplicate ZIP entry': () =>
        packageZip(replacePath: 'guidance.json', newPath: 'waypoints.json'),
    'path traversal': () =>
        packageZip(replacePath: 'guidance.json', newPath: '../guidance.json'),
    'absolute path': () =>
        packageZip(replacePath: 'guidance.json', newPath: '/guidance.json'),
    'encrypted entry': () => packageZip(flags: 1),
    'unsupported compression': () => packageZip(method: 8),
    'oversized expanded entry': () =>
        packageZip(declaredSize: OfflinePackage.maxBytes + 1),
    'unknown schema': () => packageZip(schema: 2),
    'wrong Trip': () => packageZip(tripId: otherTripId),
    'wrong version': () => packageZip(version: 2),
    'invalid manifest JSON': () => packageZip(invalidManifest: true),
    'duplicate manifest path': () => packageZip(duplicateManifestPath: true),
    'wrong payload digest': () => packageZip(badPayloadHash: true),
    'wrong payload size': () => packageZip(badPayloadSize: true),
  };
  for (final MapEntry(key: name, value: makeBytes) in violations.entries) {
    test('rejects $name even if the archive SHA-256 matches', () async {
      final bytes = makeBytes();
      await file.writeAsBytes(bytes);
      await expectLater(
        verifier.verify(zipMetadata(bytes), file.path),
        throwsFormatException,
      );
    });
  }

  test(
    'rejects CRC and local header corruption independently of the SHA-256',
    () async {
      final bytes = packageZip();
      bytes[30 + 'manifest.json'.length] ^= 1;
      await file.writeAsBytes(bytes);
      await expectLater(
        verifier.verify(zipMetadata(bytes), file.path),
        throwsFormatException,
      );
      final mismatch = packageZip()..[30] = 0x78;
      await file.writeAsBytes(mismatch);
      await expectLater(
        verifier.verify(zipMetadata(mismatch), file.path),
        throwsFormatException,
      );
    },
  );
}
