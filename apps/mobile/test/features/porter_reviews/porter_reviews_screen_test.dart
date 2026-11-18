import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/porter_reviews/application/porter_reviews_controller.dart';
import 'package:mobile/features/porter_reviews/presentation/porter_reviews_screen.dart';
import 'package:mobile/features/porter_reviews/porter_review_strings.dart';
import 'porter_review_fakes.dart';

void main() {
  Future<PorterReviewsController> open(
    WidgetTester tester,
    FakePorterApi api, {
    bool select = true,
  }) async {
    final c = PorterReviewsController(api);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [porterReviewsProvider.overrideWith((ref) => c)],
        child: const MaterialApp(home: PorterReviewsScreen()),
      ),
    );
    await tester.pumpAndSettle();
    if (select) {
      await tester.tap(find.text('Khám phá bán đảo Sơn Trà'));
      await tester.pumpAndSettle();
    }
    return c;
  }

  testWidgets('shows empty participation state instead of fabricated trips', (
    tester,
  ) async {
    await open(tester, FakePorterApi()..trips = [], select: false);
    expect(find.text(PorterReviewStrings.noTrips), findsOneWidget);
  });
  testWidgets('provides a retry when the participation list cannot load', (
    tester,
  ) async {
    final api = FakePorterApi()..listFailure = Exception('offline');
    final c = await open(tester, api, select: false);
    expect(find.text(PorterReviewStrings.loadFailed), findsOneWidget);
    api.listFailure = null;
    await tester.tap(find.text(PorterReviewStrings.retry));
    await tester.pumpAndSettle();
    expect(find.text('Khám phá bán đảo Sơn Trà'), findsOneWidget);
    expect(c.participations!.items.length, 1);
  });
  testWidgets(
    'selects a named Porter and exposes accessible stars, Unicode counter and confirmed save',
    (tester) async {
      final api = FakePorterApi();
      await open(tester, api);
      expect(find.text('Nguyễn Minh Sơn'), findsOneWidget);
      expect(find.byType(DropdownButtonFormField<String>), findsNothing);
      expect(find.text(PorterReviewStrings.ratingLabel), findsOneWidget);
      expect(find.text(PorterReviewStrings.memoryOnly), findsNothing);
      final send = find.widgetWithText(
        ElevatedButton,
        PorterReviewStrings.save,
      );
      expect(tester.widget<ElevatedButton>(send).onPressed, isNull);
      await tester.tap(find.byTooltip(PorterReviewStrings.starAction(5)));
      await tester.enterText(
        find.byKey(const ValueKey('porter-review-comment')),
        'Cảm ơn 😊',
      );
      await tester.pump();
      expect(find.text('8/2000'), findsOneWidget);
      expect(find.text(PorterReviewStrings.memoryOnly), findsOneWidget);
      await tester.ensureVisible(find.text(PorterReviewStrings.save));
      await tester.tap(find.text(PorterReviewStrings.save));
      await tester.pumpAndSettle();
      expect(api.writes, 1);
      expect(find.text(PorterReviewStrings.saved), findsOneWidget);
      expect(find.text(PorterReviewStrings.memoryOnly), findsNothing);
    },
  );
  testWidgets('expired window is distinct and the saved review is read-only', (
    tester,
  ) async {
    await open(
      tester,
      FakePorterApi()..snapshot = reviewContext(saved: true, expired: true),
    );
    expect(find.text(PorterReviewStrings.expired), findsOneWidget);
    expect(find.text('Hỗ trợ chu đáo'), findsOneWidget);
    expect(find.text(PorterReviewStrings.edit), findsNothing);
  });
  testWidgets(
    'retained review remains named and editable after assignment removal',
    (tester) async {
      await open(
        tester,
        FakePorterApi()..snapshot = reviewContext(saved: true, assigned: false),
      );
      expect(find.text('Nguyễn Minh Sơn'), findsOneWidget);
      expect(find.text(PorterReviewStrings.assignmentRemoved), findsOneWidget);
      expect(find.text(PorterReviewStrings.noNewReviews), findsOneWidget);
      expect(
        find.textContaining('Bạn vẫn có thể sửa đánh giá đến '),
        findsOneWidget,
      );
      expect(find.text(PorterReviewStrings.edit), findsOneWidget);
    },
  );
  testWidgets(
    'stale revision exposes both current content and the preserved draft',
    (tester) async {
      final api = FakePorterApi()..snapshot = reviewContext(saved: true);
      await open(tester, api);
      await tester.ensureVisible(find.text(PorterReviewStrings.edit));
      await tester.tap(find.text(PorterReviewStrings.edit));
      await tester.pump();
      await tester.enterText(
        find.byKey(const ValueKey('porter-review-comment')),
        'Bản nháp của tôi',
      );
      await tester.pump();
      api.onWrite = () => api.snapshot = reviewContext(
        saved: true,
        revision: 2,
        comment: 'Bản mới trên máy chủ',
      );
      api.writeFailure = ApiException(
        'conflict',
        statusCode: 409,
        errorData: {'code': 'STALE_REVISION'},
      );
      await tester.ensureVisible(find.text(PorterReviewStrings.saveEdit));
      await tester.tap(find.text(PorterReviewStrings.saveEdit));
      await tester.pumpAndSettle();
      expect(find.text('Bản mới trên máy chủ'), findsOneWidget);
      expect(find.text(PorterReviewStrings.conflict), findsOneWidget);
      expect(find.byType(SnackBar), findsNothing);
      expect(find.text(PorterReviewStrings.keepDraft), findsOneWidget);
      expect(find.text('Bản nháp của tôi'), findsOneWidget);
    },
  );
}
