import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';

import '../domain/trip_incident.dart';

abstract interface class IncidentStore {
  Future<List<LocalIncident>> read();
  Future<void> put(LocalIncident record);
  Future<List<IncidentTrip>> readTrips();
  Future<void> saveTrips(List<IncidentTrip> trips);

  factory IncidentStore.create(String userId) {
    if (kIsWeb) {
      return WebIncidentStore(userId);
    }
    return FileIncidentStore(userId);
  }
}

/// Web-compatible incident store using FlutterSecureStorage with in-memory caching.
class WebIncidentStore implements IncidentStore {
  WebIncidentStore(this.userId, [FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final String userId;
  final FlutterSecureStorage _storage;

  String get _tripsKey => 'ctms_incidents_trips_$userId';
  String get _recordsKey => 'ctms_incidents_records_$userId';

  final Map<String, LocalIncident> _recordsCache = {};
  List<IncidentTrip> _tripsCache = [];
  bool _initialized = false;

  Future<void> _ensureLoaded() async {
    if (_initialized) return;
    try {
      final rawTrips = await _storage.read(key: _tripsKey);
      if (rawTrips != null && rawTrips.isNotEmpty) {
        final list = jsonDecode(rawTrips) as List;
        _tripsCache = list
            .map((v) => IncidentTrip.fromJson(Map<String, Object?>.from(v as Map)))
            .toList();
      }
    } catch (_) {}

    try {
      final rawRecords = await _storage.read(key: _recordsKey);
      if (rawRecords != null && rawRecords.isNotEmpty) {
        final list = jsonDecode(rawRecords) as List;
        for (final item in list) {
          final record = LocalIncident.fromJson(Map<String, Object?>.from(item as Map));
          _recordsCache[record.id] = record;
        }
      }
    } catch (_) {}

    _initialized = true;
  }

  @override
  Future<List<LocalIncident>> read() async {
    await _ensureLoaded();
    return _recordsCache.values.toList();
  }

  @override
  Future<void> put(LocalIncident record) async {
    if (!RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(record.id)) {
      throw ArgumentError('Invalid incident identity');
    }
    await _ensureLoaded();
    _recordsCache[record.id] = record;
    try {
      final list = _recordsCache.values.map((v) => v.toJson()).toList();
      await _storage.write(key: _recordsKey, value: jsonEncode(list));
    } catch (_) {}
  }

  @override
  Future<List<IncidentTrip>> readTrips() async {
    await _ensureLoaded();
    return List.unmodifiable(_tripsCache);
  }

  @override
  Future<void> saveTrips(List<IncidentTrip> trips) async {
    await _ensureLoaded();
    _tripsCache = List.from(trips);
    try {
      final list = trips.map((v) => v.toJson()).toList();
      await _storage.write(key: _tripsKey, value: jsonEncode(list));
    } catch (_) {}
  }
}

/// Files are inside private application support storage, isolated by account.
/// A flushed temporary file is renamed before the UI claims a successful save.
class FileIncidentStore implements IncidentStore {
  FileIncidentStore(this.userId, {this.root});
  final String userId;
  final Directory? root;
  Future<void> _writes = Future.value();

  Future<Directory> _directory() async {
    final Directory base;
    if (root != null) {
      base = root!;
    } else if (kIsWeb) {
      base = Directory.systemTemp;
    } else {
      base = await getApplicationSupportDirectory();
    }
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
