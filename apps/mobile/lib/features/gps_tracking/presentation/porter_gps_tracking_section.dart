import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_spacing.dart';
import '../../emergency_broadcasts/presentation/emergency_broadcasts_panel.dart';
import '../../member_locations/presentation/trip_member_locations_panel.dart';
import '../../offline_map/application/offline_map_controller.dart';
import '../../offline_map/presentation/offline_map_panel.dart';
import '../../offline_packages/application/package_download_controller.dart';
import '../../offline_packages/presentation/offline_package_screen.dart';
import '../../route_deviation/presentation/route_deviation_panel.dart';
import '../../schedule_progress/presentation/schedule_progress_panels.dart';
import 'gps_tracking_panel.dart';

/// Tracking for the trip selected by the workspace; there is no second selector or list request.
class PorterGpsTrackingSection extends ConsumerWidget {
  const PorterGpsTrackingSection({
    super.key,
    required this.tripId,
    required this.tripTitle,
    required this.isOngoing,
  });
  final String tripId;
  final String tripTitle;
  final bool isOngoing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(
      packageDownloadControllerProvider(tripId).select(
        (value) =>
            (value.active?.key, value.basemapReady, value.basemapPackageId),
      ),
      (previous, next) {
        if (previous == next || next.$1 == null) return;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (context.mounted) {
            ref
                .read(offlineMapControllerProvider(tripId))
                .reloadPackage(force: true);
          }
        });
      },
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (isOngoing) ...[
          TripMemberLocationsPanel(
            key: ValueKey('locations-$tripId'),
            tripId: tripId,
          ),
          const SizedBox(height: AppSpacing.lg),
          EmergencyBroadcastsPanel(
            key: ValueKey('emergency-$tripId'),
            tripId: tripId,
          ),
        ],
        if (!isOngoing) ...[
          OfflinePackagePanel(tripId: tripId, tripTitle: tripTitle),
          const SizedBox(height: AppSpacing.lg),
          OfflineMapPanel(
            key: ValueKey('map-$tripId'),
            tripId: tripId,
            tripTitle: tripTitle,
          ),
        ],
        if (isOngoing) ...[
          const SizedBox(height: AppSpacing.lg),
          GpsTrackingPanel(key: ValueKey('gps-$tripId'), tripId: tripId),
          const SizedBox(height: AppSpacing.lg),
          RouteDeviationPanel(key: ValueKey('route-$tripId'), tripId: tripId),
          const SizedBox(height: AppSpacing.lg),
          PorterTeamProgressPanel(
            key: ValueKey('progress-$tripId'),
            tripId: tripId,
          ),
        ],
      ],
    );
  }
}
