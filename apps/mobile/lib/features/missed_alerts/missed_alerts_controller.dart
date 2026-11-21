import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../auth/application/auth_controller.dart';

class MissedAlert {
  MissedAlert(Map<String, dynamic> json)
    : key = json['dedupKey'] as String,
      source = json['source'] as String,
      occurredAt = DateTime.parse(json['occurredAt'] as String),
      unread = json.containsKey('readAt') && json['readAt'] == null,
      details = Map<String, dynamic>.from(json['details'] as Map);

  final String key;
  final String source;
  final DateTime occurredAt;
  final bool unread;
  final Map<String, dynamic> details;
}

class MissedAlertsPage {
  MissedAlertsPage(Map<String, dynamic> json)
    : items = (json['items'] as List)
          .map((item) => MissedAlert(Map<String, dynamic>.from(item as Map)))
          .toList(),
      nextCursor = json['nextCursor'] as String?,
      failedSources = (json['failedSources'] as List).cast<String>();

  final List<MissedAlert> items;
  final String? nextCursor;
  final List<String> failedSources;
}

typedef FetchMissedAlerts = Future<MissedAlertsPage> Function(String? cursor);

class MissedAlertsController extends ChangeNotifier
    with WidgetsBindingObserver {
  MissedAlertsController(this.fetch, Stream<List<ConnectivityResult>> network) {
    WidgetsBinding.instance.addObserver(this);
    _subscription = network.listen(_onNetwork, onError: (Object _) {});
    unawaited(refresh());
  }

  final FetchMissedAlerts fetch;
  late final StreamSubscription<List<ConnectivityResult>> _subscription;
  final _items = <String, MissedAlert>{};
  final _pending = <String, MissedAlert>{};
  String? _next;
  String? _failedCursor;
  bool _offline = false;
  bool _disposed = false;
  DateTime? _lastCompleted;
  bool loading = false;
  bool failed = false;
  List<String> failedSources = const [];
  bool get canLoadMore => _next != null && !failed;
  bool get hasNew => _pending.isNotEmpty;

  List<MissedAlert> get items => _items.values.toList()
    ..sort((a, b) {
      final time = b.occurredAt.compareTo(a.occurredAt);
      return time == 0 ? a.key.compareTo(b.key) : time;
    });

  void _onNetwork(List<ConnectivityResult> network) {
    final offline =
        network.isEmpty ||
        network.every((link) => link == ConnectivityResult.none);
    final restored = _offline && !offline;
    _offline = offline;
    if (restored) unawaited(failed ? retry() : refresh(force: true));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(refresh());
  }

  Future<void> refresh({bool force = false}) async {
    final previous = _lastCompleted;
    if (!force &&
        previous != null &&
        DateTime.now().difference(previous) < const Duration(seconds: 10)) {
      return;
    }
    if (failed) return retry();
    return _load(null, automatic: true);
  }

  Future<void> loadMore() async {
    if (canLoadMore) await _load(_next);
  }

  Future<void> retry() => _load(_failedCursor);

  void showNew() {
    _items.addAll(_pending);
    _pending.clear();
    notifyListeners();
  }

  Future<void> _load(String? cursor, {bool automatic = false}) async {
    if (_disposed || loading || _offline) return;
    loading = true;
    notifyListeners();
    var resetCursor = false;
    try {
      MissedAlertsPage page;
      try {
        page = await fetch(cursor);
      } on ApiException catch (error) {
        if (cursor == null || error.statusCode != 422 || _disposed) rethrow;
        cursor = null;
        _next = null;
        resetCursor = true;
        page = await fetch(null);
      }
      if (_disposed) return;
      failedSources = page.failedSources;
      failed = failedSources.isNotEmpty;
      _failedCursor = failed ? cursor : null;
      if (!failed) _next = page.nextCursor;
      if (cursor == null && !resetCursor) {
        final keys = page.items.map((item) => item.key).toSet();
        // Drop stale broadcast contents unless the fresh response confirms them.
        bool stale(String key, MissedAlert item) =>
            !keys.contains(key) &&
            !failedSources.contains(item.source) &&
            ((!failed && page.nextCursor == null) ||
                item.source == 'broadcast');
        _items.removeWhere(stale);
        _pending.removeWhere(stale);
      }
      final stageNew = automatic && _items.isNotEmpty;
      for (final item in page.items) {
        if (_items.containsKey(item.key) || !stageNew) {
          _items[item.key] = item;
          _pending.remove(item.key);
        } else {
          _pending[item.key] = item;
        }
      }
      _lastCompleted = DateTime.now();
    } catch (error) {
      if (_disposed) return;
      if (error is ApiException &&
          (error.statusCode == 401 || error.statusCode == 403)) {
        _items.clear();
        _pending.clear();
        _next = null;
      }
      failed = true;
      _failedCursor = cursor;
    } finally {
      loading = false;
      if (!_disposed) notifyListeners();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_subscription.cancel());
    super.dispose();
  }
}

final missedAlertsControllerProvider =
    ChangeNotifierProvider.autoDispose<MissedAlertsController?>((ref) {
      final account = ref.watch(
        authControllerProvider.select((state) => state.valueOrNull?.id),
      );
      if (account == null) return null;
      final api = ref.watch(apiClientProvider);
      return MissedAlertsController((cursor) async {
        final response = await api.get<Map<String, dynamic>>(
          '/missed-alerts',
          queryParameters: cursor == null ? null : {'cursor': cursor},
        );
        return MissedAlertsPage(response.data!);
      }, Connectivity().onConnectivityChanged);
    });
