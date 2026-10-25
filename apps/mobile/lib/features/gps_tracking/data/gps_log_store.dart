import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import '../domain/gps_tracking_models.dart';

abstract interface class GpsLogStore {
  Future<List<LocalGpsLog>> read(String tripId);

  /// Atomically reads, transforms and writes one Trip's buffer, so a new log
  /// appended while an upload result is being recorded is never lost.
  Future<List<LocalGpsLog>> update(
    String tripId,
    List<LocalGpsLog> Function(List<LocalGpsLog> current) transform,
  );
}

/// One JSON file per Trip inside private application support storage, isolated by
/// account. Writes go to a flushed temporary file that is then renamed, so a crash
/// never leaves a half-written buffer.
class FileGpsLogStore implements GpsLogStore {
  FileGpsLogStore(this.userId, {this.root});
  final String userId;
  final Directory? root;
  Future<void> _writes = Future.value();

  Future<File> _file(String tripId) async {
    if (!RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(tripId)) {
      throw ArgumentError('Invalid trip identity');
    }
    final base = root ?? await getApplicationSupportDirectory();
    final account = base64Url.encode(utf8.encode(userId));
    final directory = await Directory('${base.path}/gps-logs/$account').create(recursive: true);
    return File('${directory.path}/$tripId.json');
  }

  Future<List<LocalGpsLog>> _readFile(String tripId) async {
    final file = await _file(tripId);
    if (!await file.exists()) return [];
    final items = jsonDecode(await file.readAsString()) as List;
    return items
        .map((item) => LocalGpsLog.fromJson(Map<String, Object?>.from(item as Map)))
        .toList();
  }

  @override
  Future<List<LocalGpsLog>> read(String tripId) async {
    await _writes;
    return _readFile(tripId);
  }

  @override
  Future<List<LocalGpsLog>> update(
    String tripId,
    List<LocalGpsLog> Function(List<LocalGpsLog> current) transform,
  ) {
    final operation = _writes.then((_) async {
      final next = transform(await _readFile(tripId));
      final file = await _file(tripId);
      final temporary = File('${file.path}.tmp');
      await temporary.writeAsString(
        jsonEncode(next.map((log) => log.toJson()).toList()),
        flush: true,
      );
      await temporary.rename(file.path);
      return next;
    });
    _writes = operation.then((_) {}, onError: (Object _) {});
    return operation;
  }
}
