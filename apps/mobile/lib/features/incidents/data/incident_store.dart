import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import '../domain/trip_incident.dart';

abstract interface class IncidentStore {
  Future<List<LocalIncident>> read();
  Future<void> put(LocalIncident record);
  Future<List<IncidentTrip>> readTrips();
  Future<void> saveTrips(List<IncidentTrip> trips);
}

/// Files are inside private application support storage, isolated by account.
/// A flushed temporary file is renamed before the UI claims a successful save.
class FileIncidentStore implements IncidentStore {
  FileIncidentStore(this.userId, {this.root});
  final String userId;
  final Directory? root;
  Future<void> _writes = Future.value();

  Future<Directory> _directory() async {
    final base = root ?? await getApplicationSupportDirectory();
    final account = base64Url.encode(utf8.encode(userId));
    return Directory(
      '${base.path}/trip-incidents/$account',
    ).create(recursive: true);
  }

  Future<void> _write(String name, Object data) {
    final operation = _writes.then((_) async {
      final directory = await _directory();
      final file = File('${directory.path}/$name.json');
      final temporary = File('${file.path}.tmp');
      await temporary.writeAsString(jsonEncode(data), flush: true);
      await temporary.rename(file.path);
    });
    _writes = operation.catchError((Object _) {});
    return operation;
  }

  @override
  Future<List<LocalIncident>> read() async {
    await _writes;
    final directory = await _directory();
    final records = <LocalIncident>[];
    await for (final file in directory.list()) {
      if (file is File &&
          file.path.endsWith('.json') &&
          !file.path.endsWith('/trips.json')) {
        if (file.uri.pathSegments.last == 'trips.json') continue;
        final json =
            jsonDecode(await file.readAsString()) as Map<String, Object?>;
        records.add(LocalIncident.fromJson(json));
      }
    }
    return records;
  }

  @override
  Future<void> put(LocalIncident record) {
    if (!RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(record.id)) {
      throw ArgumentError('Invalid incident identity');
    }
    return _write(record.id, record.toJson());
  }

  @override
  Future<List<IncidentTrip>> readTrips() async {
    final directory = await _directory();
    final file = File('${directory.path}/trips.json');
    if (!await file.exists()) return [];
    return (jsonDecode(await file.readAsString()) as List)
        .map((v) => IncidentTrip.fromJson(Map<String, Object?>.from(v as Map)))
        .toList();
  }

  @override
  Future<void> saveTrips(List<IncidentTrip> trips) =>
      _write('trips', trips.map((v) => v.toJson()).toList());
}
