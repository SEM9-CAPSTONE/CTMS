import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';

import '../domain/checkpoint_arrival_models.dart';

/// Bản ghi trạng thái lưu trữ của một Trip, gắn liền với một tài khoản người dùng cụ thể.
class CheckpointArrivalRecord {
  const CheckpointArrivalRecord({
    this.tripId = '',
    this.userId = '',
    this.context,
    this.arrivals = const [],
  });

  final String tripId;
  final String userId;
  final CheckpointArrivalContext? context;
  final List<LocalCheckpointArrival> arrivals;

  Set<String> get reachedCheckpointIds =>
      arrivals.map((a) => a.checkpointId).toSet();

  List<LocalCheckpointArrival> get pendingQueue =>
      arrivals.where((a) => a.syncState == CheckpointSyncState.pending).toList();

  List<LocalCheckpointArrival> get dueQueue {
    final now = DateTime.now().toUtc();
    return arrivals.where((a) {
      if (a.syncState != CheckpointSyncState.pending) return false;
      if (a.nextRetryAt == null) return true;
      return now.isAfter(a.nextRetryAt!) || now.isAtSameMomentAs(a.nextRetryAt!);
    }).toList();
  }

  int get syncedCount =>
      arrivals.where((a) => a.syncState == CheckpointSyncState.synced).length;

  int get pendingCount =>
      arrivals.where((a) => a.syncState == CheckpointSyncState.pending).length;

  int get pausedCount =>
      arrivals.where((a) => a.syncState == CheckpointSyncState.paused).length;

  int get failedCount =>
      arrivals.where((a) => a.syncState == CheckpointSyncState.failed).length;

  CheckpointArrivalRecord copyWith({
    String? tripId,
    String? userId,
    CheckpointArrivalContext? context,
    List<LocalCheckpointArrival>? arrivals,
  }) => CheckpointArrivalRecord(
    tripId: tripId ?? this.tripId,
    userId: userId ?? this.userId,
    context: context ?? this.context,
    arrivals: arrivals ?? this.arrivals,
  );

  factory CheckpointArrivalRecord.fromJson(Map<String, Object?> json) =>
      CheckpointArrivalRecord(
        tripId: (json['tripId'] as String?) ?? '',
        userId: (json['userId'] as String?) ?? '',
        context: json['context'] == null
            ? null
            : CheckpointArrivalContext.fromJson(
                Map<String, Object?>.from(json['context'] as Map),
              ),
        arrivals: [
          for (final item in (json['arrivals'] as List<dynamic>? ?? []))
            LocalCheckpointArrival.fromJson(Map<String, Object?>.from(item as Map)),
        ],
      );

  Map<String, Object?> toJson() => {
    'tripId': tripId,
    'userId': userId,
    if (context != null) 'context': context!.toJson(),
    'arrivals': [for (final a in arrivals) a.toJson()],
  };
}

/// Abstract interface lưu trữ lượt đến và hàng đợi đồng bộ của Checkpoints.
abstract interface class CheckpointArrivalStore {
  Future<CheckpointArrivalRecord> read(String tripId);

  Future<CheckpointArrivalRecord> update(
    String tripId,
    CheckpointArrivalRecord Function(CheckpointArrivalRecord current) transform,
  );

  Future<void> clear(String tripId);

  factory CheckpointArrivalStore.create(String userId) {
    if (kIsWeb) {
      return WebCheckpointArrivalStore(userId);
    }
    return FileCheckpointArrivalStore(userId);
  }
}

/// Web-compatible Store dùng FlutterSecureStorage với in-memory caching.
class WebCheckpointArrivalStore implements CheckpointArrivalStore {
  WebCheckpointArrivalStore(this.userId, [FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final String userId;
  final FlutterSecureStorage _storage;
  final Map<String, CheckpointArrivalRecord> _cache = {};

  String _storageKey(String tripId) => 'ctms_checkpoint_arrivals_${userId}_$tripId';

  Future<CheckpointArrivalRecord> _ensureLoaded(String tripId) async {
    if (_cache.containsKey(tripId)) return _cache[tripId]!;
    try {
      final raw = await _storage.read(key: _storageKey(tripId));
      if (raw != null && raw.isNotEmpty) {
        final record = CheckpointArrivalRecord.fromJson(
          Map<String, Object?>.from(jsonDecode(raw) as Map),
        );
        _cache[tripId] = record;
        return record;
      }
    } catch (_) {}
    final empty = CheckpointArrivalRecord(tripId: tripId, userId: userId);
    _cache[tripId] = empty;
    return empty;
  }

  @override
  Future<CheckpointArrivalRecord> read(String tripId) async => _ensureLoaded(tripId);

  @override
  Future<CheckpointArrivalRecord> update(
    String tripId,
    CheckpointArrivalRecord Function(CheckpointArrivalRecord current) transform,
  ) async {
    final current = await _ensureLoaded(tripId);
    final next = transform(current);
    _cache[tripId] = next;
    try {
      await _storage.write(key: _storageKey(tripId), value: jsonEncode(next.toJson()));
    } catch (_) {}
    return next;
  }

  @override
  Future<void> clear(String tripId) async {
    _cache.remove(tripId);
    try {
      await _storage.delete(key: _storageKey(tripId));
    } catch (_) {}
  }
}

/// File-based Atomic Store phân lập theo `userId` (tài khoản) và `tripId`.
/// Ghi nguyên tử ra file `.tmp` rồi rename để chống hỏng file khi crash/tắt máy đột ngột.
class FileCheckpointArrivalStore implements CheckpointArrivalStore {
  FileCheckpointArrivalStore(this.userId, {this.root});

  final String userId;
  final Directory? root;
  Future<void> _writes = Future.value();

  Future<File> _file(String tripId) async {
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
      '${base.path}/checkpoint-arrivals/$account',
    ).create(recursive: true);
    return File('${directory.path}/$tripId.json');
  }

  Future<CheckpointArrivalRecord> _readFile(String tripId) async {
    final file = await _file(tripId);
    if (!await file.exists()) {
      return CheckpointArrivalRecord(tripId: tripId, userId: userId);
    }
    try {
      final content = await file.readAsString();
      return CheckpointArrivalRecord.fromJson(
        Map<String, Object?>.from(jsonDecode(content) as Map),
      );
    } catch (_) {
      return CheckpointArrivalRecord(tripId: tripId, userId: userId);
    }
  }

  @override
  Future<CheckpointArrivalRecord> read(String tripId) async {
    await _writes;
    return _readFile(tripId);
  }

  @override
  Future<CheckpointArrivalRecord> update(
    String tripId,
    CheckpointArrivalRecord Function(CheckpointArrivalRecord current) transform,
  ) {
    final operation = _writes.then((_) async {
      final current = await _readFile(tripId);
      final next = transform(current);
      final file = await _file(tripId);
      final temporary = File('${file.path}.tmp');
      await temporary.writeAsString(jsonEncode(next.toJson()), flush: true);
      if (await file.exists()) {
        await file.delete();
      }
      await temporary.rename(file.path);
      return next;
    });
    _writes = operation.then((_) {}, onError: (Object _) {});
    return operation;
  }

  @override
  Future<void> clear(String tripId) async {
    final operation = _writes.then((_) async {
      final file = await _file(tripId);
      if (await file.exists()) {
        await file.delete();
      }
    });
    _writes = operation.then((_) {}, onError: (Object _) {});
    await operation;
  }
}

/// Helper tính toán Exponential Backoff (5s..60s) theo hợp đồng với BE.
Duration calculateCheckpointBackoff(int attempts) {
  final exp = min(attempts, 4); // 5s * 2^0=5s, 2^1=10s, 2^2=20s, 2^3=40s, 2^4=60s (capped)
  final seconds = min(60, 5 * pow(2, exp).toInt());
  return Duration(seconds: seconds);
}

