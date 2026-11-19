@TestOn('chrome')
library;

import 'dart:ui_web' as ui_web;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/camper/presentation/widgets/survival_chat_input.dart';
import 'package:web/web.dart' as web;

void main() {
  late TextEditingController controller;
  late List<String> changes;
  late List<String> submissions;

  setUp(() {
    controller = TextEditingController();
    changes = [];
    submissions = [];
  });

  tearDown(() {
    controller.dispose();
  });

  Future<web.HTMLInputElement> open(
    WidgetTester tester, {
    String? error,
    TextEditingController? replacement,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 320,
              child: SurvivalChatInput(
                controller: replacement ?? controller,
                errorText: error,
                onChanged: changes.add,
                onSubmitted: submissions.add,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final surface = tester.widget<PlatformViewSurface>(
      find.byType(PlatformViewSurface),
    );
    return ui_web.platformViewRegistry.getViewById(surface.controller.viewId)
        as web.HTMLInputElement;
  }

  void type(web.HTMLInputElement input, String text) {
    input.value = text;
    input.setSelectionRange(text.length, text.length);
    input.dispatchEvent(web.Event('input'));
  }

  testWidgets(
    'iOS web uses an enabled browser input with a text keyboard',
    (tester) async {
      final input = await open(tester);
      expect(input.type, 'text');
      expect(input.disabled, isFalse);
      expect(input.readOnly, isFalse);
      expect(input.getAttribute('inputmode'), 'text');
      expect(input.getAttribute('enterkeyhint'), 'send');
      expect(
        input.getAttribute('aria-label'),
        'Nhập câu hỏi cho trợ lý sinh tồn',
      );
      expect(
        double.parse(input.style.fontSize.replaceAll('px', '')),
        greaterThanOrEqualTo(16),
      );
      expect(find.byType(TextField), findsNothing);
      expect(tester.getSize(find.byType(HtmlElementView)).height, 48);

      // The DOM field remains the same across focus changes and validation.
      input.dispatchEvent(web.Event('focus'));
      await tester.pumpAndSettle();
      expect(await open(tester, error: 'Hãy nhập câu hỏi.'), same(input));
      expect(input.getAttribute('aria-invalid'), 'true');
      expect(find.text('Hãy nhập câu hỏi.'), findsOneWidget);
    },
    variant: TargetPlatformVariant.only(TargetPlatform.iOS),
  );

  testWidgets(
    'browser typing, send and clearing share the chat controller',
    (tester) async {
      final input = await open(tester);
      const question = 'Làm sao đọc bản đồ khi đi trong rừng?';
      type(input, question);
      expect(controller.text, question);
      expect(changes, [question]);
      input.dispatchEvent(
        web.KeyboardEvent('keydown', web.KeyboardEventInit(key: 'Enter')),
      );
      expect(submissions, [question]);

      controller.clear();
      expect(input.value, isEmpty);
      expect(changes, [question]);
    },
    variant: TargetPlatformVariant.only(TargetPlatform.iOS),
  );

  testWidgets(
    'Vietnamese composition cannot accidentally submit a question',
    (tester) async {
      final input = await open(tester);
      input.dispatchEvent(web.Event('compositionstart'));
      type(input, 'đường');
      input.dispatchEvent(
        web.KeyboardEvent('keydown', web.KeyboardEventInit(key: 'Enter')),
      );
      expect(submissions, isEmpty);
      input.dispatchEvent(web.Event('compositionend'));
      input.dispatchEvent(
        web.KeyboardEvent(
          'keydown',
          web.KeyboardEventInit(key: 'Enter', isComposing: true),
        ),
      );
      expect(submissions, isEmpty);
      input.dispatchEvent(
        web.KeyboardEvent('keydown', web.KeyboardEventInit(key: 'Enter')),
      );
      expect(submissions, ['đường']);
    },
    variant: TargetPlatformVariant.only(TargetPlatform.iOS),
  );

  testWidgets(
    'account draft resets and controller replacement update the DOM',
    (tester) async {
      final input = await open(tester);
      type(input, 'Câu hỏi chưa gửi');
      final next = TextEditingController(text: 'Câu hỏi mới');
      addTearDown(next.dispose);
      expect(await open(tester, replacement: next), same(input));
      expect(input.value, 'Câu hỏi mới');
      controller.text = 'Nội dung cũ';
      expect(input.value, 'Câu hỏi mới');
      next.clear();
      expect(input.value, isEmpty);

      await tester.pumpWidget(const SizedBox.shrink());
      type(input, 'Không gửi sau khi rời màn hình');
      expect(next.text, isEmpty);
      expect(changes, ['Câu hỏi chưa gửi']);
    },
    variant: TargetPlatformVariant.only(TargetPlatform.iOS),
  );

  testWidgets(
    'other web platforms retain the Flutter text field',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SurvivalChatInput(
              controller: controller,
              onChanged: changes.add,
              onSubmitted: submissions.add,
            ),
          ),
        ),
      );
      expect(find.byType(TextField), findsOneWidget);
      expect(find.byType(HtmlElementView), findsNothing);
    },
    variant: TargetPlatformVariant.only(TargetPlatform.android),
  );
}
