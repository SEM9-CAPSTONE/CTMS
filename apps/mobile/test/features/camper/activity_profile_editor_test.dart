import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/camper/profile/domain/activity_profile.dart';
import 'package:mobile/features/camper/profile/domain/health_profile.dart';
import 'package:mobile/features/camper/presentation/widgets/activity_profile_editor.dart';

void main() {
  testWidgets('edits activity facts without a separate confirmation step', (
    tester,
  ) async {
    ActivityProfile? value;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: Form(
              child: ActivityProfileEditor(
                enabled: true,
                onChanged: (profile) {
                  value = profile;
                },
              ),
            ),
          ),
        ),
      ),
    );
    await tester.enterText(
      find.widgetWithText(
        TextFormField,
        'Quãng đường đi bộ quen thuộc (km/ngày)',
      ),
      '4,5',
    );
    expect(value?.comfortableDistanceKm, 4.5);
    expect(value?.comfortableWalkingMinutes, isNull);
    expect(find.text('Số ngày vận động mỗi tuần'), findsNothing);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Lưu ý khi vận động'),
      'Tránh mang ba lô nặng',
    );
    expect(value?.activityNotes, 'Tránh mang ba lô nặng');
    await tester.enterText(
      find.widgetWithText(
        TextFormField,
        'Thời gian đi bộ quen thuộc (phút/ngày)',
      ),
      '0',
    );
    expect(value?.comfortableWalkingMinutes, 0);
    expect(find.byType(CheckboxListTile), findsNothing);
    expect(find.textContaining('Lần xác nhận'), findsNothing);
  });

  test(
    'serializes saved facts without a confirmation flag or client-written date',
    () {
      final activity = ActivityProfile.fromJson({
        'weeklyActiveDays': 3,
        'comfortableDistanceKm': 4,
        'comfortableWalkingMinutes': 120,
        'confirmedAt': '2026-11-19T00:00:00Z',
      });
      final payload = UpdateHealthProfileInput(
        bloodType: 'UNKNOWN',
        physicalFitnessLevel: 'INTERMEDIATE',
        allergies: [],
        medicalConditions: [],
        isConsentGranted: true,
        activityProfile: activity,
      ).toJson();
      final data = payload['activityProfile'] as Map<String, Object?>;
      expect(data['comfortableDistanceKm'], 4);
      expect(data.containsKey('confirmCurrent'), isFalse);
      expect(data.containsKey('confirmedAt'), isFalse);
      expect(data.containsKey('weeklyActiveDays'), isFalse);
      expect(data.containsKey('mobilityLimitations'), isFalse);
      expect(data.containsKey('professionalAdvice'), isFalse);
    },
  );

  test('loads both old notes into one optional note without losing text', () {
    final profile = ActivityProfile.fromJson({
      'mobilityLimitations': 'Khó đi xuống dốc dài',
      'professionalAdvice': 'Tránh mang ba lô nặng',
    });
    expect(
      profile.activityNotes,
      'Khó đi xuống dốc dài\n\nTránh mang ba lô nặng',
    );
    expect(profile.toInputJson()['activityNotes'], profile.activityNotes);
  });
}
