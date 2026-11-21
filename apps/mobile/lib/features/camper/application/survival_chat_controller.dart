import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/client_uuid.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/domain/user_role.dart';
import '../../offline_packages/application/offline_trip_providers.dart';
import '../../offline_packages/domain/offline_trip.dart';
import '../../sync/application/connectivity_source.dart';
import '../data/survival_chat_api.dart';
import '../data/survival_local_model.dart';
import '../data/survival_local_policy_v1.dart';

class SurvivalChatTurn {
  const SurvivalChatTurn(
    this.id,
    this.question, {
    this.answer,
    this.failure,
    this.trip,
  });

  final String id;
  final String question;
  final SurvivalChatAnswer? answer;
  final SurvivalChatFailure? failure;
  final OfflineTripSelection? trip;

  bool get pending => answer == null && failure == null;
}

class SurvivalChatFailure {
  const SurvivalChatFailure(
    this.message, {
    this.retryable = false,
    this.emergency = false,
    this.onlineAttemptUncertain = false,
  });

  factory SurvivalChatFailure.fromError(ApiException error) {
    final data = error.errorData;
    if (data is Map && data['code'] == 'RETRIEVAL_UNAVAILABLE') {
      return const SurvivalChatFailure(
        'Tạm thời chưa đọc được tài liệu sinh tồn.',
        retryable: true,
        onlineAttemptUncertain: true,
      );
    }
    if (error.kind == ApiExceptionKind.network) {
      return SurvivalChatFailure(
        'Không kết nối được với trợ lý. Bạn có thể thử lại.',
        retryable: true,
        onlineAttemptUncertain: !error.connectionNotEstablished,
      );
    }
    if (error.kind == ApiExceptionKind.timeout ||
        (data is Map && data['code'] == 'AI_TIMEOUT')) {
      return const SurvivalChatFailure(
        'Trợ lý phản hồi quá lâu. Bạn có thể thử lại.',
        retryable: true,
        onlineAttemptUncertain: true,
      );
    }
    return switch (error.statusCode) {
      400 || 413 || 422 => const SurvivalChatFailure(
        'Câu hỏi chưa hợp lệ. Hãy kiểm tra rồi gửi lại.',
      ),
      401 => const SurvivalChatFailure(
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      ),
      403 => const SurvivalChatFailure(
        'Tài khoản này chưa có quyền dùng trợ lý sinh tồn.',
      ),
      409 => const SurvivalChatFailure(
        'Hãy nhập lại câu hỏi để gửi một lượt mới.',
      ),
      429 => const SurvivalChatFailure(
        'Vui lòng đợi vài giây rồi thử lại.',
        retryable: true,
        onlineAttemptUncertain: true,
      ),
      _ => uncertain,
    };
  }

  static const uncertain = SurvivalChatFailure(
    'Trợ lý tạm thời gián đoạn. Bạn có thể thử lại sau.',
    retryable: true,
    onlineAttemptUncertain: true,
  );

  final String message;
  final bool retryable;
  final bool emergency;
  final bool onlineAttemptUncertain;
}

final survivalChatAccountProvider = Provider<String?>((ref) {
  final auth = ref.watch(authControllerProvider);
  final user = auth.isLoading ? null : auth.asData?.value;
  if (user == null) return null;
  final roles = user.roles.isEmpty ? [user.role] : user.roles;
  return roles.contains(UserRole.camper) ? user.id : null;
});

final _emergency = RegExp(
  r'không (?:thở|tỉnh)|ngừng thở|bất tỉnh|mất ý thức|co giật|'
  r'nghẹt thở|chảy máu (?:nhiều|không ngừng)|'
  r'(?:bị|đang) (?:đuối nước|đau ngực|khó thở)|'
  r'\b(?:unconscious|not breathing|severe bleeding|choking)\b',
  caseSensitive: false,
);
final survivalChatSnapshotProvider = Provider.autoDispose
    .family<Future<OfflineTrip?>, OfflineTripSelection>(
      (ref, trip) => ref.watch(offlineTripProvider(trip).future),
    );

class SurvivalChatController extends Notifier<List<SurvivalChatTurn>> {
  Object? _session;
  bool _offlineAccessDenied = false;

  @override
  List<SurvivalChatTurn> build() {
    ref.watch(survivalChatAccountProvider);
    _offlineAccessDenied = false;
    _session = Object();
    ref.onDispose(() => _session = null);
    return const [];
  }

  bool send(String question, {OfflineTripSelection? trip}) {
    final account = ref.read(survivalChatAccountProvider);
    if (account == null ||
        (trip != null && trip.accountId != account) ||
        question.trim().isEmpty ||
        question.length > survivalQuestionLimit ||
        question.contains('\u0000') ||
        state.any((turn) => turn.pending)) {
      return false;
    }
    final turn = SurvivalChatTurn(newClientUuid(), question, trip: trip);
    state = [...state, turn];
    _request(turn);
    return true;
  }

  void retry(SurvivalChatTurn turn) {
    if (!state.contains(turn) ||
        turn.failure?.retryable != true ||
        state.any((item) => item.pending)) {
      return;
    }
    final pending = SurvivalChatTurn(turn.id, turn.question, trip: turn.trip);
    _replace(pending);
    _request(pending, allowLocal: turn.failure?.onlineAttemptUncertain != true);
  }

  Future<void> _request(
    SurvivalChatTurn pending, {
    bool allowLocal = true,
  }) async {
    final session = _session;
    final account = ref.read(survivalChatAccountProvider);
    bool current() =>
        identical(session, _session) &&
        account != null &&
        ref.read(survivalChatAccountProvider) == account;
    final api = ref.read(survivalChatApiProvider);
    final model = ref.read(survivalLocalModelProvider);
    final connectivity = ref.read(connectivitySourceProvider);
    SurvivalChatTurn result;
    try {
      if (_emergency.hasMatch(pending.question)) {
        _replace(
          SurvivalChatTurn(
            pending.id,
            pending.question,
            failure: const SurvivalChatFailure(
              'Nếu có người đang gặp nguy hiểm, hãy liên hệ cấp cứu hoặc lực lượng cứu hộ tại chỗ ngay.',
              emergency: true,
            ),
            trip: pending.trip,
          ),
        );
        return;
      }
      final connected =
          (!model.enabled && pending.trip == null) ||
          await connectivity.isConnected();
      if (!current()) return;
      SurvivalChatResult reply;
      final hasSnapshotQuestion =
          pending.trip != null &&
          savedCheckpointQuestionV1.hasMatch(pending.question);
      if (!connected) {
        if (_offlineAccessDenied) {
          throw ApiException(
            '',
            statusCode: 403,
            kind: ApiExceptionKind.response,
          );
        }
        if (!allowLocal) {
          throw ApiException('', kind: ApiExceptionKind.timeout);
        }
        if (!model.supported && !hasSnapshotQuestion) {
          _replace(
            SurvivalChatTurn(
              pending.id,
              pending.question,
              failure: const SurvivalChatFailure(
                'Thiết bị này cần kết nối mạng để dùng trợ lý.',
                retryable: true,
              ),
            ),
          );
          return;
        }
        reply = await _localReply(model, pending.question, trip: pending.trip);
      } else {
        try {
          reply = await api.ask(pending.question, pending.id);
          if (current()) _offlineAccessDenied = false;
        } on ApiException catch (error) {
          if (current() &&
              (error.statusCode == 401 || error.statusCode == 403)) {
            _offlineAccessDenied = true;
          }
          if (!allowLocal ||
              _offlineAccessDenied ||
              (!model.supported && !hasSnapshotQuestion) ||
              !current() ||
              !error.connectionNotEstablished) {
            rethrow;
          }
          reply = await _localReply(
            model,
            pending.question,
            trip: pending.trip,
          );
        }
      }
      result = switch (reply) {
        SurvivalChatAnswer() => SurvivalChatTurn(
          pending.id,
          pending.question,
          answer: reply,
          trip: pending.trip,
        ),
        SurvivalChatUnavailable() => SurvivalChatTurn(
          pending.id,
          pending.question,
          failure: SurvivalChatFailure(
            reply.refused
                ? 'Chưa thể đưa ra hướng dẫn an toàn cho câu hỏi này. Nếu có người đang gặp nguy hiểm, hãy liên hệ cấp cứu hoặc lực lượng cứu hộ tại chỗ ngay.'
                : 'Chưa tìm thấy hướng dẫn phù hợp trong tài liệu hiện có. Bạn có thể hỏi cụ thể hơn.',
          ),
          trip: pending.trip,
        ),
      };
    } on ApiException catch (error) {
      result = SurvivalChatTurn(
        pending.id,
        pending.question,
        failure: SurvivalChatFailure.fromError(error),
        trip: pending.trip,
      );
    } on LocalModelFailure catch (error) {
      result = SurvivalChatTurn(
        pending.id,
        pending.question,
        failure: SurvivalChatFailure(
          error == LocalModelFailure.unavailable
              ? 'Hãy kết nối mạng hoặc tải trợ lý để hỏi khi mất mạng.'
              : 'Trợ lý trên thiết bị tạm thời gián đoạn. Bạn có thể thử lại.',
          retryable: true,
        ),
        trip: pending.trip,
      );
    } catch (_) {
      result = SurvivalChatTurn(
        pending.id,
        pending.question,
        failure: SurvivalChatFailure.uncertain,
        trip: pending.trip,
      );
    }
    if (current() && state.contains(pending)) {
      _replace(result);
    }
  }

  Future<SurvivalChatResult> _localReply(
    SurvivalLocalModel model,
    String question, {
    OfflineTripSelection? trip,
  }) async {
    if (trip != null && savedCheckpointQuestionV1.hasMatch(question)) {
      final provider = survivalChatSnapshotProvider(trip);
      ref.invalidate(offlineTripProvider(trip));
      final snapshot = await ref.read(provider);
      if (snapshot == null ||
          ref.read(survivalChatAccountProvider) != trip.accountId) {
        return const SurvivalChatUnavailable(refused: true);
      }
      final count = snapshot.checkpoints.length;
      return SurvivalChatAnswer.local(
        'Trong gói đã lưu có $count điểm dừng.',
        snapshotVersion: trip.version,
        packageId: snapshot.packageId,
        localTrace: SurvivalLocalTrace.savedCheckpointCount(
          DateTime.now().toUtc(),
        ),
      );
    }
    if (!allowsLocalModelTextV1(question)) {
      return const SurvivalChatUnavailable(refused: true);
    }
    final reply = await model.generate(question);
    final text = reply.text;
    if (!allowsLocalModelAnswerV1(text)) {
      return const SurvivalChatUnavailable(refused: true);
    }
    return SurvivalChatAnswer.local(
      text,
      modelId: reply.modelId,
      modelVersion: reply.modelVersion,
      localTrace: SurvivalLocalTrace.pretrained(
        reply.observedAt,
        reply.runtimeConfigVersion,
      ),
    );
  }

  void _replace(SurvivalChatTurn turn) {
    state = [
      for (final item in state)
        if (item.id == turn.id) turn else item,
    ];
  }
}

final survivalChatControllerProvider =
    NotifierProvider<SurvivalChatController, List<SurvivalChatTurn>>(
      SurvivalChatController.new,
    );
