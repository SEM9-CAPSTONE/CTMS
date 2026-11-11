import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
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

  factory GpsLogStore.create(String userId) {
    if (kIsWeb) {
      return WebGpsLogStore(userId);
    }
    return FileGpsLogStore(userId);
  }
}

/// Web-compatible GPS log store using FlutterSecureStorage with in-memory caching.
class WebGpsLogStore implements GpsLogStore {
  WebGpsLogStore(this.userId, [FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final String userId;
  final FlutterSecureStorage _storage;

  String _storageKey(String tripId) => 'ctms_gps_logs_${userId}_$tripId';
  final Map<String, List<LocalGpsLog>> _cache = {};

  Future<List<LocalGpsLog>> _ensureLoaded(String tripId) async {
    if (_cache.containsKey(tripId)) return _cache[tripId]!;
    try {
      final raw = await _storage.read(key: _storageKey(tripId));
      if (raw != null && raw.isNotEmpty) {
        final items = jsonDecode(raw) as List;
        final list = items
            .map((item) => LocalGpsLog.fromJson(Map<String, Object?>.from(item as Map)))
            .toList();
        _cache[tripId] = list;
        return list;
      }
    } catch (_) {}
    _cache[tripId] = [];
    return _cache[tripId]!;
  }

  @override
  Future<List<LocalGpsLog>> read(String tripId) async {
    if (!RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(tripId)) {
      throw ArgumentError('Invalid trip identity');
    }
    final current = await _ensureLoaded(tripId);
    return List.unmodifiable(current);
  }

  @override
  Future<List<LocalGpsLog>> update(
    String tripId,
    List<LocalGpsLog> Function(List<LocalGpsLog> current) transform,
  ) async {
    if (!RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(tripId)) {
      throw ArgumentError('Invalid trip identity');
    }
    final current = await _ensureLoaded(tripId);
    final next = transform(List<LocalGpsLog>.from(current));
    _cache[tripId] = next;
    try {
      final list = next.map((e) => e.toJson()).toList();
      await _storage.write(key: _storageKey(tripId), value: jsonEncode(list));
    } catch (_) {}
    return List.unmodifiable(next);
  }
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
    final Directory base;
    if (root != null) {
      base = root!;
    } else if (kIsWeb) {
      base = Directory.systemTemp;
    } else {
      base = await getApplicationSupportDirectory();
    }
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
