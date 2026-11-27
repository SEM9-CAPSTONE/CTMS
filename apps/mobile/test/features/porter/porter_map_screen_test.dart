import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/gps_tracking/presentation/porter_gps_tracking_section.dart';
import 'package:mobile/features/gps_tracking/presentation/gps_tracking_panel.dart';
import 'package:mobile/features/member_locations/presentation/trip_member_locations_panel.dart';
import 'package:mobile/features/offline_map/application/offline_map_controller.dart';
import 'package:mobile/features/offline_map/presentation/offline_map_panel.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';
import '../offline_packages/package_integrity_fixture.dart';
import 'porter_trip_test_support.dart';

class _Download extends IdleDownload {
  _Download() : super(tripOne);
  void activate() {
    active = zipMetadata(packageZip());
    notifyListeners();
  }
}

void main() {
  testWidgets(
    'activating the selected Trip package refreshes its mounted map',
    (tester) async {
      final download = _Download();
      final map = IdleMap(tripOne);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            packageDownloadControllerProvider(
              tripOne,
            ).overrideWith((ref) => download),
            offlineMapControllerProvider(tripOne).overrideWith((ref) => map),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: PorterGpsTrackingSection(
                  tripId: tripOne,
                  tripTitle: 'Khám phá rừng Sơn Trà',
                  isOngoing: false,
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(map.reloads, 0);
      download.activate();
      await tester.pump();
      await tester.pump();
      expect(map.reloads, 1);
      download.basemapReady = true;
      download.notifyListeners();
      await tester.pump();
      await tester.pump();
      expect(map.reloads, 2);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  for (final ongoing in [false, true]) {
    testWidgets(
      'selected Trip ongoing=$ongoing controls recording and member locations',
      (tester) async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: trackingOverrides(),
            child: MaterialApp(
              home: Scaffold(
                body: SingleChildScrollView(
                  child: PorterGpsTrackingSection(
                    tripId: tripOne,
                    tripTitle: 'Khám phá rừng Sơn Trà',
                    isOngoing: ongoing,
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          find.byType(OfflineMapPanel),
          ongoing ? findsNothing : findsOneWidget,
        );
        expect(
          find.byType(GpsTrackingPanel),
          ongoing ? findsOneWidget : findsNothing,
        );
        expect(
          find.byType(TripMemberLocationsPanel),
          ongoing ? findsOneWidget : findsNothing,
        );
        expect(find.byType(DropdownButtonFormField<String>), findsNothing);
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }
}
