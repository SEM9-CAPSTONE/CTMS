import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../data/emergency_broadcast_seen_store.dart';
import '../data/emergency_broadcasts_api.dart';

/// Same cadence as the CTMS-076 incident list: the app has no socket, so it asks the server.
const emergencyBroadcastsRefreshInterval = Duration(seconds: 15);

/// CTMS-081-T02: emergency alerts the Host broadcast to one Trip, for the Camper/Porter app.
///
/// Refreshes every [emergencyBroadcastsRefreshInterval], when the app returns to the foreground
/// and when the network comes back. A failed refresh keeps the last list.
class EmergencyBroadcastsController extends ChangeNotifier
    with WidgetsBindingObserver {
  EmergencyBroadcastsController({
    required this.tripId,
    required this.api,
    required this.seenStore,
    Duration refreshInterval = emergencyBroadcastsRefreshInterval,
    Stream<List<ConnectivityResult>>? connectivity,
  }) {
    WidgetsBinding.instance.addObserver(this);
    unawaited(_start());
    _timer = Timer.periodic(refreshInterval, (_) => unawaited(refresh()));
    try {
      _connection = (connectivity ?? Connectivity().onConnectivityChanged)
          .listen((results) {
            if (!results.contains(ConnectivityResult.none)) {
              unawaited(refresh());
            }
          }, onError: (_) {});
    } catch (_) {}
  }

  final String tripId;
  final EmergencyBroadcastsApi api;
  final EmergencyBroadcastSeenStore seenStore;
  Timer? _timer;
  StreamSubscription<List<ConnectivityResult>>? _connection;
  bool _disposed = false;
  bool _refreshing = false;

  List<EmergencyBroadcast> broadcasts = const [];
  Set<String> seenIds = {};
  bool lastRefreshFailed = false;

  /// Alerts not yet acknowledged on this device.
  List<EmergencyBroadcast> get unseen =>
      broadcasts.where((item) => !seenIds.contains(item.id)).toList();

  Future<void> _start() async {
    seenIds = await seenStore.read(tripId);
    await refresh();
  }

  Future<void> refresh() async {
    if (_refreshing || _disposed) return;
    _refreshing = true;
    try {
      final items = await api.fetch(tripId);
      broadcasts = [...items]
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      lastRefreshFailed = false;
    } catch (_) {
      lastRefreshFailed = true;
    } finally {
      _refreshing = false;
      _notify();
    }
  }

  Future<void> markAllSeen() async {
    seenIds = {...seenIds, ...broadcasts.map((item) => item.id)};
    _notify();
    await seenStore.save(tripId, seenIds);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(refresh());
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    unawaited(_connection?.cancel());
    super.dispose();
  }
}

final emergencyBroadcastsApiProvider = Provider<EmergencyBroadcastsApi>(
  (ref) => HttpEmergencyBroadcastsApi(ref.watch(apiClientProvider)),
);

final emergencyBroadcastSeenStoreProvider =
    Provider<EmergencyBroadcastSeenStore>(
      (ref) => SecureEmergencyBroadcastSeenStore(),
    );

final emergencyBroadcastsControllerProvider = ChangeNotifierProvider.autoDispose
    .family<EmergencyBroadcastsController, String>(
      (ref, tripId) => EmergencyBroadcastsController(
        tripId: tripId,
        api: ref.watch(emergencyBroadcastsApiProvider),
        seenStore: ref.watch(emergencyBroadcastSeenStoreProvider),
      ),
    );
