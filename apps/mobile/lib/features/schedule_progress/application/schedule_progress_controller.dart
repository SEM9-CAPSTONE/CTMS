import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../data/schedule_progress_api.dart';

/// Approved refresh cadence: breadcrumbs are logged every 30 s and thresholds are in minutes.
const scheduleProgressRefreshInterval = Duration(minutes: 1);

/// CTMS-063-T02: keeps the server's behind-schedule evaluation for one Trip.
///
/// The last successful evaluation is kept when a refresh fails (offline, server error), labelled with
/// its time, so the client never derives a new warning on its own.
class ScheduleProgressController extends ChangeNotifier {
  ScheduleProgressController({
    required this.tripId,
    required this.api,
    Duration refreshInterval = scheduleProgressRefreshInterval,
  }) {
    unawaited(refresh());
    _timer = Timer.periodic(refreshInterval, (_) => unawaited(refresh()));
  }

  final String tripId;
  final ScheduleProgressApi api;
  Timer? _timer;
  bool _disposed = false;

  ScheduleProgress? data;
  bool isLoading = true;
  bool lastRefreshFailed = false;

  Future<void> refresh() async {
    isLoading = data == null;
    _notify();
    try {
      data = await api.fetch(tripId);
      lastRefreshFailed = false;
    } catch (_) {
      lastRefreshFailed = true;
    } finally {
      isLoading = false;
      _notify();
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    super.dispose();
  }
}

final scheduleProgressApiProvider = Provider<ScheduleProgressApi>(
  (ref) => HttpScheduleProgressApi(ref.watch(apiClientProvider)),
);

final scheduleProgressControllerProvider = ChangeNotifierProvider.autoDispose
    .family<ScheduleProgressController, String>(
      (ref, tripId) => ScheduleProgressController(
        tripId: tripId,
        api: ref.watch(scheduleProgressApiProvider),
      ),
    );
