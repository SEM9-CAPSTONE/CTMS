import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../offline_packages/presentation/package_policy_copy.dart';
import '../application/trip_operations_providers.dart';
import '../domain/operational_trip.dart';
import 'porter_trip_workspace.dart';
import 'trip_operations_copy.dart';

class PorterTripsScreen extends ConsumerStatefulWidget {
  const PorterTripsScreen({super.key, this.initialTripId});
  final String? initialTripId;
  @override
  ConsumerState<PorterTripsScreen> createState() => _PorterTripsScreenState();
}

class _PorterTripsScreenState extends ConsumerState<PorterTripsScreen>
    with WidgetsBindingObserver {
  String? _selectedTripId;
  @override
  void initState() {
    super.initState();
    _selectedTripId = widget.initialTripId;
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didUpdateWidget(covariant PorterTripsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialTripId != widget.initialTripId) {
      _selectedTripId = widget.initialTripId;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _refresh(String accountId) async {
    final trips = ref
        .read(assignedOperationalTripsProvider(accountId))
        .valueOrNull;
    if (trips != null && trips.isNotEmpty) {
      ref.invalidate(
        tripLifecycleProvider((
          accountId: accountId,
          tripId: _select(trips).id,
        )),
      );
    }
    ref.invalidate(assignedOperationalTripsProvider(accountId));
    try {
      await ref.read(assignedOperationalTripsProvider(accountId).future);
    } catch (_) {}
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final account = ref.read(porterOperationsAccountProvider);
    if (state == AppLifecycleState.resumed && account != null) {
      _refresh(account);
    }
  }

  OperationalTrip _select(List<OperationalTrip> trips) => trips.firstWhere(
    (trip) => trip.id == _selectedTripId,
    orElse: () => trips.firstWhere(
      (trip) => trip.status == OperationalTripStatus.ongoing,
      orElse: () => trips.firstWhere(
        (trip) => trip.status == OperationalTripStatus.published,
        orElse: () => trips.first,
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final account = ref.watch(porterOperationsAccountProvider);
    return CtmsScaffold(
      title: 'Chuyến đi',
      actions: [
        if (account != null)
          IconButton(
            tooltip: 'Làm mới chuyến đi',
            icon: const Icon(Icons.refresh),
            onPressed: () => _refresh(account),
          ),
      ],
      body: account == null
          ? const CtmsEmptyState(title: 'Vui lòng đăng nhập lại')
          : _body(account),
    );
  }

  Widget _body(String account) {
    final query = ref.watch(assignedOperationalTripsProvider(account));
    final error = query.error;
    final denied =
        error is ApiException && [401, 403, 404].contains(error.statusCode);
    final trips = denied ? null : query.valueOrNull;
    if (trips == null) {
      if (query.isLoading) {
        return const Center(child: CircularProgressIndicator());
      }
      return CtmsEmptyState(
        title: lifecycleError(error ?? StateError('Unavailable')),
        action: OutlinedButton(
          onPressed: () => _refresh(account),
          child: const Text('Thử lại'),
        ),
      );
    }
    if (trips.isEmpty) {
      return const CtmsEmptyState(title: 'Chưa có chuyến đi được phân công');
    }
    final selected = _select(trips);
    _selectedTripId = selected.id;
    return RefreshIndicator(
      onRefresh: () => _refresh(account),
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (query.hasError) ...[
            const Text('Không cập nhật được danh sách chuyến đi.'),
            const SizedBox(height: AppSpacing.md),
          ],
          DropdownButtonFormField<String>(
            key: ValueKey('trip-picker-$account-${selected.id}'),
            initialValue: selected.id,
            isExpanded: true,
            decoration: const InputDecoration(
              labelText: 'Chuyến đi được phân công',
            ),
            items: [
              for (final trip in trips)
                DropdownMenuItem(
                  value: trip.id,
                  child: Text(
                    '${trip.title} · ${packageTime(trip.startsAt)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
            ],
            onChanged: (id) {
              if (id == null) return;
              setState(() => _selectedTripId = id);
              GoRouter.maybeOf(context)?.go(
                Uri(
                  path: '/porter/trips',
                  queryParameters: {'tripId': id},
                ).toString(),
              );
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          PorterTripWorkspace(
            key: ValueKey('workspace-$account-${selected.id}'),
            trip: selected,
            accountId: account,
          ),
        ],
      ),
    );
  }
}
