import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/gps_tracking/presentation/gps_tracking_panel.dart';
import 'package:mobile/features/member_locations/presentation/trip_member_locations_panel.dart';
import 'package:mobile/features/trip_operations/application/trip_operations_providers.dart';
import 'package:mobile/features/trip_operations/data/trip_operations_api.dart';
import 'package:mobile/features/trip_operations/domain/operational_trip.dart';
import 'package:mobile/features/trip_operations/presentation/porter_trips_screen.dart';
import 'porter_trip_test_support.dart';

const account = 'porter-account';

class WorkspaceApi implements TripOperationsApi {
  final statuses = {tripOne: 'published', tripTwo: 'ongoing'};
  Object? contextFailure;
  Object? listFailure;
  bool empty = false;
  final transitions = <String>[];

  @override
  Future<List<OperationalTrip>> assigned(String accountId) async {
    if (listFailure != null) throw listFailure!;
    if (empty) return [];
    // Deliberately stale: the workspace must follow lifecycle responses.
    return [
      for (final id in statuses.keys)
        OperationalTrip(
          id: id,
          title: id == tripOne
              ? 'Khám phá bán đảo Sơn Trà'
              : 'Ngắm biển từ đỉnh Bàn Cờ',
          status: id == tripOne
              ? OperationalTripStatus.published
              : OperationalTripStatus.ongoing,
          startsAt: '2026-11-21T01:00:00Z',
          endsAt: '2026-11-21T08:00:00Z',
        ),
    ];
  }

  TripLifecycle lifecycle(String id) => TripLifecycle.fromJson({
    'status': statuses[id],
    'canStart': statuses[id] == 'published',
    'canEnd': statuses[id] == 'ongoing',
  });

  @override
  Future<TripLifecycle> context(String accountId, String tripId) async {
    if (contextFailure != null) throw contextFailure!;
    return lifecycle(tripId);
  }

  @override
  Future<TripLifecycle> transition(
    String accountId,
    String tripId, {
    required bool start,
  }) async {
    transitions.add(tripId);
    statuses[tripId] = start ? 'ongoing' : 'completed';
    return lifecycle(tripId);
  }
}

Future<ProviderContainer> mountWorkspace(
  WidgetTester tester,
  WorkspaceApi api, {
  String? initialTripId,
  Map<String, RecordingGps>? gps,
}) async {
  final container = ProviderContainer(
    overrides: [
      porterOperationsAccountProvider.overrideWithValue(account),
      tripOperationsApiProvider.overrideWithValue(api),
      ...trackingOverrides(createdGps: gps),
    ],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(home: PorterTripsScreen(initialTripId: initialTripId)),
    ),
  );
  await tester.pumpAndSettle();
  return container;
}

Future<void> confirm(WidgetTester tester, String label) async {
  await tester.ensureVisible(find.text(label));
  await tester.pumpAndSettle();
  await tester.tap(find.text(label));
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(FilledButton, label));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('start and end control tracking inline despite stale trip list', (
    tester,
  ) async {
    final api = WorkspaceApi();
    final gps = <String, RecordingGps>{};
    await mountWorkspace(tester, api, initialTripId: tripOne, gps: gps);
    expect(find.byType(GpsTrackingPanel), findsNothing);
    await confirm(tester, 'Bắt đầu chuyến đi');
    expect(find.byType(TripMemberLocationsPanel), findsOneWidget);
    // Build lazy children so disposal is verified for a real GPS controller.
    await tester.scrollUntilVisible(find.byType(GpsTrackingPanel), 400);
    await tester.pumpAndSettle();
    expect(gps[tripOne], isNotNull);
    await confirm(tester, 'Kết thúc chuyến đi');
    expect(find.byType(TripMemberLocationsPanel), findsNothing);
    expect(find.byType(GpsTrackingPanel), findsNothing);
    expect(gps[tripOne]!.wasDisposed, isTrue);
    expect(find.text('Đã kết thúc'), findsOneWidget);
    expect(api.transitions, [tripOne, tripOne]);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets(
    'one selector defaults to ongoing and switches all member details',
    (tester) async {
      await mountWorkspace(tester, WorkspaceApi());
      expect(find.byType(DropdownButtonFormField<String>), findsOneWidget);
      expect(
        tester
            .widget<TripMemberLocationsPanel>(
              find.byType(TripMemberLocationsPanel),
            )
            .tripId,
        tripTwo,
      );
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('Khám phá bán đảo Sơn Trà').last);
      await tester.pumpAndSettle();
      expect(find.byType(TripMemberLocationsPanel), findsNothing);
      expect(find.text('Bắt đầu chuyến đi'), findsOneWidget);
      expect(find.textContaining(tripOne), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'transient refresh preserves tracking and revoked access removes it',
    (tester) async {
      final api = WorkspaceApi();
      final container = await mountWorkspace(tester, api);
      api.contextFailure = ApiException(
        'Offline',
        kind: ApiExceptionKind.network,
      );
      api.listFailure = ApiException('Offline', kind: ApiExceptionKind.network);
      container.invalidate(
        tripLifecycleProvider((accountId: account, tripId: tripTwo)),
      );
      container.invalidate(assignedOperationalTripsProvider(account));
      await tester.pumpAndSettle();
      expect(find.byType(TripMemberLocationsPanel), findsOneWidget);
      api.contextFailure = ApiException('Forbidden', statusCode: 403);
      container.invalidate(
        tripLifecycleProvider((accountId: account, tripId: tripTwo)),
      );
      await tester.pumpAndSettle();
      expect(find.byType(TripMemberLocationsPanel), findsNothing);
      expect(find.textContaining('Forbidden'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('empty assignments show an empty state', (tester) async {
    await mountWorkspace(tester, WorkspaceApi()..empty = true);
    expect(find.text('Chưa có chuyến đi được phân công'), findsOneWidget);
    expect(find.byType(DropdownButtonFormField<String>), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
