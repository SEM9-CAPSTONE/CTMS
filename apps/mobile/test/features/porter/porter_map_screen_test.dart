import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/gps_tracking/application/gps_tracking_controller.dart';
import 'package:mobile/features/gps_tracking/presentation/porter_gps_tracking_section.dart';
import 'package:mobile/features/incidents/domain/trip_incident.dart';
import 'package:mobile/features/member_locations/application/member_locations_controller.dart';
import 'package:mobile/features/member_locations/data/member_locations_api.dart';
import 'package:mobile/features/offline_map/application/offline_map_controller.dart';
import 'package:mobile/features/offline_map/presentation/offline_map_panel.dart';
import 'package:mobile/features/porter/presentation/porter_map_screen.dart';
import 'package:mobile/features/schedule_progress/application/schedule_progress_controller.dart';
import 'package:mobile/features/schedule_progress/data/schedule_progress_api.dart';

import '../gps_tracking/gps_fakes.dart';

const kTrip1 = '11111111-1111-4111-8111-111111111111';
const kTrip2 = '22222222-2222-4222-8222-222222222222';

class FakeScheduleProgressApi implements ScheduleProgressApi {
  @override
  Future<ScheduleProgress> fetch(String tripId) async {
    return ScheduleProgress.fromJson({
      'tripId': tripId,
      'tripStatus': 'ongoing',
      'evaluatedAt': '2026-11-07T03:12:00.000Z',
      'viewer': 'porter',
      'configVersion': 'v3',
      'thresholds': {'behindMinutes': 30, 'severelyBehindMinutes': 60},
      'members': <Map<String, Object?>>[],
    });
  }
}

class FakeMemberLocationsApi implements MemberLocationsApi {
  @override
  Future<TripMemberLocations> fetch(String tripId) async {
    return TripMemberLocations(
      generatedAt: DateTime.utc(2026, 11, 7, 3, 12),
      freshnessMaxAgeSeconds: 300,
      members: const [],
    );
  }
}

void main() {
  GpsTrackingController createGpsController(String id) {
    return GpsTrackingController(
      tripId: id,
      api: FakeGpsTrackingApi(),
      store: MemoryGpsLogStore(),
      location: FakeLocationSource(),
      autoStart: false,
    );
  }

  OfflineMapController createMapController(String id) {
    return OfflineMapController(
      tripId: id,
      autoStart: false,
    );
  }

  Widget buildApp({
    required List<IncidentTrip> trips,
  }) {
    return ProviderScope(
      overrides: [
        porterOngoingTripsProvider.overrideWith((ref) async => trips),
        gpsTrackingControllerProvider.overrideWith((ref, id) => createGpsController(id)),
        offlineMapControllerProvider.overrideWith((ref, id) => createMapController(id)),
        scheduleProgressApiProvider.overrideWithValue(FakeScheduleProgressApi()),
        memberLocationsApiProvider.overrideWithValue(FakeMemberLocationsApi()),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const PorterMapScreen(),
      ),
    );
  }

  testWidgets('shows notice when porter has no ongoing trips', (tester) async {
    await tester.pumpWidget(buildApp(trips: const []));
    await tester.pump();
    await tester.pump();

    expect(find.text('Chưa có chuyến đi đang diễn ra'), findsOneWidget);
    expect(find.byType(OfflineMapPanel), findsNothing);

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('renders OfflineMapPanel when porter has one ongoing trip', (tester) async {
    const trip = IncidentTrip(
      id: kTrip1,
      title: 'Trekking Tà Năng 01',
      status: 'ongoing',
    );

    await tester.pumpWidget(
      buildApp(trips: const [trip]),
    );
    await tester.pump();
    await tester.pump();

    expect(find.byType(OfflineMapPanel), findsOneWidget);
    expect(find.text('Bản đồ ngoại tuyến'), findsOneWidget);
    expect(find.byKey(const Key('porter-gps-trip')), findsNothing);

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('shows dropdown and switches trip when porter has multiple ongoing trips', (
    tester,
  ) async {
    const trip1 = IncidentTrip(
      id: kTrip1,
      title: 'Tà Năng 01',
      status: 'ongoing',
    );
    const trip2 = IncidentTrip(
      id: kTrip2,
      title: 'Phan Dũng 02',
      status: 'ongoing',
    );

    await tester.pumpWidget(
      buildApp(trips: const [trip1, trip2]),
    );
    await tester.pump();
    await tester.pump();

    expect(find.byKey(const Key('porter-gps-trip')), findsOneWidget);
    expect(find.text('Tà Năng 01'), findsOneWidget);
    expect(find.byKey(const ValueKey('map-$kTrip1')), findsOneWidget);

    // Tap dropdown and switch to trip 2
    await tester.tap(find.byKey(const Key('porter-gps-trip')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.text('Phan Dũng 02').last);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Phan Dũng 02'), findsWidgets);
    expect(find.byKey(const ValueKey('map-$kTrip2')), findsOneWidget);
    expect(find.byKey(const ValueKey('map-$kTrip1')), findsNothing);

    await tester.pumpWidget(const SizedBox());
  });
}
