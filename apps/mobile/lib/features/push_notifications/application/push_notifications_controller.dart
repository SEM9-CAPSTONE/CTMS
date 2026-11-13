import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/router/app_router.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/domain/auth_user.dart';
import '../../auth/domain/user_role.dart';
import '../data/push_devices_api.dart';
import '../data/push_messaging_port.dart';
import '../domain/push_models.dart';

/// CTMS-090-T02: background push for the signed-in Camper or Porter.
///
/// Registers this device's token with the API after sign-in and whenever Firebase rotates it,
/// removes it before sign-out, shows a push received in the foreground once (de-duplicated by
/// event id) and opens the related screen when a push is tapped. Every state comes from what
/// actually happened: no "enabled" without the API accepting the token.
class PushNotificationsController extends ChangeNotifier {
  PushNotificationsController({
    required this.messaging,
    required this.api,
    required this.seenStore,
    required this.navigate,
  });

  final PushMessagingPort messaging;
  final PushDevicesApi api;
  final PushSeenStore seenStore;

  /// Opens a route of the app router.
  final void Function(String location) navigate;

  PushAvailability status = PushAvailability.idle;
  String? errorMessage;

  /// Push received while the app is open, shown as an in-app banner until handled.
  PushNotice? banner;

  AuthUser? _user;
  String? _registeredToken;
  bool? _available;
  bool _disposed = false;
  final List<StreamSubscription<Object?>> _subscriptions = [];
  List<String> _seen = [];
  Future<void>? _starting;

  List<UserRole> get _roles {
    final user = _user;
    if (user == null) return const [];
    return user.roles.isNotEmpty ? user.roles : [user.role];
  }

  Future<void> _ensureStarted() => _starting ??= _start();

  Future<void> _start() async {
    _seen = await seenStore.read();
    _available = await messaging.initialize();
    if (_available != true) return;
    _subscriptions
      ..add(messaging.onForegroundMessage.listen(_onForeground))
      ..add(messaging.onMessageOpened.listen(_onOpened))
      ..add(
        messaging.onTokenRefresh.listen((token) => unawaited(_register(token))),
      );
    final initial = await messaging.getInitialMessage();
    if (initial != null) _pendingOpen = initial;
  }

  /// Opened before anyone was signed in (cold start): handled once the session is known.
  PushNotice? _pendingOpen;

  /// Called whenever the signed-in user changes (null = signed out).
  Future<void> onUserChanged(AuthUser? user) async {
    _user = user;
    if (user == null || !_isMobileRole) {
      _registeredToken = null;
      banner = null;
      _set(PushAvailability.idle);
      return;
    }
    await _ensureStarted();
    if (_available != true) {
      _set(PushAvailability.unavailable);
      return;
    }
    await enable();
    final pending = _pendingOpen;
    if (pending != null) {
      _pendingOpen = null;
      _open(pending);
    }
  }

  bool get _isMobileRole =>
      _roles.contains(UserRole.camper) || _roles.contains(UserRole.porter);

  /// Ask for permission and register the token; also the "Thử lại" action.
  Future<void> enable() async {
    if (_user == null || _available != true) return;
    _set(PushAvailability.registering);
    try {
      final permission = await messaging.requestPermission();
      if (permission == PushPermission.denied) {
        _set(PushAvailability.permissionDenied);
        return;
      }
      final token = await messaging.getToken();
      if (token == null || token.isEmpty) {
        _fail('Không lấy được mã thiết bị từ dịch vụ thông báo.');
        return;
      }
      await _register(token);
    } catch (_) {
      _fail('Không bật được thông báo đẩy. Vui lòng thử lại.');
    }
  }

  Future<void> _register(String token) async {
    if (_user == null) return;
    try {
      await api.register(token, messaging.platform);
      _registeredToken = token;
      errorMessage = null;
      _set(PushAvailability.enabled);
    } catch (_) {
      _fail('Máy chủ chưa nhận thiết bị này. Vui lòng thử lại.');
    }
  }

  /// Before sign-out, while the session is still valid: stop pushes to this device.
  Future<void> unregister() async {
    final token = _registeredToken;
    _registeredToken = null;
    if (token == null) return;
    try {
      await api.unregister(token);
    } catch (_) {
      // Sign-out goes on; a later sign-in on this phone moves the token anyway.
    }
  }

  Future<bool> _markSeen(PushNotice notice) async {
    if (_seen.contains(notice.key)) return false;
    _seen = [..._seen, notice.key];
    if (_seen.length > pushSeenLimit) {
      _seen = _seen.sublist(_seen.length - pushSeenLimit);
    }
    await seenStore.save(_seen);
    return true;
  }

  Future<void> _onForeground(PushNotice notice) async {
    if (_user == null) return;
    if (!await _markSeen(notice)) return;
    banner = notice;
    _notify();
  }

  Future<void> _onOpened(PushNotice notice) async {
    await _markSeen(notice);
    if (_user == null) {
      _pendingOpen = notice;
      return;
    }
    _open(notice);
  }

  /// "Xem" on the in-app banner.
  void openBanner() {
    final notice = banner;
    if (notice == null) return;
    banner = null;
    _notify();
    _open(notice);
  }

  void dismissBanner() {
    banner = null;
    _notify();
  }

  void _open(PushNotice notice) {
    if (banner?.key == notice.key) banner = null;
    navigate(pushRouteFor(notice, _roles));
    _notify();
  }

  void _fail(String message) {
    errorMessage = message;
    _set(PushAvailability.error);
  }

  void _set(PushAvailability next) {
    status = next;
    if (next != PushAvailability.error) errorMessage = null;
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    for (final subscription in _subscriptions) {
      unawaited(subscription.cancel());
    }
    super.dispose();
  }
}

final pushMessagingPortProvider = Provider<PushMessagingPort>(
  (ref) => FirebasePushMessaging(),
);

final pushDevicesApiProvider = Provider<PushDevicesApi>(
  (ref) => HttpPushDevicesApi(ref.watch(apiClientProvider)),
);

final pushSeenStoreProvider = Provider<PushSeenStore>(
  (ref) => SecurePushSeenStore(),
);

final pushNotificationsControllerProvider =
    ChangeNotifierProvider<PushNotificationsController>((ref) {
      final controller = PushNotificationsController(
        messaging: ref.watch(pushMessagingPortProvider),
        api: ref.watch(pushDevicesApiProvider),
        seenStore: ref.watch(pushSeenStoreProvider),
        navigate: (location) => ref.read(appRouterProvider).go(location),
      );
      ref.listen<AsyncValue<AuthUser?>>(authControllerProvider, (
        previous,
        next,
      ) {
        if (next.isLoading) return;
        final before = previous?.valueOrNull;
        final after = next.valueOrNull;
        if (before?.id == after?.id && previous?.isLoading != true) return;
        unawaited(controller.onUserChanged(after));
      }, fireImmediately: true);
      return controller;
    });
