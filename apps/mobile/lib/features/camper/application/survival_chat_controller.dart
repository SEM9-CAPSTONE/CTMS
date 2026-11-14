import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../data/survival_chat_api.dart';

class SurvivalChatTurn {
  const SurvivalChatTurn(this.id, this.question, {this.answer, this.failure});

  final String id;
  final String question;
  final SurvivalChatAnswer? answer;
  final SurvivalChatFailure? failure;

  bool get pending => answer == null && failure == null;
}

class SurvivalChatFailure {
  const SurvivalChatFailure(this.message, {this.retryable = false});

  factory SurvivalChatFailure.fromError(ApiException error) {
    final data = error.errorData;
    if (data is Map && data['code'] == 'RETRIEVAL_UNAVAILABLE') {
      return const SurvivalChatFailure(
        'Tạm thời chưa đọc được tài liệu sinh tồn.',
        retryable: true,
      );
    }
    if (error.kind == ApiExceptionKind.network) {
      return const SurvivalChatFailure(
        'Kiểm tra kết nối mạng rồi thử lại.',
        retryable: true,
      );
    }
    if (error.kind == ApiExceptionKind.timeout ||
        (data is Map && data['code'] == 'AI_TIMEOUT')) {
      return const SurvivalChatFailure(
        'Trợ lý phản hồi quá lâu. Bạn có thể thử lại.',
        retryable: true,
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
      ),
      _ => unavailable,
    };
  }

  static const unavailable = SurvivalChatFailure(
    'Trợ lý tạm thời gián đoạn.',
    retryable: true,
  );

  final String message;
  final bool retryable;
}

class SurvivalChatController
    extends AutoDisposeNotifier<List<SurvivalChatTurn>> {
  Object? _session;

  @override
  List<SurvivalChatTurn> build() {
    _session = Object();
    ref.onDispose(() => _session = null);
    return const [];
  }

  bool send(String question) {
    if (question.trim().isEmpty ||
        question.length > survivalQuestionLimit ||
        question.contains('\u0000') ||
        state.any((turn) => turn.pending)) {
      return false;
    }
    final turn = SurvivalChatTurn(_requestId(), question);
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
    final pending = SurvivalChatTurn(turn.id, turn.question);
    _replace(pending);
    _request(pending);
  }

  Future<void> _request(SurvivalChatTurn pending) async {
    final session = _session;
    final api = ref.read(survivalChatApiProvider);
    SurvivalChatTurn result;
    try {
      final reply = await api.ask(pending.question, pending.id);
      result = switch (reply) {
        SurvivalChatAnswer() => SurvivalChatTurn(
          pending.id,
          pending.question,
          answer: reply,
        ),
        SurvivalChatUnavailable() => SurvivalChatTurn(
          pending.id,
          pending.question,
          failure: SurvivalChatFailure(
            reply.refused
                ? 'Chưa thể đưa ra hướng dẫn an toàn cho câu hỏi này. Nếu có người đang gặp nguy hiểm, hãy liên hệ cấp cứu hoặc lực lượng cứu hộ tại chỗ ngay.'
                : 'Chưa tìm thấy hướng dẫn phù hợp trong tài liệu hiện có. Bạn có thể hỏi cụ thể hơn.',
          ),
        ),
      };
    } on ApiException catch (error) {
      result = SurvivalChatTurn(
        pending.id,
        pending.question,
        failure: SurvivalChatFailure.fromError(error),
      );
    } catch (_) {
      result = SurvivalChatTurn(
        pending.id,
        pending.question,
        failure: SurvivalChatFailure.unavailable,
      );
    }
    if (identical(session, _session) && state.contains(pending)) {
      _replace(result);
    }
  }

  void _replace(SurvivalChatTurn turn) {
    state = [
      for (final item in state)
        if (item.id == turn.id) turn else item,
    ];
  }
}

String _requestId() {
  final random = Random.secure();
  final bytes = List.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes
      .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
      .join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

final survivalChatControllerProvider =
    AutoDisposeNotifierProvider<SurvivalChatController, List<SurvivalChatTurn>>(
      SurvivalChatController.new,
    );
