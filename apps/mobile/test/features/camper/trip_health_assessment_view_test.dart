import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/camper/domain/trip_health_assessment.dart';
import 'package:mobile/features/camper/presentation/widgets/trip_health_assessment_view.dart';

void main() {
  testWidgets(
    'shows assessed criteria and hides unknown criteria and summary',
    (tester) async {
      final assessment = TripHealthAssessment.fromJson({
        'status': 'insufficient_data',
        'summary': 'Chưa đủ thông tin để đánh giá.',
        'comparisons': [
          {
            'label': 'Thể lực và độ khó',
            'profileValue': 'Trung bình',
            'tripValue': 'Dễ',
            'detail': 'Độ khó trong mức bạn khai báo.',
            'result': 'match',
          },
          {
            'label': 'Thời gian đi bộ',
            'profileValue': 'Chưa khai báo',
            'tripValue': '120 phút',
            'detail': 'Chưa thể đối chiếu.',
            'result': 'unknown',
          },
        ],
        'missingInformation': ['Bạn chưa khai báo thời gian đi bộ.'],
      });
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TripHealthAssessmentView(assessment: assessment),
          ),
        ),
      );
      expect(find.text('Thể lực và độ khó · Phù hợp'), findsOneWidget);
      expect(find.text('Thời gian đi bộ'), findsNothing);
      expect(find.text('Độ khó trong mức bạn khai báo.'), findsNothing);
      expect(find.text(assessment.summary), findsNothing);
      expect(find.text('Thông tin cần bổ sung'), findsNothing);
    },
  );

  test('missing comparison result remains unknown', () {
    final comparison = HealthComparison.fromJson({
      'label': 'Độ khó',
      'profileValue': 'Trung bình',
      'tripValue': 'Chưa có thông tin',
      'detail': 'Chưa thể đối chiếu.',
    });
    expect(comparison.result, 'unknown');
  });
}
