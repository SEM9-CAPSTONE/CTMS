import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/camper/application/ai_feedback_queue.dart';
import 'package:mobile/features/camper/application/survival_chat_controller.dart';
import 'package:mobile/features/camper/data/ai_feedback_store.dart';
import 'package:mobile/features/camper/data/survival_chat_api.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const turn = SurvivalChatTurn(
    '97d8c3ac-9bb5-4bfd-99cd-b8020ff54f46',
    ' Chuẩn bị ba lô thế nào? ',
    answer: SurvivalChatAnswer.local(
      'Đặt đồ nặng gần lưng.\n',
      modelId: 'packing-model',
      modelVersion: '1',
    ),
  );
  const online = SurvivalChatTurn(
    'a3714d69-38b7-4ee9-9bc2-0ba93da0216f',
    'Đọc bản đồ thế nào?',
    answer: SurvivalChatAnswer(
      id: '55ced187-51a4-4f12-8027-954d6d48a98f',
      text: 'Đọc chú giải bản đồ.',
      sources: [],
    ),
  );
  late AiFeedbackStore store;

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    store = AiFeedbackStore();
  });

  test(
    'replays exact selected Local evidence after a restart and a lost acknowledgment',
    () async {
      final requests = <Map<String, dynamic>>[];
      Future<void> send(
        String _,
        Map<String, dynamic> body,
        CancelToken cancel,
      ) async {
        requests.add(body);
        if (requests.length == 1) {
          throw ApiException('timeout', kind: ApiExceptionKind.timeout);
        }
      }

      final original = AiFeedbackQueue(
        account: 'camper-a',
        store: store,
        send: send,
      );
      await original.commit(turn, rating: AiAnswerRating.notUseful);
      final operation = original.forTurn(turn)?.pending;
      original.dispose();

      final restored = AiFeedbackQueue(
        account: 'camper-a',
        store: AiFeedbackStore(),
        send: send,
      );
      addTearDown(restored.dispose);
      expect((await restored.flush()).retry, isTrue);
      expect(restored.forTurn(turn)?.pending, operation);
      expect((await restored.flush()).retry, isFalse);
      expect(requests, [operation, operation]);
      expect(requests.first, containsPair('question', turn.question));
      expect(requests.first, containsPair('answer', turn.answer!.text));
      expect(requests.first, containsPair('modelVersion', '1'));
      expect(requests.first.containsKey('transcript'), isFalse);
      expect(restored.forTurn(online), isNull);
      expect(restored.forTurn(turn)?.pending, isNull);
      expect(restored.forTurn(turn)?.rating, AiAnswerRating.notUseful);

      final saved = await const FlutterSecureStorage().read(
        key: 'aiAnswerFeedback:camper-a',
      );
      expect(saved, isNot(contains(turn.answer!.text.trim())));
      await restored.flush();
      expect(requests, hasLength(2));
    },
  );

  test(
    'late acknowledgment cannot erase the latest revision or an Unsafe report',
    () async {
      final sent = Completer<Map<String, dynamic>>();
      final ack = Completer<void>();
      var now = DateTime.utc(2026, 11, 16);
      final queue = AiFeedbackQueue(
        account: 'camper-a',
        store: store,
        clock: () => now,
        send: (_, body, _) {
          sent.complete(body);
          return ack.future;
        },
      );
      addTearDown(queue.dispose);
      await queue.commit(turn, reportUnsafe: true, reason: 'Thiếu cảnh báo');
      final delivery = queue.flush();
      final report = await sent.future;
      expect(report, containsPair('rating', null));
      now = now.add(const Duration(minutes: 1));
      await queue.commit(turn, rating: AiAnswerRating.useful);
      expect(await queue.commit(turn, rating: AiAnswerRating.useful), isFalse);
      ack.complete();
      await delivery;
      expect(queue.forTurn(turn)?.rating, AiAnswerRating.useful);
      expect(queue.forTurn(turn)?.pending, containsPair('revision', 2));
      expect(queue.forTurn(turn)?.pending, containsPair('reportedAt', report['createdAt']));
      expect(
        queue.forTurn(turn)?.pending,
        containsPair('reportedUnsafe', true),
      );
      expect(
        queue.forTurn(turn)?.pending,
        containsPair('reason', 'Thiếu cảnh báo'),
      );
    },
  );

  test(
    'an in-flight send cannot change accounts or clear stored work after logout',
    () async {
      final sending = Completer<CancelToken>();
      final staleAck = Completer<void>();
      final sentOwners = <String>[];
      final original = AiFeedbackQueue(
        account: 'camper-a',
        store: store,
        send: (owner, _, cancel) {
          sentOwners.add(owner);
          sending.complete(cancel);
          return staleAck.future;
        },
      );
      await original.commit(turn, reportUnsafe: true);
      final pendingSend = original.flush();
      final oldSession = await sending.future;
      final operation = original.forTurn(turn)?.pending;
      original.dispose();
      expect(oldSession.isCancelled, isTrue);
      Future<void> send(
        String owner,
        Map<String, dynamic> body,
        CancelToken _,
      ) async {
        sentOwners.add(owner);
        expect(body, operation);
      }

      final other = AiFeedbackQueue(
        account: 'camper-b',
        store: store,
        send: send,
      );
      addTearDown(other.dispose);
      await other.flush();
      expect(other.forTurn(turn), isNull);
      expect(sentOwners, ['camper-a']);

      staleAck.complete();
      await pendingSend;
      final returning = AiFeedbackQueue(
        account: 'camper-a',
        store: store,
        send: send,
      );
      addTearDown(returning.dispose);
      await returning.flush();
      expect(sentOwners, ['camper-a', 'camper-a']);
      expect(returning.forTurn(turn)?.pending, isNull);
    },
  );

  test(
    'keeps an ineligible Online feedback terminal and does not re-upload it',
    () async {
      var sends = 0;
      final queue = AiFeedbackQueue(
        account: 'camper-a',
        store: store,
        send: (_, body, _) async {
          sends++;
          expect(body, containsPair('inferenceMode', 'ONLINE'));
          expect(body, containsPair('answerId', online.answer!.id));
          expect(body.containsKey('answer'), isFalse);
          throw ApiException('expired', statusCode: 404);
        },
      );
      addTearDown(queue.dispose);
      await queue.commit(online, rating: AiAnswerRating.useful);
      final result = await queue.flush();
      expect(result.retry, isFalse);
      expect(result.rejected, isTrue);
      expect(queue.forTurn(online)?.rating, AiAnswerRating.useful);
      await queue.flush();
      expect(sends, 1);
    },
  );
}
