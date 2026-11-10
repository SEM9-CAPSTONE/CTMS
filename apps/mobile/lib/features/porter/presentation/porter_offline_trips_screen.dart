import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../incidents/data/incidents_api.dart';
import '../../incidents/domain/trip_incident.dart';
import '../../offline_packages/application/package_download_controller.dart';
import '../../offline_packages/presentation/offline_package_screen.dart';

final _assignedTripsProvider = FutureProvider.autoDispose
    .family<List<IncidentTrip>, String>((ref, accountId) async {
      if (ref.watch(offlinePackageAccountProvider) != accountId) return [];
      return HttpIncidentsApi(ref.watch(apiClientProvider)).assignedTrips();
    });

class PorterOfflineTripsScreen extends ConsumerWidget {
  const PorterOfflineTripsScreen({super.key, required this.accountId});

  final String accountId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final account = ref.watch(offlinePackageAccountProvider);
    final trips = account == accountId
        ? ref.watch(_assignedTripsProvider(accountId))
        : null;
    return CtmsScaffold(
      title: 'Tải dữ liệu chuyến đi',
      body:
          trips?.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (_, _) => CtmsEmptyState(
              title: 'Không tải được chuyến đi được phân công',
              action: OutlinedButton(
                onPressed: () =>
                    ref.invalidate(_assignedTripsProvider(accountId)),
                child: const Text('Thử lại'),
              ),
            ),
            data: (items) => items.isEmpty
                ? const CtmsEmptyState(
                    title: 'Chưa có chuyến đi được phân công',
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      final trip = items[index];
                      return ListTile(
                        title: Text(trip.title),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => OfflinePackageScreen(
                              tripId: trip.id,
                              accountId: accountId,
                              tripTitle: trip.title,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ) ??
          const CtmsEmptyState(title: 'Vui lòng đăng nhập lại'),
    );
  }
}
