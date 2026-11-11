import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
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

  factory RouteDeviationStore.create(String userId) {
    if (kIsWeb) {
      return WebRouteDeviationStore(userId);
    }
    return FileRouteDeviationStore(userId);
  }
}

/// Web-compatible Route Deviation store using FlutterSecureStorage with in-memory caching.
class WebRouteDeviationStore implements RouteDeviationStore {
  WebRouteDeviationStore(this.userId, [FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final String userId;
  final FlutterSecureStorage _storage;

  String _storageKey(String tripId) => 'ctms_route_deviation_${userId}_$tripId';
  final Map<String, RouteDeviationRecord> _cache = {};

  Future<RouteDeviationRecord> _ensureLoaded(String tripId) async {
    if (_cache.containsKey(tripId)) return _cache[tripId]!;
    try {
      final raw = await _storage.read(key: _storageKey(tripId));
      if (raw != null && raw.isNotEmpty) {
        final record = RouteDeviationRecord.fromJson(
          Map<String, Object?>.from(jsonDecode(raw) as Map),
        );
        _cache[tripId] = record;
        return record;
      }
    } catch (_) {}
    const empty = RouteDeviationRecord();
    _cache[tripId] = empty;
    return empty;
  }

  @override
  Future<RouteDeviationRecord> read(String tripId) async {
    if (!RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(tripId)) {
      throw ArgumentError('Invalid trip identity');
    }
    return _ensureLoaded(tripId);
  }

  @override
  Future<RouteDeviationRecord> update(
    String tripId,
    RouteDeviationRecord Function(RouteDeviationRecord current) transform,
  ) async {
    if (!RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(tripId)) {
      throw ArgumentError('Invalid trip identity');
    }
    final current = await _ensureLoaded(tripId);
    final next = transform(current);
    _cache[tripId] = next;
    try {
      await _storage.write(key: _storageKey(tripId), value: jsonEncode(next.toJson()));
    } catch (_) {}
    return next;
  }
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
    final Directory base;
    if (root != null) {
      base = root!;
    } else if (kIsWeb) {
      base = Directory.systemTemp;
    } else {
      base = await getApplicationSupportDirectory();
    }
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
