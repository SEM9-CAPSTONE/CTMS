import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../offline_packages/presentation/offline_package_screen.dart';
import '../../offline_packages/presentation/package_policy_copy.dart';
import '../../sync/presentation/device_sync_status_screen.dart';
import '../domain/operational_trip.dart';
import '../application/trip_operations_providers.dart';
import 'trip_lifecycle_panel.dart';

class PorterTripOperationsScreen extends ConsumerWidget {
  const PorterTripOperationsScreen({
    super.key,
    required this.trip,
    required this.accountId,
  });
  final OperationalTrip trip;
  final String accountId;

  @override
  Widget build(BuildContext context, WidgetRef ref) => CtmsScaffold(
    title: trip.title,
    actions: [
      IconButton(
        tooltip: 'Tải lại trạng thái',
        icon: const Icon(Icons.refresh),
        onPressed: () => ref.invalidate(
          tripLifecycleProvider((accountId: accountId, tripId: trip.id)),
        ),
      ),
    ],
    body: ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        CtmsSectionCard(
          title: 'Hành trình',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (trip.routeName != null) Text(trip.routeName!),
              Text(
                'Dự kiến: ${packageTime(trip.startsAt)} – ${packageTime(trip.endsAt)}',
              ),
              const SizedBox(height: AppSpacing.lg),
              TripLifecyclePanel(
                tripKey: (accountId: accountId, tripId: trip.id),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        OutlinedButton(
          onPressed: () async {
            await Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => OfflinePackageScreen(
                  tripId: trip.id,
                  accountId: accountId,
                  tripTitle: trip.title,
                ),
              ),
            );
            if (context.mounted) {
              ref.invalidate(
                tripLifecycleProvider((accountId: accountId, tripId: trip.id)),
              );
            }
          },
          child: const Text('Dữ liệu ngoại tuyến và chuẩn bị khởi hành'),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => DeviceSyncStatusScreen(tripId: trip.id),
            ),
          ),
          child: const Text('Kiểm tra đồng bộ dữ liệu'),
        ),
      ],
    ),
  );
}
