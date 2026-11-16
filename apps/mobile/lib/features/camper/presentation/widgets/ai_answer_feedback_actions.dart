import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../application/ai_feedback_queue.dart';
import '../../application/survival_chat_controller.dart';

const _unsafeLabel = 'Báo cáo câu trả lời không an toàn';
const _localDisclosure =
    'Khi gửi phản hồi, câu hỏi và câu trả lời này sẽ được gửi đến CTMS.';

class AiAnswerFeedbackActions extends ConsumerWidget {
  const AiAnswerFeedbackActions({super.key, required this.turn});

  final SurvivalChatTurn turn;

  bool _isCurrent(WidgetRef ref, AiFeedbackQueue queue) =>
      identical(ref.read(aiFeedbackQueueProvider), queue) &&
      ref.read(survivalChatControllerProvider).contains(turn);

  Future<void> _commit(
    BuildContext context,
    WidgetRef ref,
    AiFeedbackQueue queue, {
    AiAnswerRating? rating,
    bool unsafe = false,
    String? reason,
  }) async {
    if (!context.mounted || !_isCurrent(ref, queue)) return;
    try {
      await queue.commit(
        turn,
        rating: rating,
        reportUnsafe: unsafe,
        reason: reason,
      );
    } catch (_) {
      if (!context.mounted || !_isCurrent(ref, queue)) return;
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        const SnackBar(
          content: Text('Chưa lưu được phản hồi. Vui lòng thử lại.'),
        ),
      );
    }
  }

  Future<void> _chooseRating(
    BuildContext context,
    WidgetRef ref,
    AiFeedbackQueue queue,
  ) async {
    final result = await showModalBottomSheet<AiAnswerRating>(
      context: context,
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (turn.answer?.isLocal == true)
                const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: Text(_localDisclosure, textAlign: TextAlign.center),
                ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  TextButton.icon(
                    onPressed: () =>
                        Navigator.pop(sheet, AiAnswerRating.useful),
                    icon: const Icon(Icons.thumb_up_outlined),
                    label: const Text('Hữu ích'),
                  ),
                  TextButton.icon(
                    onPressed: () =>
                        Navigator.pop(sheet, AiAnswerRating.notUseful),
                    icon: const Icon(Icons.thumb_down_outlined),
                    label: const Text('Không hữu ích'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    if (context.mounted && result != null) {
      await _commit(context, ref, queue, rating: result);
    }
  }

  Future<void> _report(
    BuildContext context,
    WidgetRef ref,
    AiFeedbackQueue queue,
  ) async {
    var reason = '';
    final result = await showDialog<String>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text(_unsafeLabel),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (turn.answer?.isLocal == true) const Text(_localDisclosure),
            TextField(
              maxLength: 1000,
              minLines: 2,
              maxLines: 4,
              onChanged: (value) => reason = value,
              decoration: const InputDecoration(
                labelText: 'Lý do (không bắt buộc)',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialog, reason.trim()),
            child: const Text('Gửi báo cáo'),
          ),
        ],
      ),
    );
    if (context.mounted && result != null) {
      await _commit(
        context,
        ref,
        queue,
        unsafe: true,
        reason: result.isEmpty ? null : result,
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queue = ref.watch(aiFeedbackQueueProvider);
    if (queue == null) return const SizedBox.shrink();
    final entry = queue.forTurn(turn);
    final rating = entry?.rating;
    final reportSent = entry?.reportedUnsafe == true && entry?.rejected != true;
    void choose() => _chooseRating(context, ref, queue);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          button: true,
          label: switch (rating) {
            AiAnswerRating.useful => 'Đánh giá câu trả lời, hữu ích',
            AiAnswerRating.notUseful => 'Đánh giá câu trả lời, không hữu ích',
            null => 'Đánh giá câu trả lời',
          },
          child: InkResponse(
            key: const ValueKey('ai-answer-rating'),
            onTap: choose,
            onLongPress: choose,
            radius: 24,
            child: SizedBox.square(
              dimension: 48,
              child: Icon(
                switch (rating) {
                  AiAnswerRating.useful => Icons.thumb_up,
                  AiAnswerRating.notUseful => Icons.thumb_down,
                  null => Icons.thumb_up_outlined,
                },
                size: 20,
                color: rating == null
                    ? AppColors.textSecondary
                    : AppColors.brandPrimary,
              ),
            ),
          ),
        ),
        PopupMenuButton<String>(
          tooltip: 'Tùy chọn câu trả lời',
          icon: const Icon(Icons.more_horiz, size: 20),
          onSelected: (_) => _report(context, ref, queue),
          itemBuilder: (_) => [
            PopupMenuItem(
              value: 'unsafe',
              enabled: !reportSent,
              child: const Text(_unsafeLabel),
            ),
          ],
        ),
      ],
    );
  }
}
