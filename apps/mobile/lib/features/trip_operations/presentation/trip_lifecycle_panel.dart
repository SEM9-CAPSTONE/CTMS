import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../../offline_packages/presentation/package_policy_copy.dart';
import '../application/trip_operations_providers.dart';
import '../data/trip_operations_api.dart';
import '../domain/operational_trip.dart';
import 'trip_operations_copy.dart';

class TripLifecyclePanel extends ConsumerStatefulWidget {
  const TripLifecyclePanel({super.key, required this.tripKey});
  final TripOperationsKey tripKey;

  @override
  ConsumerState<TripLifecyclePanel> createState() => _TripLifecyclePanelState();
}

class _TripLifecyclePanelState extends ConsumerState<TripLifecyclePanel> {
  bool _busy = false;
  bool _confirming = false;

  Future<void> _confirm(bool start) async {
    if (_busy || _confirming) return;
    setState(() => _confirming = true);
    final key = widget.tripKey;
    final label = start ? 'Bắt đầu chuyến đi' : 'Kết thúc chuyến đi';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(label),
        content: Text(
          start
              ? 'Xác nhận đoàn đã sẵn sàng khởi hành? Giờ bắt đầu sẽ được ghi nhận ngay.'
              : 'Xác nhận đoàn đã kết thúc hành trình an toàn? Giờ kết thúc sẽ được ghi nhận ngay.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Quay lại'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(label),
          ),
        ],
      ),
    );
    if (!mounted) return;
    setState(() => _confirming = false);
    if (confirmed != true ||
        ref.read(porterOperationsAccountProvider) != key.accountId) {
      setState(() => _busy = false);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref
          .read(tripOperationsApiProvider)
          .transition(key.accountId, key.tripId, start: start);
      if (!mounted ||
          ref.read(porterOperationsAccountProvider) != key.accountId) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.statusSuccess,
          content: Text(
            start ? 'Đã bắt đầu chuyến đi.' : 'Đã kết thúc chuyến đi.',
          ),
        ),
      );
    } catch (error) {
      if (!mounted ||
          ref.read(porterOperationsAccountProvider) != key.accountId) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.statusDanger,
          content: Text(lifecycleError(error)),
        ),
      );
    } finally {
      if (mounted) {
        ref.invalidate(tripLifecycleProvider(key));
        ref.invalidate(assignedOperationalTripsProvider(key.accountId));
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (ref.watch(porterOperationsAccountProvider) !=
        widget.tripKey.accountId) {
      return const Text('Vui lòng đăng nhập lại.');
    }
    return ref
        .watch(tripLifecycleProvider(widget.tripKey))
        .when(
          skipLoadingOnRefresh: false,
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Column(
            children: [
              Text(lifecycleError(error)),
              TextButton(
                onPressed: () =>
                    ref.invalidate(tripLifecycleProvider(widget.tripKey)),
                child: const Text('Thử lại'),
              ),
            ],
          ),
          data: (trip) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: CtmsStatusBadge(
                  label: trip.status.label,
                  status: trip.status == OperationalTripStatus.ongoing
                      ? CtmsStatus.success
                      : CtmsStatus.neutral,
                ),
              ),
              if (trip.actualStartedAt != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text('Bắt đầu thực tế: ${packageTime(trip.actualStartedAt!)}'),
              ],
              if (trip.actualEndedAt != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text('Kết thúc thực tế: ${packageTime(trip.actualEndedAt!)}'),
              ],
              if (trip.startBlockedReason != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(lifecycleReason(trip.startBlockedReason)),
              ],
              if (trip.status == OperationalTripStatus.published ||
                  trip.canEnd) ...[
                const SizedBox(height: AppSpacing.lg),
                CtmsButton(
                  label: trip.status == OperationalTripStatus.published
                      ? 'Bắt đầu chuyến đi'
                      : 'Kết thúc chuyến đi',
                  isLoading: _busy,
                  onPressed:
                      !_busy && !_confirming && (trip.canStart || trip.canEnd)
                      ? () => _confirm(trip.canStart)
                      : null,
                ),
              ],
            ],
          ),
        );
  }
}
