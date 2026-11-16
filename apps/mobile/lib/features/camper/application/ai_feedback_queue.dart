import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/client_uuid.dart';
import '../data/ai_feedback_store.dart';
import 'survival_chat_controller.dart';

export '../data/ai_feedback_store.dart' show AiAnswerRating, AiFeedbackEntry;

typedef AiFeedbackSender =
    Future<void> Function(
      String account,
      Map<String, dynamic> payload,
      CancelToken cancel,
    );

class AiFeedbackQueue extends ChangeNotifier {
  AiFeedbackQueue({
    required this.account,
    required AiFeedbackStore store,
    required AiFeedbackSender send,
    DateTime Function()? clock,
  }) : _store = store,
       _send = send,
       _clock = clock ?? DateTime.now {
    ready = _load();
  }

  final String account;
  final AiFeedbackStore _store;
  final AiFeedbackSender _send;
  final DateTime Function() _clock;
  final _cancel = CancelToken();
  late final Future<void> ready;
  bool _disposed = false;
  bool _flushing = false;
  int _commits = 0;
  Map<String, AiFeedbackEntry> _entries = const {};

  int get commits => _commits;

  String _key(SurvivalChatTurn turn) => switch (turn.answer?.id) {
    final String id => 'online:$id',
    null => 'local:${turn.id}',
  };

  AiFeedbackEntry? forTurn(SurvivalChatTurn turn) => _entries[_key(turn)];

  Future<void> _load() async {
    try {
      _publish(await _store.read(account));
    } catch (_) {
      // The coordinator and commit path can retry the secure-store read.
    }
  }

  void _publish(Map<String, AiFeedbackEntry> entries) {
    if (_disposed) return;
    _entries = entries;
    notifyListeners();
  }

  Future<bool> commit(
    SurvivalChatTurn turn, {
    AiAnswerRating? rating,
    bool reportUnsafe = false,
    String? reason,
  }) async {
    final answer = turn.answer;
    if (_disposed || answer == null || (rating == null && !reportUnsafe)) {
      return false;
    }
    await ready;
    if (_disposed) return false;
    final installation = answer.isLocal ? await _store.installationId() : null;
    var committed = false;
    final entries = await _store.update(account, (entries) {
      if (_disposed) return;
      final key = _key(turn);
      final prior = entries[key];
      if ((reportUnsafe &&
              prior?.reportedUnsafe == true &&
              prior?.rejected != true) ||
          (!reportUnsafe &&
              rating == prior?.rating &&
              prior?.rejected != true)) {
        return;
      }
      final id = prior?.id ?? newClientUuid();
      final revision = (prior?.revision ?? 0) + 1;
      final now = _clock().toUtc();
      final unsafe = reportUnsafe || prior?.reportedUnsafe == true;
      final selected = rating ?? prior?.rating;
      entries[key] = AiFeedbackEntry(
        id: id,
        revision: revision,
        rating: selected,
        reportedUnsafe: unsafe,
        updatedAt: now,
        pending: {
          'clientFeedbackId': id,
          'clientMutationId': newClientUuid(),
          'revision': revision,
          'createdAt': now.toIso8601String(),
          'rating': selected?.wireValue,
          'reportedUnsafe': unsafe,
          if (unsafe)
            'reportedAt':
                prior?.pending?['reportedAt'] ?? now.toIso8601String(),
          'reason': reportUnsafe ? reason : prior?.pending?['reason'],
          if (answer.isLocal) ...{
            'inferenceMode': 'LOCAL',
            'localAnswerId': turn.id,
            'installationId': installation,
            'question': turn.question,
            'answer': answer.text,
            if (answer.modelId != null) 'modelId': answer.modelId,
            if (answer.modelVersion != null)
              'modelVersion': answer.modelVersion,
            if (answer.packageId != null) 'packageId': answer.packageId,
            if (answer.snapshotVersion != null)
              'packageVersion': answer.snapshotVersion,
          } else ...{
            'inferenceMode': 'ONLINE',
            'answerId': answer.id,
          },
        },
      );
      committed = true;
    });
    if (committed && !_disposed) _commits++;
    _publish(entries);
    return committed && !_disposed;
  }

  /// Called only after the coordinator runs safety synchronization.
  Future<({bool retry, bool rejected})> flush() async {
    if (_disposed || _flushing) return (retry: false, rejected: false);
    _flushing = true;
    try {
      await ready;
      var entries = await _store.read(account);
      final cutoff = _clock().toUtc().subtract(const Duration(days: 30));
      bool expired(AiFeedbackEntry entry) =>
          (entry.pending == null || entry.rejected) &&
          entry.updatedAt.isBefore(cutoff);
      if (entries.values.any(expired)) {
        entries = await _store.update(account, (value) {
          value.removeWhere((_, entry) => expired(entry));
        });
        _publish(entries);
      }
      final pending = entries.entries
          .where(
            (entry) => entry.value.pending != null && !entry.value.rejected,
          )
          .toList();
      var rejected = entries.values.any((entry) => entry.rejected);
      for (final entry in pending.take(20)) {
        if (_disposed) break;
        final payload = entry.value.pending!;
        var permanentlyRejected = false;
        try {
          await _send(account, payload, _cancel);
        } on ApiException catch (error) {
          if (_disposed) break;
          permanentlyRejected = switch (error.statusCode) {
            400 || 403 || 404 || 409 || 410 || 413 || 422 => true,
            _ => false,
          };
          if (!permanentlyRejected) return (retry: true, rejected: rejected);
        }
        if (_disposed) break;
        rejected = rejected || permanentlyRejected;
        final updated = await _store.update(account, (entries) {
          final latest = entries[entry.key];
          if (_disposed ||
              latest == null ||
              latest.pending?['clientMutationId'] !=
                  payload['clientMutationId']) {
            return;
          }
          entries[entry.key] = latest.delivered(
            rejected: permanentlyRejected,
            now: _clock().toUtc(),
          );
        });
        _publish(updated);
      }
      return (retry: !_disposed && pending.length > 20, rejected: rejected);
    } catch (_) {
      return (retry: !_disposed, rejected: false);
    } finally {
      _flushing = false;
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _cancel.cancel();
    super.dispose();
  }
}

final aiFeedbackQueueProvider = ChangeNotifierProvider<AiFeedbackQueue?>((ref) {
  final account = ref.watch(survivalChatAccountProvider);
  if (account == null) return null;
  final client = ref.watch(apiClientProvider);
  return AiFeedbackQueue(
    account: account,
    store: ref.watch(aiFeedbackStoreProvider),
    send: (account, payload, cancel) async {
      final response = await client.post<Map<String, dynamic>>(
        ApiEndpoints.ai.feedback,
        data: payload,
        expectedUserId: account,
        cancelToken: cancel,
      );
      final data = response.data;
      if (data == null ||
          data['feedbackId'] is! String ||
          data['revision'] is! int ||
          (data['revision'] as int) < (payload['revision'] as int) ||
          data['reportedUnsafe'] is! bool) {
        throw const FormatException('Invalid feedback acknowledgment');
      }
    },
  );
});
