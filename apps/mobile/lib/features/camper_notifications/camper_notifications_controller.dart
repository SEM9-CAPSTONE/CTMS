import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../core/api/api_client.dart';
import '../auth/application/auth_controller.dart';
import '../auth/domain/user_role.dart';
import '../missed_alerts/missed_alerts_controller.dart';

/// Where the moment the Camper last opened the bell is kept (per account).
/// Emergency broadcasts have no server-side read state, so "new" is decided on
/// the device: anything that happened after this moment.
abstract interface class BellSeenStore {
  Future<DateTime?> read(String accountId);
  Future<void> write(String accountId, DateTime seenAt);
}

class SecureBellSeenStore implements BellSeenStore {
  const SecureBellSeenStore([this._storage = const FlutterSecureStorage()]);

  final FlutterSecureStorage _storage;

  String _key(String accountId) => 'camper_bell_seen_at_$accountId';

  @override
  Future<DateTime?> read(String accountId) async {
    try {
      final value = await _storage.read(key: _key(accountId));
      return value == null ? null : DateTime.tryParse(value);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> write(String accountId, DateTime seenAt) async {
    try {
      await _storage.write(
        key: _key(accountId),
        value: seenAt.toUtc().toIso8601String(),
      );
    } catch (_) {
      // Losing the marker only means old alerts count as new again.
    }
  }
}

/// The Camper's own SOS cancellation is listed but never rings the bell.
bool ringsBell(MissedAlert alert) =>
    !(alert.source == 'sos' && alert.details['transition'] == 'SOS_CANCELLED');

/// Camper bell: the latest alerts from `GET /missed-alerts` (Host emergency
/// broadcasts, SOS updates, Trip notifications of the last 24 h), refreshed
/// every [interval] and when the app comes back to the foreground.
class CamperNotificationsController extends ChangeNotifier
    with WidgetsBindingObserver {
  CamperNotificationsController({
    required this.accountId,
    required this.fetch,
    required this.store,
    this.interval = const Duration(seconds: 30),
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now {
    WidgetsBinding.instance.addObserver(this);
    unawaited(_start());
  }

  final String accountId;
  final FetchMissedAlerts fetch;
  final BellSeenStore store;
  final Duration interval;
  final DateTime Function() _now;

  Timer? _timer;
  bool _disposed = false;
  bool _refreshing = false;
  DateTime? _seenAt;
  List<MissedAlert> alerts = const [];
  bool failed = false;

  Future<void> _start() async {
    _seenAt = await store.read(accountId);
    await refresh();
    if (_disposed) return;
    _timer = Timer.periodic(interval, (_) => unawaited(refresh()));
  }

  bool isNew(MissedAlert alert) {
    final seenAt = _seenAt;
    return ringsBell(alert) &&
        (seenAt == null || alert.occurredAt.isAfter(seenAt));
  }

  int get unreadCount => alerts.where(isNew).length;

  Future<void> refresh() async {
    if (_refreshing || _disposed) return;
    _refreshing = true;
    try {
      final page = await fetch(null);
      final items = [...page.items]
        ..sort((a, b) => b.occurredAt.compareTo(a.occurredAt));
      alerts = items;
      failed = false;
    } catch (_) {
      failed = true;
    } finally {
      _refreshing = false;
      if (!_disposed) notifyListeners();
    }
  }

  /// Called when the Camper opens the bell: everything listed is now seen.
  Future<void> markAllSeen() async {
    final latest = alerts.isEmpty ? null : alerts.first.occurredAt;
    final now = _now();
    final seenAt = latest != null && latest.isAfter(now) ? latest : now;
    _seenAt = seenAt;
    if (!_disposed) notifyListeners();
    await store.write(accountId, seenAt);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(refresh());
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}

final bellSeenStoreProvider = Provider<BellSeenStore>(
  (ref) => const SecureBellSeenStore(),
);

/// `null` when nobody is signed in or the account is not a Camper.
final camperNotificationsControllerProvider =
    ChangeNotifierProvider.autoDispose<CamperNotificationsController?>((ref) {
      final user = ref.watch(
        authControllerProvider.select((state) => state.valueOrNull),
      );
      if (user == null || !user.roles.contains(UserRole.camper)) return null;
      final api = ref.watch(apiClientProvider);
      return CamperNotificationsController(
        accountId: user.id,
        store: ref.watch(bellSeenStoreProvider),
        fetch: (cursor) async {
          final response = await api.get<Map<String, dynamic>>(
            '/missed-alerts',
            queryParameters: cursor == null ? null : {'cursor': cursor},
          );
          return MissedAlertsPage(response.data!);
        },
      );
    });
