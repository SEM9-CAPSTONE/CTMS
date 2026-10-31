import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import '../domain/route_deviation_models.dart';

abstract interface class RouteDeviationStore {
  Future<RouteDeviationRecord> read(String tripId);

  /// Atomically reads, transforms and writes one Trip's record, so a confirmed
  /// transition and its safety event are persisted together (BR-386).
  Future<RouteDeviationRecord> update(
    String tripId,
    RouteDeviationRecord Function(RouteDeviationRecord current) transform,
  );
}

/// One JSON file per Trip inside private application support storage, isolated by
/// account. Writes go to a flushed temporary file that is then renamed, so a crash
/// never leaves a half-written record.
class FileRouteDeviationStore implements RouteDeviationStore {
  FileRouteDeviationStore(this.userId, {this.root});
  final String userId;
  final Directory? root;
  Future<void> _writes = Future.value();

  Future<File> _file(String tripId) async {
    if (!RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(tripId)) {
      throw ArgumentError('Invalid trip identity');
    }
    final base = root ?? await getApplicationSupportDirectory();
    final account = base64Url.encode(utf8.encode(userId));
    final directory = await Directory(
      '${base.path}/route-deviation/$account',
    ).create(recursive: true);
    return File('${directory.path}/$tripId.json');
  }

  Future<RouteDeviationRecord> _readFile(String tripId) async {
    final file = await _file(tripId);
    if (!await file.exists()) return const RouteDeviationRecord();
    return RouteDeviationRecord.fromJson(
      Map<String, Object?>.from(jsonDecode(await file.readAsString()) as Map),
    );
  }

  @override
  Future<RouteDeviationRecord> read(String tripId) async {
    await _writes;
    return _readFile(tripId);
  }

  @override
  Future<RouteDeviationRecord> update(
    String tripId,
    RouteDeviationRecord Function(RouteDeviationRecord current) transform,
  ) {
    final operation = _writes.then((_) async {
      final next = transform(await _readFile(tripId));
      final file = await _file(tripId);
      final temporary = File('${file.path}.tmp');
      await temporary.writeAsString(jsonEncode(next.toJson()), flush: true);
      await temporary.rename(file.path);
      return next;
    });
    _writes = operation.then((_) {}, onError: (Object _) {});
    return operation;
  }
}
