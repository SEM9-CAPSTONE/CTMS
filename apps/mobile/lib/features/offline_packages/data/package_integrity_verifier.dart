import 'dart:convert';
import 'dart:io';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:crypto/crypto.dart' as crypto;

import '../domain/offline_package.dart';

class PackageIntegrityVerifier {
  const PackageIntegrityVerifier();

  Future<Uint8List?> verify(
    OfflinePackage package,
    String path, {
    bool includeBytes = false,
  }) => Isolate.run(() {
    if (package.sizeBytes <= 0 || package.sizeBytes > OfflinePackage.maxBytes) {
      throw const FormatException('Invalid package size');
    }
    final file = File(path).openSync();
    final Uint8List bytes;
    try {
      // Read a bounded snapshot, including one extra byte to detect growth.
      bytes = file.readSync(package.sizeBytes + 1);
    } finally {
      file.closeSync();
    }
    if (bytes.length != package.sizeBytes ||
        crypto.sha256.convert(bytes).toString() != package.sha256) {
      throw const FormatException('Package size or SHA-256 mismatch');
    }
    final files = _StoredPackageZip(bytes).read();
    final manifest = jsonDecode(utf8.decode(files.remove('manifest.json')!));
    if (manifest is! Map<String, dynamic> ||
        manifest['schemaVersion'] is! int ||
        manifest['schemaVersion'] != 1 ||
        manifest['tripId'] != package.tripId ||
        manifest['packageVersion'] is! int ||
        manifest['packageVersion'] != package.packageVersion) {
      throw const FormatException('Package manifest identity mismatch');
    }
    final entries = manifest['files'];
    if (entries is! List || entries.length != files.length) {
      throw const FormatException('Invalid package manifest file list');
    }
    for (final entry in entries) {
      final contents = entry is Map ? files.remove(entry['path']) : null;
      if (contents == null ||
          entry['sizeBytes'] is! int ||
          entry['sizeBytes'] != contents.length ||
          entry['sha256'] != crypto.sha256.convert(contents).toString()) {
        throw const FormatException('Package payload does not match manifest');
      }
    }
    return includeBytes ? bytes.asUnmodifiableView() : null;
  });
}

/// Schema 1 from CTMS-052 is an ordinary single-disk ZIP with stored entries
/// (fflate level 0). Restrict the reader to that format: no decompression,
/// ZIP64, descriptors, extra fields, encryption or extraction to disk.
class _StoredPackageZip {
  _StoredPackageZip(this.bytes) : fields = ByteData.sublistView(bytes);

  final Uint8List bytes;
  final ByteData fields;
  static const _paths = {
    'manifest.json',
    'route.geojson',
    'checkpoints.json',
    'waypoints.json',
    'hazards.geojson',
    'guidance.json',
  };
  static const _invalid = FormatException('Invalid schema 1 package ZIP');
  static const _utf8Flag = 0x800;

  int _short(int offset) => fields.getUint16(offset, Endian.little);
  int _int(int offset) => fields.getUint32(offset, Endian.little);

  Map<String, Uint8List> read() {
    final end = bytes.length - 22;
    if (end < 0 ||
        _int(end) != 0x06054b50 ||
        _int(end + 4) != 0 ||
        _short(end + 8) != _paths.length ||
        _short(end + 10) != _paths.length ||
        _short(end + 20) != 0) {
      throw _invalid;
    }
    final directory = _int(end + 16);
    if (directory + _int(end + 12) != end) throw _invalid;

    final files = <String, Uint8List>{};
    final localSpans = <int, int>{};
    var central = directory;
    for (var i = 0; i < _paths.length; i++) {
      if (central + 46 > end || _int(central) != 0x02014b50) throw _invalid;
      final flags = _short(central + 8);
      final crc = _int(central + 16);
      final size = _int(central + 24);
      final nameSize = _short(central + 28);
      final local = _int(central + 42);
      final centralEnd = central + 46 + nameSize;
      if (centralEnd > end ||
          (flags & ~_utf8Flag) != 0 ||
          _short(central + 10) != 0 ||
          _int(central + 20) != size ||
          _int(central + 30) != 0 || // extra and comment length
          _short(central + 34) != 0 ||
          _int(central + 38) != 0 || // no special file attributes
          local + 30 > directory) {
        throw _invalid;
      }
      final name = ascii.decode(
        Uint8List.sublistView(bytes, central + 46, centralEnd),
      );
      if (!_paths.contains(name) || files.containsKey(name)) throw _invalid;
      final data = local + 30 + nameSize;
      final dataEnd = data + size;
      if (dataEnd > directory ||
          _int(local) != 0x04034b50 ||
          _short(local + 6) != flags ||
          _short(local + 8) != 0 ||
          _int(local + 14) != crc ||
          _int(local + 18) != size ||
          _int(local + 22) != size ||
          _short(local + 26) != nameSize ||
          _short(local + 28) != 0 ||
          ascii.decode(Uint8List.sublistView(bytes, local + 30, data)) !=
              name ||
          localSpans.containsKey(local)) {
        throw _invalid;
      }
      final payload = Uint8List.sublistView(bytes, data, dataEnd);
      if (_crc32(payload) != crc) throw _invalid;
      files[name] = payload;
      localSpans[local] = dataEnd;
      central = centralEnd;
    }
    // Cover the entire local area once, including archives whose central
    // directory lists entries in a different order from their local headers.
    var next = 0;
    for (final start in localSpans.keys.toList()..sort()) {
      if (start != next) throw _invalid;
      next = localSpans[start]!;
    }
    if (next != directory || central != end) throw _invalid;
    return files;
  }

  static final _crcTable = List<int>.generate(256, (value) {
    for (var bit = 0; bit < 8; bit++) {
      value = (value >>> 1) ^ ((value & 1) == 0 ? 0 : 0xedb88320);
    }
    return value;
  });

  static int _crc32(Uint8List bytes) {
    var crc = 0xffffffff;
    for (final byte in bytes) {
      crc = (crc >>> 8) ^ _crcTable[(crc ^ byte) & 0xff];
    }
    return crc ^ 0xffffffff;
  }
}
