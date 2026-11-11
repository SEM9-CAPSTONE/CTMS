import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/member_locations/application/member_locations_controller.dart';
import 'package:mobile/features/member_locations/data/member_locations_api.dart';
import 'package:mobile/features/member_locations/presentation/porter_member_locations_panel.dart';

const tripId = '66666666-6666-4666-8666-666666666666';
final now = DateTime.utc(2026, 11, 7, 3, 12);
String ago(int seconds) =>
    now.subtract(Duration(seconds: seconds)).toIso8601String();

Map<String, Object?> member({
  required String id,
  String? name,
  String role = 'camper',
  String? memberStatus = 'joined',
  int? seenSecondsAgo = 30,
  String? routeType,
  String? gpsType,
  String? checkpointName,
  String? behindStatus,
  int? lagMinutes,
}) => {
  'id': id,
  'userId': id,
  'name': name,
  'role': role,
  'memberStatus': memberStatus,
  'location': seenSecondsAgo == null
      ? null
      : {
          'id': 'g-$id',
          'latitude': 16.04,
          'longitude': 108.2,
          'accuracyMeters': 8,
          'eventTime': ago(seenSecondsAgo),
          'receivedAt': ago(seenSecondsAgo),
        },
  'lastSeenAt': seenSecondsAgo == null ? null : ago(seenSecondsAgo),
  'lastSyncedAt': seenSecondsAgo == null ? null : ago(seenSecondsAgo),
  'freshness': 'fresh',
  'locationAgeSeconds': seenSecondsAgo,
  'safety': {
    'route': routeType == null
        ? null
        : {'type': routeType, 'eventTime': ago(60), 'receivedAt': ago(50)},
    'gps': gpsType == null
        ? null
        : {'type': gpsType, 'eventTime': ago(60), 'receivedAt': ago(50)},
    'lastCheckpoint': checkpointName == null
        ? null
        : {
            'checkpointId': 'cp',
            'checkpointName': checkpointName,
            'arrivedAt': ago(1200),
            'receivedAt': ago(1190),
          },
    'behindSchedule': behindStatus == null
        ? null
        : {
            'status': behindStatus,
            'lagMinutes': lagMinutes,
            'reference': null,
            'safeCheckpoint': null,
            'evaluatedAt': now.toIso8601String(),
          },
  },
};

TripMemberLocations locations(List<Map<String, Object?>> members) =>
    TripMemberLocations.fromJson({
      'tripId': tripId,
      'tripStatus': 'ongoing',
      'viewer': 'porter',
      'generatedAt': now.toIso8601String(),
      'locationSource': 'server_confirmed',
      'freshnessMaxAgeSeconds': 120,
      'members': members,
    });

class FakeMemberLocationsApi implements MemberLocationsApi {
  final responses = <FutureOr<TripMemberLocations> Function()>[];
  int calls = 0;

  @override
  Future<TripMemberLocations> fetch(String tripId) async {
    final next =
        responses[calls < responses.length ? calls : responses.length - 1];
    calls++;
    return next();
  }
}

void main() {
  late FakeMemberLocationsApi api;

  setUp(() => api = FakeMemberLocationsApi());

  Future<MemberLocationsController> pump(
    WidgetTester tester, {
    DateTime Function()? clock,
  }) async {
    final controller = MemberLocationsController(
      tripId: tripId,
      api: api,
      refreshInterval: const Duration(hours: 1),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          memberLocationsControllerProvider.overrideWith(
            (ref, id) => controller,
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: SingleChildScrollView(
              child: PorterMemberLocationsPanel(
                tripId: tripId,
                clock: clock ?? () => now,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    return controller;
  }

  double topOf(WidgetTester tester, String id) =>
      tester.getTopLeft(find.byKey(Key('member-location-$id'))).dy;

  group('PorterMemberLocationsPanel (CTMS-066-T02)', () {
    testWidgets('loading state says the data is not live', (tester) async {
      final pending = Completer<TripMemberLocations>();
      api.responses.add(() => pending.future);

      await pump(tester);

      expect(find.text('Đang tải vị trí thành viên…'), findsOneWidget);
      expect(
        find.text(
          'Vị trí server đã nhận gần nhất, không phải vị trí trực tiếp.',
        ),
        findsOneWidget,
      );
      pending.complete(locations([]));
      await tester.pump();
    });

    testWidgets(
      'orders warnings, stale, no data, fresh and shows last seen, coordinates and flags',
      (tester) async {
        api.responses.add(
          () => locations([
            member(id: 'a', name: 'An Mới'),
            member(
              id: 'p',
              name: 'Porter Cũ',
              role: 'porter',
              memberStatus: null,
              seenSecondsAgo: 900,
            ),
            member(id: 'n', name: 'Nam Chưa', seenSecondsAgo: null),
            member(
              id: 'b',
              name: 'Bình Lệch',
              routeType: 'OFF_ROUTE',
              checkpointName: 'Đèo Gió',
              behindStatus: 'SEVERELY_BEHIND',
              lagMinutes: 65,
            ),
          ]),
        );

        await pump(tester);

        expect(topOf(tester, 'b'), lessThan(topOf(tester, 'p')));
        expect(topOf(tester, 'p'), lessThan(topOf(tester, 'n')));
        expect(topOf(tester, 'n'), lessThan(topOf(tester, 'a')));

        expect(
          find.byKey(const Key('member-freshness-b-fresh')),
          findsOneWidget,
        );
        expect(
          find.byKey(const Key('member-freshness-p-stale')),
          findsOneWidget,
        );
        expect(
          find.byKey(const Key('member-freshness-n-unavailable')),
          findsOneWidget,
        );
        expect(find.text('Lệch tuyến'), findsOneWidget);
        expect(find.text('Chậm nghiêm trọng · 65 phút'), findsOneWidget);
        expect(
          find.textContaining('Checkpoint gần nhất: Đèo Gió'),
          findsOneWidget,
        );
        expect(find.textContaining('(15 phút trước)'), findsOneWidget);
        expect(
          find.textContaining('16.04000, 108.20000 · ±8 m'),
          findsNWidgets(3),
        );
        expect(
          find.text('Server chưa nhận được vị trí nào của thành viên này.'),
          findsOneWidget,
        );
      },
    );

    testWidgets('a future capture is never fresh and left members are marked', (
      tester,
    ) async {
      api.responses.add(
        () => locations([
          member(
            id: 'f',
            name: 'Lan',
            seenSecondsAgo: -120,
            memberStatus: 'left',
          ),
        ]),
      );

      await pump(tester);

      expect(find.byKey(const Key('member-freshness-f-stale')), findsOneWidget);
      expect(find.text('Đã rời đoàn'), findsOneWidget);
    });

    testWidgets('a fresh position turns stale as the clock moves', (
      tester,
    ) async {
      var clock = now;
      api.responses.add(
        () => locations([member(id: 'a', seenSecondsAgo: 100)]),
      );

      await pump(tester, clock: () => clock);
      expect(find.byKey(const Key('member-freshness-a-fresh')), findsOneWidget);

      clock = now.add(const Duration(seconds: 30));
      await tester.pump(const Duration(seconds: 15));
      expect(find.byKey(const Key('member-freshness-a-stale')), findsOneWidget);
    });

    testWidgets('empty state', (tester) async {
      api.responses.add(() => locations([]));
      await pump(tester);
      expect(
        find.text('Chuyến đi chưa có thành viên nào để theo dõi.'),
        findsOneWidget,
      );
    });

    testWidgets('restricted state for 403/404', (tester) async {
      api.responses.add(() => throw ApiException('forbidden', statusCode: 404));
      await pump(tester);
      expect(
        find.byKey(const Key('member-locations-restricted')),
        findsOneWidget,
      );
    });

    testWidgets('Trip not ongoing for 409', (tester) async {
      api.responses.add(() => throw ApiException('conflict', statusCode: 409));
      await pump(tester);
      expect(
        find.text('Chỉ theo dõi vị trí khi chuyến đi đang diễn ra.'),
        findsOneWidget,
      );
    });

    testWidgets('error then retry', (tester) async {
      api.responses
        ..add(() => throw ApiException('down', statusCode: 503))
        ..add(() => locations([member(id: 'a', name: 'An')]));

      await pump(tester);
      expect(find.text('Không tải được vị trí thành viên'), findsOneWidget);

      await tester.tap(find.text('Thử lại'));
      await tester.pump();
      await tester.pump();
      expect(find.textContaining('An · Camper'), findsOneWidget);
    });

    testWidgets('a failed refresh keeps the last data marked as stale', (
      tester,
    ) async {
      api.responses
        ..add(() => locations([member(id: 'a', name: 'An')]))
        ..add(() => throw ApiException('offline'));

      final controller = await pump(tester);
      await controller.refresh();
      await tester.pump();

      expect(find.byKey(const Key('member-locations-stale')), findsOneWidget);
      expect(find.textContaining('An · Camper'), findsOneWidget);
    });
  });
}
