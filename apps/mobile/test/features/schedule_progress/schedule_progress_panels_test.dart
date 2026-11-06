import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/schedule_progress/application/schedule_progress_controller.dart';
import 'package:mobile/features/schedule_progress/data/schedule_progress_api.dart';
import 'package:mobile/features/schedule_progress/presentation/schedule_progress_panels.dart';

const tripId = '44444444-4444-4444-8444-444444444444';

Map<String, Object?> member({
  required String userId,
  String? fullName,
  String status = 'ON_TRACK',
  bool withReference = true,
  int? lagMinutes,
  String? safeName,
  String? guidance,
}) => {
  'userId': userId,
  'fullName': fullName,
  'status': status,
  'reference': withReference
      ? {
          'checkpointId': 'cp',
          'checkpointName': 'Đèo Gió',
          'porterArrivedAt': '2026-11-07T02:00:00.000Z',
        }
      : null,
  'lagMinutes': lagMinutes,
  'safeCheckpoint': safeName == null
      ? null
      : {'id': 's', 'name': safeName, 'type': 'rest'},
  'guidance': guidance,
  'lastValidSampleAt': '2026-11-07T03:10:00.000Z',
  'levelsReached': <String>[],
};

ScheduleProgress progress(
  List<Map<String, Object?>> members, {
  String tripStatus = 'ongoing',
}) => ScheduleProgress.fromJson({
  'tripId': tripId,
  'tripStatus': tripStatus,
  'evaluatedAt': '2026-11-07T03:12:00.000Z',
  'viewer': 'camper',
  'configVersion': 'v3',
  'thresholds': {
    'behindLagMinutes': 30,
    'severelyBehindLagMinutes': 60,
    'locationUnknownAfterMinutes': 5,
  },
  'members': members,
});

class FakeScheduleProgressApi implements ScheduleProgressApi {
  final responses = <FutureOr<ScheduleProgress> Function()>[];
  int calls = 0;

  @override
  Future<ScheduleProgress> fetch(String tripId) async {
    final next =
        responses[calls < responses.length ? calls : responses.length - 1];
    calls++;
    return next();
  }
}

void main() {
  late FakeScheduleProgressApi api;

  setUp(() => api = FakeScheduleProgressApi());

  Future<ScheduleProgressController> pump(
    WidgetTester tester,
    Widget panel,
  ) async {
    final controller = ScheduleProgressController(
      tripId: tripId,
      api: api,
      refreshInterval: const Duration(hours: 1),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          scheduleProgressControllerProvider.overrideWith(
            (ref, id) => controller,
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(body: SingleChildScrollView(child: panel)),
        ),
      ),
    );
    await tester.pump();
    return controller;
  }

  group('CamperScheduleProgressPanel (CTMS-063-T02)', () {
    testWidgets('shows a loading state before the first evaluation', (
      tester,
    ) async {
      final pending = Completer<ScheduleProgress>();
      api.responses.add(() => pending.future);

      await pump(tester, const CamperScheduleProgressPanel(tripId: tripId));

      expect(find.text('Đang tải tiến độ…'), findsOneWidget);
      pending.complete(progress([]));
      await tester.pump();
    });

    testWidgets('normal state: on track with the Porter reference', (
      tester,
    ) async {
      api.responses.add(() => progress([member(userId: 'me')]));

      await pump(tester, const CamperScheduleProgressPanel(tripId: tripId));

      expect(find.byKey(const Key('camper-schedule-onTrack')), findsOneWidget);
      expect(find.text('Theo kịp đoàn'), findsOneWidget);
      expect(find.textContaining('Porter đã tới Đèo Gió'), findsOneWidget);
    });

    testWidgets(
      'warning state: BEHIND shows the server guidance and safe checkpoint verbatim',
      (tester) async {
        const guidance =
            'Bạn đang chậm hơn đoàn khoảng 35 phút (Porter đã tới Đèo Gió).';
        api.responses.add(
          () => progress([
            member(
              userId: 'me',
              status: 'BEHIND',
              lagMinutes: 35,
              safeName: 'Trạm nghỉ suối',
              guidance: guidance,
            ),
          ]),
        );

        await pump(tester, const CamperScheduleProgressPanel(tripId: tripId));

        expect(find.byKey(const Key('camper-schedule-behind')), findsOneWidget);
        expect(find.text('Bạn đang chậm hơn đoàn'), findsOneWidget);
        expect(find.textContaining(guidance), findsOneWidget);
        expect(
          find.textContaining('Điểm an toàn: Trạm nghỉ suối'),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'warning state: SEVERELY_BEHIND without a safe checkpoint uses the fallback',
      (tester) async {
        api.responses.add(
          () => progress([
            member(
              userId: 'me',
              status: 'SEVERELY_BEHIND',
              lagMinutes: 70,
              guidance:
                  'Không có checkpoint an toàn gần đây. Dừng ở nơi an toàn, giữ liên lạc với Porter.',
            ),
          ]),
        );

        await pump(tester, const CamperScheduleProgressPanel(tripId: tripId));

        expect(
          find.byKey(const Key('camper-schedule-severelyBehind')),
          findsOneWidget,
        );
        expect(find.text('Bạn đã tụt lại xa sau đoàn'), findsOneWidget);
        expect(
          find.textContaining('không có checkpoint an toàn gần đây'),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'unavailable state: location unknown is never shown as behind',
      (tester) async {
        api.responses.add(
          () => progress([
            member(
              userId: 'me',
              status: 'LOCATION_UNKNOWN',
              guidance: 'Không xác định được vị trí của bạn.',
            ),
          ]),
        );

        await pump(tester, const CamperScheduleProgressPanel(tripId: tripId));

        expect(
          find.byKey(const Key('camper-schedule-locationUnknown')),
          findsOneWidget,
        );
        expect(find.text('Chưa đánh giá được tiến độ'), findsOneWidget);
        expect(find.textContaining('chậm hơn đoàn'), findsNothing);
      },
    );

    testWidgets('unavailable state: Trip not running', (tester) async {
      api.responses.add(() => progress([], tripStatus: 'completed'));

      await pump(tester, const CamperScheduleProgressPanel(tripId: tripId));

      expect(
        find.text('Chỉ theo dõi tiến độ khi chuyến đi đang diễn ra.'),
        findsOneWidget,
      );
    });

    testWidgets('error state: first load fails, retry loads the evaluation', (
      tester,
    ) async {
      api.responses
        ..add(() => throw Exception('offline'))
        ..add(() => progress([member(userId: 'me')]));

      await pump(tester, const CamperScheduleProgressPanel(tripId: tripId));
      expect(find.text('Không tải được tiến độ'), findsOneWidget);

      await tester.tap(find.text('Thử lại'));
      await tester.pump();
      await tester.pump();

      expect(find.text('Theo kịp đoàn'), findsOneWidget);
    });

    testWidgets(
      'a failed refresh keeps the last evaluation, labelled as stale',
      (tester) async {
        api.responses
          ..add(
            () => progress([
              member(
                userId: 'me',
                status: 'BEHIND',
                lagMinutes: 31,
                safeName: 'Trạm nghỉ suối',
              ),
            ]),
          )
          ..add(() => throw Exception('offline'));

        final controller = await pump(
          tester,
          const CamperScheduleProgressPanel(tripId: tripId),
        );
        await controller.refresh();
        await tester.pump();

        expect(
          find.byKey(const Key('schedule-progress-stale')),
          findsOneWidget,
        );
        expect(find.text('Bạn đang chậm hơn đoàn'), findsOneWidget);
      },
    );
  });

  group('PorterTeamProgressPanel (CTMS-063-T02)', () {
    testWidgets(
      'lists every Camper most urgent first with lag and safe checkpoint',
      (tester) async {
        api.responses.add(
          () => progress([
            member(userId: 'a', fullName: 'An'),
            member(userId: 'c', fullName: 'Chi', status: 'LOCATION_UNKNOWN'),
            member(
              userId: 'b',
              fullName: 'Bình',
              status: 'SEVERELY_BEHIND',
              lagMinutes: 72,
              safeName: 'Lều trú',
            ),
            member(
              userId: 'd',
              fullName: 'Dũng',
              status: 'BEHIND',
              lagMinutes: 35,
              safeName: 'Lều trú',
            ),
          ]),
        );

        await pump(tester, const PorterTeamProgressPanel(tripId: tripId));

        final order = ['b', 'd', 'c', 'a']
            .map(
              (id) =>
                  tester.getTopLeft(find.byKey(Key('porter-member-$id'))).dy,
            )
            .toList();
        expect(order, [...order]..sort());
        expect(find.text('Chậm nghiêm trọng'), findsOneWidget);
        expect(find.textContaining('chậm 72 phút'), findsOneWidget);
        expect(find.textContaining('chậm 35 phút'), findsOneWidget);
        expect(find.text('Chưa rõ vị trí'), findsOneWidget);
        expect(find.textContaining('Điểm an toàn: Lều trú'), findsNWidgets(2));
      },
    );

    testWidgets('shows an empty state when no Camper has checked in', (
      tester,
    ) async {
      api.responses.add(() => progress([]));

      await pump(tester, const PorterTeamProgressPanel(tripId: tripId));

      expect(find.text('Chưa có Camper nào đã check-in.'), findsOneWidget);
    });
  });
}
