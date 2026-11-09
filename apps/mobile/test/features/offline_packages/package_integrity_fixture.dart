import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:mobile/features/offline_packages/domain/offline_package.dart';

const testTripId = 'a1736fee-62be-4991-9478-a62288e9b80a';
const otherTripId = 'a1736fee-62be-4991-9478-a62288e9b80c';
const _id = 'a1736fee-62be-4991-9478-a62288e9b80b';

OfflinePackage zipMetadata(
  List<int> bytes, {
  int version = 1,
  String tripId = testTripId,
  String id = _id,
  bool? activationAllowed = true,
}) => OfflinePackage(
  id: id,
  tripId: tripId,
  packageVersion: version,
  sha256: sha256.convert(bytes).toString(),
  sizeBytes: bytes.length,
  generatedAt: DateTime.utc(2026, 11, 9),
  activationAllowed: activationAllowed,
);

Uint8List packageZip({
  int version = 1,
  int schema = 1,
  String tripId = testTripId,
  String? removePath,
  String? extraPath,
  String? replacePath,
  String? newPath,
  bool invalidManifest = false,
  bool badPayloadHash = false,
  bool badPayloadSize = false,
  bool duplicateManifestPath = false,
  int method = 0,
  int flags = 0,
  int? declaredSize,
}) {
  final files = {
    'route.geojson': '{"type":"Feature"}',
    'checkpoints.json': '[]',
    'waypoints.json': '[]',
    'hazards.geojson': '{"type":"FeatureCollection","features":[]}',
    'guidance.json': '[]',
  };
  final manifest = {
    'schemaVersion': schema,
    'tripId': tripId,
    'packageVersion': version,
    'files': [
      for (final (index, file) in files.entries.indexed)
        {
          'path': duplicateManifestPath && index == 1
              ? files.keys.first
              : file.key,
          'sha256': sha256
              .convert(
                utf8.encode(badPayloadHash && index == 0 ? 'bad' : file.value),
              )
              .toString(),
          'sizeBytes':
              file.value.length + (badPayloadSize && index == 0 ? 1 : 0),
        },
    ],
  };
  final entries = [
    (
      name: 'manifest.json',
      content: invalidManifest ? '{' : jsonEncode(manifest),
    ),
    for (final file in files.entries)
      if (file.key != removePath)
        (
          name: file.key == replacePath ? newPath! : file.key,
          content: file.value,
        ),
    if (extraPath != null) (name: extraPath, content: '[]'),
  ];
  final local = BytesBuilder();
  final directory = BytesBuilder();
  for (final (index, entry) in entries.indexed) {
    final name = ascii.encode(entry.name);
    final payload = utf8.encode(entry.content);
    final compressed = Uint8List.fromList(gzip.encode(payload));
    final crc = ByteData.sublistView(
      compressed,
    ).getUint32(compressed.length - 8, Endian.little);
    final size = index == 0 ? declaredSize ?? payload.length : payload.length;
    final header = ByteData(30)
      ..setUint32(0, 0x04034b50, Endian.little)
      ..setUint16(4, 20, Endian.little)
      ..setUint16(6, flags, Endian.little)
      ..setUint16(8, method, Endian.little)
      ..setUint32(14, crc, Endian.little)
      ..setUint32(18, size, Endian.little)
      ..setUint32(22, size, Endian.little)
      ..setUint16(26, name.length, Endian.little);
    final central = ByteData(46)
      ..setUint32(0, 0x02014b50, Endian.little)
      ..setUint16(4, 20, Endian.little)
      ..setUint32(42, local.length, Endian.little);
    central.buffer.asUint8List().setRange(
      6,
      32,
      header.buffer.asUint8List(),
      4,
    );
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
