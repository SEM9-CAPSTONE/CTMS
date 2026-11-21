import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../gps_tracking/presentation/porter_gps_tracking_section.dart';
import '../../offline_packages/presentation/package_policy_copy.dart';
import '../../sync/presentation/device_sync_status_screen.dart';
import '../application/trip_operations_providers.dart';
import '../domain/operational_trip.dart';
import 'trip_lifecycle_panel.dart';

class PorterTripWorkspace extends ConsumerStatefulWidget {
  const PorterTripWorkspace({
    super.key,
    required this.trip,
    required this.accountId,
  });
  final OperationalTrip trip;
  final String accountId;
  @override
  ConsumerState<PorterTripWorkspace> createState() =>
      _PorterTripWorkspaceState();
}

class _PorterTripWorkspaceState extends ConsumerState<PorterTripWorkspace> {
  TripLifecycle? _confirmedTransition;

  @override
  Widget build(BuildContext context) {
    if (ref.watch(porterOperationsAccountProvider) != widget.accountId) {
      return const Text('Vui lòng đăng nhập lại.');
    }
    final trip = widget.trip;
    final key = (accountId: widget.accountId, tripId: trip.id);
    final lifecycle = ref.watch(tripLifecycleProvider(key));
    ref.listen(tripLifecycleProvider(key), (previous, next) {
      if (next is AsyncData<TripLifecycle> && _confirmedTransition != null) {
        setState(() => _confirmedTransition = null);
      }
    });
    final error = lifecycle.error;
    final denied =
        error is ApiException &&
        [401, 403, 404, 409].contains(error.statusCode);
    final current = _confirmedTransition ?? lifecycle.valueOrNull;
    final status = denied ? null : current?.status;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CtmsSectionCard(
          title: trip.title,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (trip.routeName != null) Text(trip.routeName!),
              Text(
                'Dự kiến: ${packageTime(trip.startsAt)} – ${packageTime(trip.endsAt)}',
              ),
              const SizedBox(height: AppSpacing.md),
              TripLifecyclePanel(
                key: ValueKey('lifecycle-${widget.accountId}-${trip.id}'),
                tripKey: key,
                onChanged: (value) =>
                    setState(() => _confirmedTransition = value),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        if (status == OperationalTripStatus.published ||
            status == OperationalTripStatus.ongoing)
          PorterGpsTrackingSection(
            key: ValueKey('tracking-${widget.accountId}-${trip.id}'),
            tripId: trip.id,
            tripTitle: trip.title,
            isOngoing: status == OperationalTripStatus.ongoing,
          ),
        if (!denied && current != null)
          TextButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => DeviceSyncStatusScreen(tripId: trip.id),
              ),
            ),
            child: const Text('Kiểm tra đồng bộ dữ liệu'),
          ),
      ],
    );
  }
}
