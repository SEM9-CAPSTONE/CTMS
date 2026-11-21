import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/member_locations/application/member_locations_controller.dart';
import 'package:mobile/features/member_locations/data/member_locations_api.dart';
import 'package:mobile/features/member_locations/presentation/camper_member_locations_panel.dart';
import 'package:mobile/features/offline_map/presentation/widgets/offline_map_canvas.dart';
import 'package:mobile/features/offline_map/presentation/widgets/synced_member_pin.dart';

const trip = '11111111-1111-4111-8111-111111111111';
const camper = '22222222-2222-4222-8222-222222222222';
final now = DateTime.utc(2026, 11, 21, 8);

Map<String, Object?> person(
  String id,
  String? name, {
  String? routeType,
  double? distanceMeters,
  int? age = 30,
  bool porter = false,
}) => {
  'id': id,
  'name': name,
  'role': porter ? 'porter' : 'camper',
  'memberStatus': porter ? null : 'joined',
  'location': age == null
      ? null
      : {
          'latitude': 16.04,
          'longitude': 108.2,
          'accuracyMeters': 8,
          'eventTime': now.subtract(Duration(seconds: age)).toIso8601String(),
        },
  'lastSeenAt': age == null
      ? null
      : now.subtract(Duration(seconds: age)).toIso8601String(),
  'lastSyncedAt': now.toIso8601String(),
  'safety': {
    'route': routeType == null
        ? null
        : {
            'type': routeType,
            'eventTime': now.toIso8601String(),
            'distanceToRouteMeters': distanceMeters,
          },
  },
};

TripMemberLocations snapshot({String name = 'Trần Minh An'}) =>
    TripMemberLocations.fromJson({
      'generatedAt': now.toIso8601String(),
      'freshnessMaxAgeSeconds': 120,
      'route': {
        'id': 'route-internal',
        'geometry': {
          'type': 'LineString',
          'coordinates': [
            [108.2, 16.0],
            [108.2, 16.1],
          ],
        },
      },
      'members': [
        person(camper, name, routeType: 'OFF_ROUTE', distanceMeters: 65.4),
        person('old', 'Lê Thu Hà', routeType: 'ON_ROUTE_RECOVERED', age: 600),
        person('porter', 'Nguyễn Minh Sơn', porter: true),
        person('missing', null, age: null),
      ],
    });

class _Api implements MemberLocationsApi {
  Object? failure;
  int calls = 0;
  Completer<TripMemberLocations>? pending;
  TripMemberLocations value = snapshot();
  @override
  Future<TripMemberLocations> fetch(String tripId) async {
    calls++;
    if (failure != null) throw failure!;
    if (pending != null) return pending!.future;
    return value;
  }
}

void main() {
  test(
    'missing distance stays unknown and recovery does not show an off-route distance',
    () {
      final missing = MemberLocation.fromJson(
        person(camper, 'Trần Minh An', routeType: 'OFF_ROUTE'),
      );
      expect(missing.routeLabel, 'Lệch tuyến');
      expect(missing.routeDistanceMeters, isNull);
      final recovered = MemberLocation.fromJson(
        person(
          camper,
          'Trần Minh An',
          routeType: 'ON_ROUTE_RECOVERED',
          distanceMeters: 3,
        ),
      );
      expect(recovered.routeLabel, 'Đã trở lại tuyến');
    },
  );
  late _Api api;
  late MemberLocationsController controller;
  setUp(() => api = _Api());

  Future<void> mount(WidgetTester tester, {DateTime Function()? clock}) async {
    controller = MemberLocationsController(
      tripId: trip,
      api: api,
      refreshInterval: const Duration(hours: 1),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          memberLocationsControllerProvider(
            trip,
          ).overrideWith((ref) => controller),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: CamperMemberLocationsPanel(
                tripId: trip,
                clock: clock ?? () => now,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'shows peers, route flags, unknown state and stale positions without UUID labels',
    (tester) async {
      final semantics = tester.ensureSemantics();
      await mount(tester);
      expect(find.byType(SyncedMemberPin), findsNWidgets(3));
      expect(find.text('Trần Minh An'), findsOneWidget);
      expect(find.text('Nguyễn Minh Sơn'), findsOneWidget);
      expect(find.text('Lệch tuyến · 65 m'), findsOneWidget);
      expect(
        find.textContaining('Thành viên mất mạng có thể đã di chuyển'),
        findsNothing,
      );
      expect(find.text('Đã trở lại tuyến'), findsOneWidget);
      expect(find.text('Chưa có trạng thái tuyến'), findsNWidgets(2));
      expect(find.text('Vị trí cũ'), findsOneWidget);
      expect(find.text('Thành viên chưa có tên'), findsOneWidget);
      expect(find.textContaining(camper), findsNothing);
      expect(find.bySemanticsLabel(RegExp(camper)), findsNothing);
      semantics.dispose();
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'selecting a person focuses their server-confirmed map position',
    (tester) async {
      await mount(tester);
      final map = tester.state<OfflineMapCanvasState>(
        find.byType(OfflineMapCanvas),
      );
      final before = map.panOffset;
      final button = find
          .widgetWithText(TextButton, 'Xem vị trí trên sơ đồ')
          .first;
      await tester.ensureVisible(button);
      await tester.tap(button);
      await tester.pumpAndSettle();
      expect(map.panOffset, isNot(before));
      expect(find.text('Đang xem: Trần Minh An'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'network errors retain last-known data and freshness follows the clock',
    (tester) async {
      var clock = now;
      await mount(tester, clock: () => clock);
      api.failure = ApiException(
        'Internal network failure',
        kind: ApiExceptionKind.network,
      );
      await controller.refresh();
      clock = now.add(const Duration(minutes: 5));
      await tester.pump(const Duration(seconds: 16));
      expect(find.textContaining('Không cập nhật được.'), findsOneWidget);
      expect(find.byType(SyncedMemberPin), findsNWidgets(3));
      expect(find.text('Vị trí cũ'), findsNWidgets(3));
      expect(find.textContaining('Internal network'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  for (final status in [401, 403, 404, 409]) {
    testWidgets(
      'HTTP $status removes cached names and map after authorization or Trip changes',
      (tester) async {
        await mount(tester);
        api.failure = ApiException('Denied', statusCode: status);
        await controller.refresh();
        await tester.pumpAndSettle();
        expect(controller.data, isNull);
        expect(find.byType(OfflineMapCanvas), findsNothing);
        expect(find.text('Trần Minh An'), findsNothing);
        expect(find.text('Denied'), findsNothing);
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }

  test(
    'overlapping refreshes do not race and a disposed controller ignores late data',
    () async {
      final api = _Api()..pending = Completer<TripMemberLocations>();
      final controller = MemberLocationsController(
        tripId: trip,
        api: api,
        refreshInterval: const Duration(hours: 1),
      );
      await controller.refresh();
      expect(api.calls, 1);
      controller.dispose();
      api.pending!.complete(snapshot());
      await Future<void>.delayed(Duration.zero);
      expect(controller.data, isNull);
    },
  );

  testWidgets(
    'switching accounts replaces the cached projection and ignores the old response',
    (tester) async {
      final account = StateProvider<String>((ref) => 'first');
      final first = _Api()..pending = Completer<TripMemberLocations>();
      final second = _Api()..value = snapshot(name: 'Nguyễn Hoàng Long');
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            memberLocationsApiProvider.overrideWith(
              (ref) => ref.watch(account) == 'first' ? first : second,
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: CamperMemberLocationsPanel(
                  tripId: trip,
                  clock: () => now,
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      final container = ProviderScope.containerOf(
        tester.element(find.byType(CamperMemberLocationsPanel)),
      );
      container.read(account.notifier).state = 'second';
      await tester.pumpAndSettle();
      expect(find.text('Nguyễn Hoàng Long'), findsOneWidget);
      first.pending!.complete(snapshot());
      await tester.pumpAndSettle();
      expect(find.text('Trần Minh An'), findsNothing);
      expect(find.text('Nguyễn Hoàng Long'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
