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
import 'package:mobile/features/camper/application/survival_chat_controller.dart';
import 'package:mobile/features/camper/presentation/camper_ai_assistant_screen.dart';

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
const answered = {
  'status': 'ANSWERED',
  'answerId': 'answer-identifier',
  'answer': answerText,
  'sources': [
    {
      'documentId': 'document-id',
      'documentVersionId': 'version-id',
      'sourceVersion': 2,
      'chunkSetId': 'chunk-set-id',
      'chunkId': 'chunk-id',
      'chunkIndex': 0,
      'title': 'Kỹ năng đọc bản đồ',
      'classification': 'TREKKING_SAFETY',
      'locale': 'vi',
      'locations': [
        {'page': 1, 'itemRef': '#/texts/0'},
      ],
    },
  ],
};

void main() {
  late _Transport transport;
  late ProviderContainer container;

  Future<void> open(WidgetTester tester) async {
    transport = _Transport();
    final client = ApiClient(_Tokens())..dio.httpClientAdapter = transport;
    container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(client)],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: CamperAiAssistantScreen()),
      ),
    );
  }

  Future<void> send(WidgetTester tester) async {
    await tester.enterText(find.byType(TextField), question);
    await tester.testTextInput.receiveAction(TextInputAction.send);
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
    },
  );

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
}
