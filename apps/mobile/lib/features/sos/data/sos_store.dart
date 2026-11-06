import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';

import '../../auth/application/auth_controller.dart';
import '../domain/sos_alert.dart';

abstract interface class SosStore {
  Future<List<LocalSosAlert>> read(String tripId);
  Future<List<LocalSosAlert>> readAll();
  Future<void> put(LocalSosAlert alert);
  Future<void> delete(String tripId, String alertId);

  factory SosStore.create(String userId) {
    if (kIsWeb) {
      return WebSosStore(userId);
    }
    return FileSosStore(userId);
  }
}

/// In-memory SOS store useful for tests or fallback.
class InMemorySosStore implements SosStore {
  final Map<String, LocalSosAlert> _alerts = {};

  @override
  Future<List<LocalSosAlert>> read(String tripId) async {
    return _alerts.values.where((a) => a.tripId == tripId).toList();
  }

  @override
  Future<List<LocalSosAlert>> readAll() async {
    return _alerts.values.toList();
  }

  @override
  Future<void> put(LocalSosAlert alert) async {
    _alerts[alert.id] = alert;
  }

  @override
  Future<void> delete(String tripId, String alertId) async {
    _alerts.remove(alertId);
  }
}

/// Web-compatible SOS store using FlutterSecureStorage with in-memory caching.
class WebSosStore implements SosStore {
  WebSosStore(this.userId, [FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final String userId;
  final FlutterSecureStorage _storage;

  String get _storageKey => 'ctms_sos_records_$userId';
  final Map<String, LocalSosAlert> _recordsCache = {};
  bool _initialized = false;

  Future<void> _ensureLoaded() async {
    if (_initialized) return;
    try {
      final rawRecords = await _storage.read(key: _storageKey);
      if (rawRecords != null && rawRecords.isNotEmpty) {
        final list = jsonDecode(rawRecords) as List;
        for (final item in list) {
          final record = LocalSosAlert.fromJson(Map<String, dynamic>.from(item as Map));
          _recordsCache[record.id] = record;
        }
      }
    } catch (_) {}
    _initialized = true;
  }

  Future<void> _persist() async {
    try {
      final list = _recordsCache.values.map((v) => v.toJson()).toList();
      await _storage.write(key: _storageKey, value: jsonEncode(list));
    } catch (_) {}
  }

  @override
  Future<List<LocalSosAlert>> read(String tripId) async {
    await _ensureLoaded();
    return _recordsCache.values.where((a) => a.tripId == tripId).toList();
  }

  @override
  Future<List<LocalSosAlert>> readAll() async {
    await _ensureLoaded();
    return _recordsCache.values.toList();
  }

  @override
  Future<void> put(LocalSosAlert alert) async {
    if (!RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(alert.id)) {
      throw ArgumentError('Invalid SOS identity');
    }
    await _ensureLoaded();
    _recordsCache[alert.id] = alert;
    await _persist();
  }

  @override
  Future<void> delete(String tripId, String alertId) async {
    await _ensureLoaded();
    if (_recordsCache.remove(alertId) != null) {
      await _persist();
    }
  }
}

/// Stores SOS alerts inside private application support storage (PB AC-2, BR-256).
/// Application Support Directory is NOT cache - it is never purged by OS low-memory sweeps.
/// Writes go to a flushed temporary file that is renamed atomically so a crash never corrupts the buffer.
class FileSosStore implements SosStore {
  FileSosStore(this.userId, {this.root});

  final String userId;
  final Directory? root;
  Future<void> _writes = Future.value();

  Future<Directory> _directory() async {
    final base = root ?? await getApplicationSupportDirectory();
    final account = base64Url.encode(utf8.encode(userId));
    return Directory('${base.path}/sos-alerts/$account').create(recursive: true);
  }

  Future<void> _write(String id, Map<String, dynamic> data) {
    final operation = _writes.then((_) async {
      final dir = await _directory();
      final file = File('${dir.path}/$id.json');
      final temp = File('${file.path}.tmp');
      await temp.writeAsString(jsonEncode(data), flush: true);
      await temp.rename(file.path);
    });
    _writes = operation.catchError((Object _) {});
    return operation;
  }

  @override
  Future<List<LocalSosAlert>> read(String tripId) async {
    final all = await readAll();
    return all.where((a) => a.tripId == tripId).toList();
  }

  @override
  Future<List<LocalSosAlert>> readAll() async {
    await _writes;
    final dir = await _directory();
    final alerts = <LocalSosAlert>[];
    if (!await dir.exists()) return alerts;

    await for (final file in dir.list()) {
      if (file is File && file.path.endsWith('.json') && !file.path.endsWith('.tmp')) {
        try {
          final content = await file.readAsString();
          final json = jsonDecode(content) as Map<String, dynamic>;
          alerts.add(LocalSosAlert.fromJson(json));
        } catch (_) {
          // Ignore partially damaged or unreadable file
        }
      }
    }
    return alerts;
  }

  @override
  Future<void> put(LocalSosAlert alert) {
    if (!RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(alert.id)) {
      throw ArgumentError('Invalid SOS identity');
    }
    return _write(alert.id, alert.toJson());
  }

  @override
  Future<void> delete(String tripId, String alertId) {
    final operation = _writes.then((_) async {
      final dir = await _directory();
      final file = File('${dir.path}/$alertId.json');
      if (await file.exists()) {
        await file.delete();
      }
    });
    _writes = operation.catchError((Object _) {});
    return operation;
  }
}

final sosStoreProvider = Provider<SosStore>((ref) {
  final user = ref.watch(authControllerProvider).valueOrNull;
  final userId = user?.id ?? 'anonymous';
  return SosStore.create(userId);
});
