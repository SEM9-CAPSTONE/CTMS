import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/api/client_uuid.dart';

/// Each update writes the committed operation and its evidence in a single
/// account-scoped entry. Serialize access across logout and login transitions.
class AiFeedbackStore {
  AiFeedbackStore([this._storage = const FlutterSecureStorage()]);

  final FlutterSecureStorage _storage;
  Future<void> _writes = Future.value();

  Future<T> _serial<T>(Future<T> Function() action) {
    final result = _writes.then((_) => action());
    _writes = result.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return result;
  }

  Future<String> installationId() => _serial(() async {
    const key = 'aiFeedbackInstallation';
    final installed = await _storage.read(key: key);
    if (installed != null) return installed;
    final id = newClientUuid();
    await _storage.write(key: key, value: id);
    return id;
  });

  Future<Map<String, AiFeedbackEntry>> read(String account) =>
      _serial(() => _read(account));

  Future<Map<String, AiFeedbackEntry>> update(
    String account,
    void Function(Map<String, AiFeedbackEntry>) change,
  ) => _serial(() async {
    final entries = await _read(account);
    change(entries);
    await _storage.write(key: _key(account), value: jsonEncode(entries));
    return entries;
  });

  String _key(String account) => 'aiAnswerFeedback:$account';

  Future<Map<String, AiFeedbackEntry>> _read(String account) async {
    final raw = await _storage.read(key: _key(account));
    if (raw == null) return {};
    final entries = jsonDecode(raw) as Map<String, dynamic>;
    return entries.map(
      (key, value) => MapEntry(
        key,
        AiFeedbackEntry.fromJson(value as Map<String, dynamic>),
      ),
    );
  }
}

enum AiAnswerRating {
  useful('USEFUL'),
  notUseful('NOT_USEFUL');

  const AiAnswerRating(this.wireValue);
  final String wireValue;
}

class AiFeedbackEntry {
  const AiFeedbackEntry({
    required this.id,
    required this.revision,
    required this.rating,
    required this.reportedUnsafe,
    required this.updatedAt,
    required this.pending,
    this.rejected = false,
    this.includesLocalTrace = false,
  });

  factory AiFeedbackEntry.fromJson(Map<String, dynamic> data) =>
      AiFeedbackEntry(
        id: data['id'] as String,
        revision: data['revision'] as int,
        rating: AiAnswerRating.values
            .where((rating) => rating.wireValue == data['rating'])
            .firstOrNull,
        reportedUnsafe: data['reportedUnsafe'] as bool,
        updatedAt: DateTime.parse(data['updatedAt'] as String),
        pending: data['pending'] as Map<String, dynamic>?,
        rejected: data['rejected'] == true,
        includesLocalTrace:
            data['includesLocalTrace'] == true ||
            (data['pending'] as Map<String, dynamic>?)?.containsKey(
                  'localTrace',
                ) ==
                true,
      );

  final String id;
  final int revision;
  final AiAnswerRating? rating;
  final bool reportedUnsafe;
  final DateTime updatedAt;
  final Map<String, dynamic>? pending;
  final bool rejected;
  final bool includesLocalTrace;

  AiFeedbackEntry delivered({required bool rejected, required DateTime now}) =>
      AiFeedbackEntry(
        id: id,
        revision: revision,
        rating: rating,
        reportedUnsafe: reportedUnsafe,
        updatedAt: now,
        pending: rejected ? pending : null,
        rejected: rejected,
        includesLocalTrace: includesLocalTrace,
      );

  Map<String, Object?> toJson() => {
    'id': id,
    'revision': revision,
    'rating': rating?.wireValue,
    'reportedUnsafe': reportedUnsafe,
    'updatedAt': updatedAt.toIso8601String(),
    'pending': pending,
    'rejected': rejected,
    if (includesLocalTrace) 'includesLocalTrace': true,
  };
}

final aiFeedbackStoreProvider = Provider((ref) => AiFeedbackStore());
