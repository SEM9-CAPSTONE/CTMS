import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/camper/application/ai_feedback_queue.dart';
import 'package:mobile/features/camper/application/survival_chat_controller.dart';
import 'package:mobile/features/camper/data/survival_local_model.dart';
import 'package:mobile/features/camper/data/survival_local_runtime_v1.dart';
import 'package:mobile/features/camper/presentation/camper_ai_assistant_screen.dart';
import 'package:mobile/features/offline_packages/application/offline_trip_providers.dart';
import 'package:mobile/features/offline_packages/domain/offline_trip.dart';
import 'package:mobile/features/sync/application/connectivity_source.dart';

class _Connection implements ConnectivitySource {
  bool online = true;

  @override
  Future<bool> isConnected() async => online;

  @override
  Stream<bool> get onConnectivityChanged => const Stream.empty();
}

class _LocalModel extends SurvivalLocalModel {
  _LocalModel() : super(enabled: true);

  int requests = 0;
  String modelVersion = '1';

  @override
  bool get supported => true;

  @override
  Future<bool> latestReady() async => true;

  @override
  Future<SurvivalLocalReply> generate(String question) async {
    requests++;
    return (
      text: 'Xếp đồ nặng gần lưng và để áo mưa ở ngăn dễ lấy.',
      modelId: 'packing-model',
      modelVersion: modelVersion,
      observedAt: DateTime.utc(2026, 11, 16),
      runtimeConfigVersion: localRuntimeConfigV1,
    );
  }
}

final _account = StateProvider<String?>((ref) => 'camper-a');

class _Tokens extends TokenStorage {
  _Tokens() : super(const FlutterSecureStorage());

  @override
  Future<String?> readAccessToken() async => 'camper-access-token';
}

class _Transport implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  final replies = <Completer<ResponseBody>>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    requests.add(options);
    final reply = Completer<ResponseBody>();
    replies.add(reply);
    return reply.future;
  }

  void reply(int index, Map<String, Object?> body, {int status = 200}) {
    replies[index].complete(
      ResponseBody.fromString(
        jsonEncode(body),
        status,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      ),
    );
  }

  @override
  void close({bool force = false}) {}
}

const question = 'Đọc bản đồ địa hình như thế nào?';
const answerText = 'Đọc chú giải để nhận biết ký hiệu trên bản đồ.';
const source = {
  'documentId': '00000000-0000-4000-8000-000000000001',
  'documentVersionId': '00000000-0000-4000-8000-000000000002',
  'sourceVersion': 2,
  'chunkSetId': '00000000-0000-4000-8000-000000000003',
  'chunkId': '00000000-0000-4000-8000-000000000004',
  'chunkIndex': 0,
  'title': 'Kỹ năng đọc bản đồ',
  'classification': 'TREKKING_SAFETY',
  'locale': 'vi',
  'locations': [
    {'page': 1, 'itemRef': '#/texts/0'},
  ],
};
const answered = {
  'status': 'ANSWERED',
  'answerId': 'answer-identifier',
  'answer': answerText,
  'sources': [source],
};

void main() {
  late _Transport transport;
  late ProviderContainer container;
  late _Connection network;

  Future<void> open(
    WidgetTester tester, {
    _LocalModel? model,
    Future<OfflineTrip?> Function(OfflineTripSelection)? snapshot,
  }) async {
    FlutterSecureStorage.setMockInitialValues({});
    transport = _Transport();
    network = _Connection();
    final client = ApiClient(_Tokens())..dio.httpClientAdapter = transport;
    container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(client),
        survivalChatAccountProvider.overrideWith((ref) => ref.watch(_account)),
        connectivitySourceProvider.overrideWithValue(network),
        if (model != null) survivalLocalModelProvider.overrideWithValue(model),
        if (snapshot != null)
          survivalChatSnapshotProvider.overrideWith(
            (ref, selection) => snapshot(selection),
          ),
      ],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: ThemeData(splashFactory: InkRipple.splashFactory),
          home: const CamperAiAssistantScreen(),
        ),
      ),
    );
  }

  Future<void> send(WidgetTester tester) async {
    await tester.enterText(find.byType(TextField), question);
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pumpAndSettle();
  }

  Future<void> scrollToSource(
    WidgetTester tester,
    Finder button, {
    double delta = 160,
  }) async {
    await tester.scrollUntilVisible(
      button,
      delta,
      scrollable: find.descendant(
        of: find.byType(ListView),
        matching: find.byType(Scrollable),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> toggle(WidgetTester tester, Finder button) async {
    await scrollToSource(tester, button);
    final visibleButton = button.hitTestable();
    expect(visibleButton, findsOneWidget);
    await tester.tap(visibleButton);
    await tester.pumpAndSettle();
  }

  testWidgets(
    'uses authenticated API, disables duplicate sends and keeps source metadata',
    (tester) async {
      await open(tester);
      await send(tester);
      expect(transport.requests.single.path, '/ai/answers');
      expect(
        transport.requests.single.headers['Authorization'],
        'Bearer camper-access-token',
      );
      expect(
        transport.requests.single.data,
        containsPair('question', question),
      );
      expect(find.text('Đang tìm hướng dẫn…'), findsOneWidget);
      expect(
        tester
            .widget<IconButton>(
              find.widgetWithIcon(IconButton, Icons.send_rounded),
            )
            .onPressed,
        isNull,
      );
      expect(transport.requests, hasLength(1));
      transport.reply(0, answered);
      await tester.pumpAndSettle();
      expect(find.text(answerText), findsOneWidget);
      expect(find.text('Đang tìm hướng dẫn…'), findsNothing);
      final turn = container.read(survivalChatControllerProvider).single;
      expect(turn.answer?.id, 'answer-identifier');
      expect(turn.answer?.sources.single.locations.single.page, 1);
      final button = find.text('Nguồn tham khảo (1)');
      expect(find.text('Kỹ năng đọc bản đồ'), findsNothing);
      await toggle(tester, button);
      expect(find.text('Kỹ năng đọc bản đồ'), findsOneWidget);
      expect(find.text('Phiên bản 2 · Trang 1'), findsOneWidget);
      await toggle(tester, button);
      expect(find.text('Kỹ năng đọc bản đồ'), findsNothing);
      expect(transport.requests, hasLength(1));
    },
  );

  testWidgets('groups cited pages by document and exact version', (
    tester,
  ) async {
    await open(tester);
    await send(tester);
    transport.reply(0, {
      ...answered,
      'sources': [
        source,
        {
          ...source,
          'chunkId': '00000000-0000-4000-8000-000000000005',
          'chunkIndex': 1,
          'locations': [
            {'page': 3, 'itemRef': '#/texts/4'},
            {'page': 1, 'itemRef': '#/texts/1'},
          ],
        },
        {
          ...source,
          'documentVersionId': '00000000-0000-4000-8000-000000000006',
          'chunkSetId': '00000000-0000-4000-8000-000000000007',
          'chunkId': '00000000-0000-4000-8000-000000000008',
          'sourceVersion': 3,
        },
        {
          ...source,
          'documentId': '00000000-0000-4000-8000-000000000009',
          'documentVersionId': '00000000-0000-4000-8000-000000000010',
          'chunkSetId': '00000000-0000-4000-8000-000000000011',
          'chunkId': '00000000-0000-4000-8000-000000000012',
          'sourceVersion': 0,
          'locations': [
            {'page': -1, 'itemRef': '#/texts/0'},
            {'page': 9},
          ],
        },
        {...source, 'title': source['documentId']},
      ],
    });
    await tester.pumpAndSettle();
    await toggle(tester, find.text('Nguồn tham khảo (3)'));
    expect(find.text('Kỹ năng đọc bản đồ'), findsNWidgets(3));
    expect(find.text('Phiên bản 2 · Trang 1, 3'), findsOneWidget);
    expect(find.text('Phiên bản 3 · Trang 1'), findsOneWidget);
    expect(find.textContaining('Trang 9'), findsNothing);
    expect(find.text(source['documentId'] as String), findsNothing);
    expect(transport.requests, hasLength(1));
  });

  for (final entries in [
    null,
    [],
    [
      null,
      {'title': 'Hướng dẫn không xác định'},
    ],
  ]) {
    testWidgets('keeps the answer with unavailable source data ($entries)', (
      tester,
    ) async {
      await open(tester);
      await send(tester);
      transport.reply(0, {...answered, 'sources': entries});
      await tester.pumpAndSettle();
      expect(find.text(answerText), findsOneWidget);
      expect(find.text('Không có thông tin nguồn'), findsOneWidget);
      expect(find.textContaining('Nguồn tham khảo'), findsNothing);
      expect(transport.requests, hasLength(1));
    });
  }

  testWidgets('commits only a selected thumb and shows the chosen icon', (
    tester,
  ) async {
    await open(tester);
    await send(tester);
    transport.reply(0, answered);
    await tester.pumpAndSettle();
    final control = find.byKey(const ValueKey('ai-answer-rating'));
    await scrollToSource(tester, control);
    final turn = container.read(survivalChatControllerProvider).single;
    final queue = container.read(aiFeedbackQueueProvider)!;
    expect(queue.forTurn(turn), isNull);

    await tester.longPress(control);
    await tester.pumpAndSettle();
    expect(find.text('Hữu ích'), findsOneWidget);
    expect(find.text('Không hữu ích'), findsOneWidget);
    await tester.tapAt(const Offset(5, 5));
    await tester.pumpAndSettle();
    expect(queue.forTurn(turn), isNull);

    await tester.longPress(control);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Không hữu ích'));
    await tester.pumpAndSettle();
    expect(
      find.descendant(of: control, matching: find.byIcon(Icons.thumb_down)),
      findsOneWidget,
    );
    expect(find.byType(SnackBar), findsNothing);
    expect(find.text('Không hữu ích'), findsNothing);
    expect(
      queue.forTurn(turn)?.pending,
      containsPair('answerId', answered['answerId']),
    );
    expect(queue.forTurn(turn)?.pending?.containsKey('question'), isFalse);

    await tester.tap(control);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hữu ích'));
    await tester.pumpAndSettle();
    expect(
      find.descendant(of: control, matching: find.byIcon(Icons.thumb_up)),
      findsOneWidget,
    );
    expect(queue.forTurn(turn)?.revision, 2);
  });

  testWidgets('reports Unsafe independently with an empty reason', (
    tester,
  ) async {
    await open(tester);
    await send(tester);
    transport.reply(0, answered);
    await tester.pumpAndSettle();
    final options = find.byTooltip('Tùy chọn câu trả lời');
    await scrollToSource(tester, options);
    await tester.tap(options);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Báo cáo câu trả lời không an toàn'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gửi báo cáo'));
    await tester.pumpAndSettle();
    final turn = container.read(survivalChatControllerProvider).single;
    final entry = container.read(aiFeedbackQueueProvider)!.forTurn(turn)!;
    expect(entry.rating, isNull);
    expect(entry.pending, containsPair('reportedUnsafe', true));
    expect(entry.pending, containsPair('reason', null));
    expect(find.byType(SnackBar), findsNothing);
  });

  testWidgets('discloses Local trace before rating or reporting Unsafe', (
    tester,
  ) async {
    final model = _LocalModel();
    await open(tester, model: model);
    network.online = false;
    final controller = container.read(survivalChatControllerProvider.notifier);
    expect(controller.send('Nên xếp đồ vào ba lô thế nào?'), isTrue);
    await tester.pumpAndSettle();
    final turn = container.read(survivalChatControllerProvider).single;
    final queue = container.read(aiFeedbackQueueProvider)!;
    expect(queue.forTurn(turn), isNull);
    model.modelVersion = '2';

    final disclosure = find.text(
      'Khi gửi phản hồi, CTMS sẽ nhận câu hỏi, câu trả lời và thông tin kỹ thuật '
      'của lượt này (nếu có).',
    );
    final rating = find.byKey(const ValueKey('ai-answer-rating'));
    await scrollToSource(tester, rating);
    await tester.tap(rating);
    await tester.pumpAndSettle();
    expect(disclosure, findsOneWidget);
    expect(queue.forTurn(turn), isNull);
    await tester.tap(find.text('Không hữu ích'));
    await tester.pumpAndSettle();

    final options = find.byTooltip('Tùy chọn câu trả lời');
    await scrollToSource(tester, options);
    await tester.tap(options);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Báo cáo câu trả lời không an toàn'));
    await tester.pumpAndSettle();
    expect(disclosure, findsOneWidget);
    expect(queue.forTurn(turn)?.reportedUnsafe, isFalse);
    await tester.tap(find.text('Gửi báo cáo'));
    await tester.pumpAndSettle();

    expect(queue.forTurn(turn)?.pending, containsPair('reportedUnsafe', true));
    expect(queue.forTurn(turn)?.pending, containsPair('modelVersion', '1'));
    expect(
      queue.forTurn(turn)?.pending,
      containsPair('localAnswerId', turn.id),
    );
    expect(
      queue.forTurn(turn)?.pending,
      containsPair('localTrace', turn.answer!.localTrace!.toJson()),
    );
    expect(transport.requests, isEmpty);
  });

  testWidgets('validates empty and over-limit questions before the API', (
    tester,
  ) async {
    await open(tester);
    await tester.tap(find.byTooltip('Gửi câu hỏi'));
    await tester.pumpAndSettle();
    expect(find.text('Hãy nhập câu hỏi.'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'x' * 2001);
    await tester.tap(find.byTooltip('Gửi câu hỏi'));
    await tester.pumpAndSettle();
    expect(
      find.text('Nhập câu hỏi hợp lệ, tối đa 2.000 ký tự.'),
      findsOneWidget,
    );
    expect(transport.requests, isEmpty);
  });

  testWidgets(
    'uses the same path for quick prompts and renders insufficient knowledge',
    (tester) async {
      await open(tester);
      const prompt = 'Cần chuẩn bị gì cho cung Tà Năng 3 ngày?';
      await tester.tap(find.text(prompt));
      await tester.pumpAndSettle();
      expect(transport.requests.single.data, containsPair('question', prompt));
      transport.reply(0, {
        'status': 'INSUFFICIENT_CONTEXT',
        'answer': null,
        'sources': [],
      });
      await tester.pumpAndSettle();
      expect(find.textContaining('Chưa tìm thấy hướng dẫn'), findsOneWidget);
      expect(
        container.read(survivalChatControllerProvider).single.answer,
        isNull,
      );
    },
  );

  testWidgets(
    'retries after network failure with the same request id and one question bubble',
    (tester) async {
      await open(tester);
      await send(tester);
      transport.replies[0].completeError(
        DioException(
          type: DioExceptionType.connectionError,
          requestOptions: transport.requests[0],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Kiểm tra kết nối mạng rồi thử lại.'), findsOneWidget);
      await tester.tap(find.text('Thử lại'));
      await tester.pumpAndSettle();
      expect(transport.requests, hasLength(2));
      expect(transport.requests[0].data, transport.requests[1].data);
      transport.reply(1, answered);
      await tester.pumpAndSettle();
      expect(find.text(question), findsOneWidget);
      expect(find.text(answerText), findsOneWidget);
    },
  );

  testWidgets('ignores pending responses after disposing the chat', (
    tester,
  ) async {
    await open(tester);
    await send(tester);
    await tester.pumpWidget(const SizedBox());
    await tester.pumpAndSettle();
    transport.reply(0, answered);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('keeps turns across modes and does not send local history', (
    tester,
  ) async {
    final model = _LocalModel();
    await open(tester, model: model);
    await send(tester);
    transport.reply(0, answered);
    await tester.pumpAndSettle();
    network.online = false;
    final controller = container.read(survivalChatControllerProvider.notifier);
    expect(controller.send('Nên xếp đồ vào ba lô thế nào?'), isTrue);
    await tester.pumpAndSettle();
    expect(transport.requests, hasLength(1));
    expect(model.requests, 1);
    final turns = container.read(survivalChatControllerProvider);
    expect(turns.first.answer?.id, 'answer-identifier');
    expect(turns.first.answer?.localTrace, isNull);
    expect(turns.last.answer?.isLocal, isTrue);
    expect(turns.last.answer?.sources, isEmpty);
    expect(turns.last.answer?.localTrace?.path, 'PRETRAINED');
    expect(
      turns.last.answer?.localTrace?.observedAt,
      DateTime.utc(2026, 11, 16),
    );
    expect(
      turns.last.answer?.localTrace?.runtimeConfigVersion,
      localRuntimeConfigV1,
    );
    expect(turns.last.answer?.modelVersion, '1');
    expect(turns.last.answer?.packageId, isNull);
    expect(
      container.read(aiFeedbackQueueProvider)?.forTurn(turns.last),
      isNull,
    );
    expect(find.text('Gợi ý từ AI'), findsOneWidget);
    expect(find.text('Không có thông tin nguồn'), findsNothing);
    Finder sourcesFor(SurvivalChatTurn turn) => find.descendant(
      of: find.byKey(PageStorageKey(turn.id)),
      matching: find.text('Nguồn tham khảo (1)'),
    );

    final previousSources = sourcesFor(turns.first);
    await scrollToSource(tester, previousSources, delta: -160);
    await toggle(tester, previousSources);
    expect(find.text('Kỹ năng đọc bản đồ'), findsOneWidget);
    network.online = true;
    await send(tester);
    expect(transport.requests, hasLength(2));
    expect(transport.requests.last.data, containsPair('question', question));
    transport.reply(1, {
      ...answered,
      'answerId': 'another-answer',
      'sources': [
        {
          ...source,
          'documentId': '00000000-0000-4000-8000-000000000013',
          'documentVersionId': '00000000-0000-4000-8000-000000000014',
          'chunkSetId': '00000000-0000-4000-8000-000000000015',
          'chunkId': '00000000-0000-4000-8000-000000000016',
          'title': 'Hướng dẫn định hướng',
        },
      ],
    });
    await tester.pumpAndSettle();
    final latestSources = sourcesFor(
      container.read(survivalChatControllerProvider).last,
    );
    await scrollToSource(tester, previousSources, delta: -160);
    expect(find.text('Kỹ năng đọc bản đồ'), findsOneWidget);
    await toggle(tester, previousSources);
    expect(find.text('Kỹ năng đọc bản đồ'), findsNothing);

    await scrollToSource(tester, latestSources);
    expect(find.text('Hướng dẫn định hướng'), findsNothing);
    await toggle(tester, latestSources);
    expect(find.text('Hướng dẫn định hướng'), findsOneWidget);
    await scrollToSource(tester, previousSources, delta: -160);
    expect(find.text('Kỹ năng đọc bản đồ'), findsNothing);
    expect(transport.requests.map((item) => item.method), ['POST', 'POST']);
  });

  testWidgets(
    'an authorization denial prevents later offline use in that session',
    (tester) async {
      final model = _LocalModel();
      await open(tester, model: model);
      await send(tester);
      transport.reply(0, {'code': 'AI_FORBIDDEN'}, status: 403);
      await tester.pumpAndSettle();
      network.online = false;
      final controller = container.read(
        survivalChatControllerProvider.notifier,
      );
      expect(controller.send('Nên xếp đồ vào ba lô thế nào?'), isTrue);
      await tester.pumpAndSettle();
      expect(model.requests, 0);
      expect(transport.requests, hasLength(1));
      expect(
        container.read(survivalChatControllerProvider).last.answer,
        isNull,
      );
    },
  );

  testWidgets(
    'clears prior transcript and ignores a stale response on account change',
    (tester) async {
      await open(tester);
      await send(tester);
      transport.reply(0, answered);
      await tester.pumpAndSettle();
      await toggle(tester, find.text('Nguồn tham khảo (1)'));
      expect(find.text('Kỹ năng đọc bản đồ'), findsOneWidget);
      await send(tester);
      container.read(_account.notifier).state = 'camper-b';
      await tester.pumpAndSettle();
      transport.reply(1, answered);
      await tester.pumpAndSettle();
      expect(container.read(survivalChatControllerProvider), isEmpty);
      expect(find.text(answerText), findsNothing);
      expect(find.text('Kỹ năng đọc bản đồ'), findsNothing);
      expect(find.textContaining('Nguồn tham khảo'), findsNothing);
    },
  );

  testWidgets('prioritizes an emergency before either inference path', (
    tester,
  ) async {
    final model = _LocalModel();
    await open(tester, model: model);
    final controller = container.read(survivalChatControllerProvider.notifier);
    expect(controller.send('Bạn tôi bất tỉnh.'), isTrue);
    await tester.pumpAndSettle();
    expect(transport.requests, isEmpty);
    expect(model.requests, 0);
    expect(find.text('Xem vị trí hiện tại'), findsOneWidget);
  });

  testWidgets(
    'uses the selected snapshot only for its owner and exact version',
    (tester) async {
      const selection = (accountId: 'camper-a', tripId: 'trip-a', version: 2);
      const replacement = (accountId: 'camper-a', tripId: 'trip-a', version: 3);
      const packageId = '81fe4e3a-7758-4244-91ab-5b4987037179';
      const replacementId = 'c77b57b0-3454-4d41-beee-58eb3606028b';
      final reads = <OfflineTripSelection>[];
      final model = _LocalModel();
      await open(
        tester,
        model: model,
        snapshot: (requested) async {
          reads.add(requested);
          if (requested != selection && requested != replacement) return null;
          return OfflineTrip(
            route: [],
            checkpoints: [],
            guides: [],
            hazardSources: [],
            packageId: requested == selection ? packageId : replacementId,
          );
        },
      );
      network.online = false;
      final controller = container.read(
        survivalChatControllerProvider.notifier,
      );
      const question = 'Gói đã lưu có bao nhiêu điểm dừng?';
      expect(
        controller.send(
          question,
          trip: (accountId: 'camper-b', tripId: 'trip-a', version: 2),
        ),
        isFalse,
      );
      expect(controller.send(question, trip: selection), isTrue);
      await tester.pumpAndSettle();
      final turn = container.read(survivalChatControllerProvider).last;
      final answer = turn.answer;
      expect(answer?.snapshotVersion, 2);
      expect(answer?.packageId, packageId);
      expect(answer?.localTrace?.path, 'SAVED_TRIP_CHECKPOINT_COUNT');
      expect(answer?.localTrace?.observedAt.isUtc, isTrue);
      expect(answer?.localTrace?.runtimeConfigVersion, isNull);
      expect(answer?.modelVersion, isNull);
      expect(answer?.text, 'Trong gói đã lưu có 0 điểm dừng.');
      expect(find.textContaining('Nguồn tham khảo'), findsNothing);
      expect(find.text('Không có thông tin nguồn'), findsNothing);
      expect(
        controller.send(
          question,
          trip: (accountId: 'camper-a', tripId: 'trip-a', version: 1),
        ),
        isTrue,
      );
      await tester.pumpAndSettle();
      expect(
        container.read(survivalChatControllerProvider).last.answer,
        isNull,
      );

      final queue = container.read(aiFeedbackQueueProvider)!;
      await queue.commit(turn, rating: AiAnswerRating.notUseful);
      final pending = queue.forTurn(turn)?.pending;
      expect(pending, containsPair('packageId', packageId));
      expect(pending, containsPair('packageVersion', 2));
      expect(pending, containsPair('localTrace', answer!.localTrace!.toJson()));
      expect(controller.send(question, trip: replacement), isTrue);
      await tester.pumpAndSettle();
      final latest = container.read(survivalChatControllerProvider).last;
      expect(latest.answer?.packageId, replacementId);
      expect(queue.forTurn(latest), isNull);
      expect(queue.forTurn(turn)?.pending, pending);
      expect(reads.map((item) => item.version), [2, 1, 3]);
      expect(model.requests, 0);
      expect(transport.requests, isEmpty);
    },
  );
}
