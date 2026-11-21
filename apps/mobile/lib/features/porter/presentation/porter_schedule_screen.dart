import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_filter_chip_row.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../offline_packages/presentation/package_policy_copy.dart';
import '../../trip_operations/application/trip_operations_providers.dart';
import '../../trip_operations/domain/operational_trip.dart';
import '../../trip_operations/presentation/porter_trip_operations_screen.dart';
import '../../trip_operations/presentation/trip_operations_copy.dart';

class PorterScheduleScreen extends ConsumerStatefulWidget {
  const PorterScheduleScreen({super.key});

  @override
  ConsumerState<PorterScheduleScreen> createState() =>
      _PorterScheduleScreenState();
}

class _PorterScheduleScreenState extends ConsumerState<PorterScheduleScreen>
    with WidgetsBindingObserver {
  String _filter = 'Tất cả';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final accountId = ref.read(porterOperationsAccountProvider);
    if (state == AppLifecycleState.resumed && accountId != null) {
      ref.invalidate(assignedOperationalTripsProvider(accountId));
      ref.invalidate(tripLifecycleProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accountId = ref.watch(porterOperationsAccountProvider);
    return CtmsScaffold(
      title: 'Lịch phân công',
      body: accountId == null
          ? const CtmsEmptyState(title: 'Vui lòng đăng nhập lại')
          : ref
                .watch(assignedOperationalTripsProvider(accountId))
                .when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (error, _) => CtmsEmptyState(
                    title: lifecycleError(error),
                    action: OutlinedButton(
                      onPressed: () => ref.invalidate(
                        assignedOperationalTripsProvider(accountId),
                      ),
                      child: const Text('Thử lại'),
                    ),
                  ),
                  data: (trips) {
                    final visible = trips
                        .where(
                          (trip) =>
                              _filter == 'Tất cả' ||
                              trip.status.label == _filter,
                        )
                        .toList();
                    return RefreshIndicator(
                      onRefresh: () async {
                        ref.invalidate(
                          assignedOperationalTripsProvider(accountId),
                        );
                        await ref.read(
                          assignedOperationalTripsProvider(accountId).future,
                        );
                      },
                      child: ListView(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          CtmsFilterChipRow(
                            options: [
                              'Tất cả',
                              OperationalTripStatus.published.label,
                              OperationalTripStatus.ongoing.label,
                              OperationalTripStatus.completed.label,
                            ],
                            selected: _filter,
                            onSelected: (value) =>
                                setState(() => _filter = value),
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          if (visible.isEmpty)
                            const CtmsEmptyState(
                              title: 'Chưa có chuyến đi trong danh sách này',
                            ),
                          for (final trip in visible)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: AppSpacing.lg,
                              ),
                              child: CtmsSectionCard(
                                title: trip.title,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(trip.status.label),
                                    const SizedBox(height: AppSpacing.sm),
                                    Text(
                                      '${packageTime(trip.startsAt)} – ${packageTime(trip.endsAt)}',
                                    ),
                                    if (trip.routeName != null)
                                      Text(trip.routeName!),
                                    const SizedBox(height: AppSpacing.md),
                                    OutlinedButton(
                                      onPressed: () async {
                                        await Navigator.of(context).push(
                                          MaterialPageRoute<void>(
                                            builder: (_) =>
                                                PorterTripOperationsScreen(
                                                  trip: trip,
                                                  accountId: accountId,
                                                ),
                                          ),
                                        );
                                        if (mounted) {
                                          ref.invalidate(
                                            assignedOperationalTripsProvider(
                                              accountId,
                                            ),
                                          );
                                        }
                                      },
                                      child: const Text('Xem chuyến đi'),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}
