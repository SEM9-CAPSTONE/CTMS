import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../incidents/data/incidents_api.dart';
import '../../incidents/domain/trip_incident.dart';
import 'gps_tracking_panel.dart';

/// Porter's assigned Trips currently `ongoing` (`GET /trips/assigned`).
final porterOngoingTripsProvider = FutureProvider.autoDispose<List<IncidentTrip>>((ref) async {
  final trips = await HttpIncidentsApi(ref.watch(apiClientProvider)).assignedTrips();
  return trips.where((trip) => trip.status == 'ongoing').toList();
});

/// GPS breadcrumb recording for the Porter's ongoing assigned Trip.
class PorterGpsTrackingSection extends ConsumerStatefulWidget {
  const PorterGpsTrackingSection({super.key});

  @override
  ConsumerState<PorterGpsTrackingSection> createState() => _PorterGpsTrackingSectionState();
}

class _PorterGpsTrackingSectionState extends ConsumerState<PorterGpsTrackingSection> {
  String? _selectedTripId;

  @override
  Widget build(BuildContext context) {
    final trips = ref.watch(porterOngoingTripsProvider);
    return trips.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (_, _) => CtmsAlertBanner(
        severity: CtmsAlertSeverity.warning,
        title: 'Không tải được chuyến đi',
        message: 'Kiểm tra kết nối rồi thử lại để bắt đầu ghi GPS.',
        actions: [
          CtmsButton(
            label: 'Thử lại',
            variant: CtmsButtonVariant.soft,
            onPressed: () => ref.invalidate(porterOngoingTripsProvider),
          ),
        ],
      ),
      data: (items) {
        if (items.isEmpty) {
          return const CtmsAlertBanner(
            severity: CtmsAlertSeverity.info,
            title: 'Chưa có chuyến đi đang diễn ra',
            message: 'GPS chỉ được ghi khi bạn được phân công cho một chuyến đi đang diễn ra.',
          );
        }
        final selected = items.firstWhere(
          (trip) => trip.id == _selectedTripId,
          orElse: () => items.first,
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (items.length > 1) ...[
              DropdownButtonFormField<String>(
                key: const Key('porter-gps-trip'),
                initialValue: selected.id,
                decoration: const InputDecoration(labelText: 'Chuyến đi đang dẫn đoàn'),
                items: [
                  for (final trip in items)
                    DropdownMenuItem(value: trip.id, child: Text(trip.title)),
                ],
                onChanged: (value) => setState(() => _selectedTripId = value),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            GpsTrackingPanel(key: ValueKey(selected.id), tripId: selected.id),
          ],
        );
      },
    );
  }
}
