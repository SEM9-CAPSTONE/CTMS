import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/trip_reviews/domain/review_models.dart';
import 'package:mobile/features/trip_reviews/presentation/review_form.dart';

void main() {
  const saved = SavedReview(
    id: 'review',
    target: ReviewTarget.trip,
    rating: 4,
    comment: 'Original',
    revision: 1,
  );
  testWidgets(
    'saved review requires explicit edit and cancel restores content',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ReviewForm(
                target: ReviewTarget.trip,
                saved: saved,
                enabled: true,
                saving: false,
                onUpload: (_) async => 'unused',
                onSave: (_, _, _) async => true,
              ),
            ),
          ),
        ),
      );
      expect(find.byType(TextField), findsNothing);
      await tester.tap(find.text('Chỉnh sửa'));
      await tester.pump();
      expect(find.byType(TextField), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Draft');
      await tester.ensureVisible(find.text('Hủy'));
      await tester.tap(find.text('Hủy'));
      await tester.pump();
      expect(find.text('Original'), findsOneWidget);
      expect(find.text('Draft'), findsNothing);
      expect(find.byType(TextField), findsNothing);
    },
  );
  testWidgets('expired review has no edit action', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ReviewForm(
            target: ReviewTarget.trip,
            saved: saved,
            enabled: false,
            saving: false,
            onUpload: (_) async => 'unused',
            onSave: (_, _, _) async => true,
          ),
        ),
      ),
    );
    expect(find.text('Chỉnh sửa'), findsNothing);
    expect(find.text('Original'), findsOneWidget);
  });
}
