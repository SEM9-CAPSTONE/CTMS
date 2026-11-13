import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/auth/domain/user_role.dart';
import 'package:mobile/features/push_notifications/application/push_notifications_controller.dart';
import 'package:mobile/features/push_notifications/data/push_devices_api.dart';
import 'package:mobile/features/push_notifications/data/push_messaging_port.dart';
import 'package:mobile/features/push_notifications/domain/push_models.dart';
import 'package:mobile/features/push_notifications/presentation/push_notification_widgets.dart';

const camper = AuthUser(
  id: 'camper-1',
  email: 'camper@ctms.local',
  role: UserRole.camper,
  roles: [UserRole.camper],
);
const porter = AuthUser(
  id: 'porter-1',
  email: 'porter@ctms.local',
  role: UserRole.porter,
  roles: [UserRole.porter],
);

PushNotice notice(
  String type, {
  String eventId = 'e-1',
  String title = 'Chuyến đi đã đổi lịch',
  String body = 'Vui lòng xác nhận lại.',
  Map<String, Object?> extra = const {},
}) => PushNotice.fromMessage(
  title: title,
  body: body,
  data: {'type': type, 'eventId': eventId, ...extra},
);

class FakeMessaging implements PushMessagingPort {
  bool available = true;
  PushPermission permission = PushPermission.granted;
  String? token = 'fcm-token-1';
  Object? tokenError;
  PushNotice? initial;
  int permissionRequests = 0;
  final foreground = StreamController<PushNotice>.broadcast();
  final opened = StreamController<PushNotice>.broadcast();
  final refresh = StreamController<String>.broadcast();

  @override
  String get platform => 'android';

  @override
  Future<bool> initialize() async => available;

  @override
  Future<PushPermission> requestPermission() async {
    permissionRequests++;
    return permission;
  }

  @override
  Future<String?> getToken() async {
    if (tokenError != null) throw tokenError!;
    return token;
  }

  @override
  Stream<String> get onTokenRefresh => refresh.stream;

  @override
  Stream<PushNotice> get onForegroundMessage => foreground.stream;

  @override
  Stream<PushNotice> get onMessageOpened => opened.stream;

  @override
  Future<PushNotice?> getInitialMessage() async => initial;
}

class FakeApi implements PushDevicesApi {
  final registered = <String>[];
  final unregistered = <String>[];
  Object? failRegister;
  Object? failUnregister;

  @override
  Future<void> register(String token, String platform) async {
    if (failRegister != null) throw failRegister!;
    registered.add('$token:$platform');
  }

  @override
  Future<void> unregister(String token) async {
    if (failUnregister != null) throw failUnregister!;
    unregistered.add(token);
  }
}

class Harness {
  Harness() {
    controller = PushNotificationsController(
      messaging: messaging,
      api: api,
      seenStore: seen,
      navigate: routes.add,
    );
  }

  final messaging = FakeMessaging();
  final api = FakeApi();
  final seen = InMemoryPushSeenStore();
  final routes = <String>[];
  late final PushNotificationsController controller;
}

Future<void> settle() async {
  for (var i = 0; i < 5; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  group('registration (CTMS-090-T02)', () {
    test(
      'registers the token after a Camper signs in and is enabled only then',
      () async {
        final h = Harness();
        expect(h.controller.status, PushAvailability.idle);

        await h.controller.onUserChanged(camper);

        expect(h.messaging.permissionRequests, 1);
        expect(h.api.registered, ['fcm-token-1:android']);
        expect(h.controller.status, PushAvailability.enabled);
      },
    );

    test('re-registers when Firebase rotates the token', () async {
      final h = Harness();
      await h.controller.onUserChanged(camper);
      h.messaging.refresh.add('fcm-token-2');
      await settle();
      expect(h.api.registered.last, 'fcm-token-2:android');
    });

    test(
      'is unavailable without a Firebase configuration and never asks for permission',
      () async {
        final h = Harness()..messaging.available = false;
        await h.controller.onUserChanged(camper);
        expect(h.controller.status, PushAvailability.unavailable);
        expect(h.messaging.permissionRequests, 0);
        expect(h.api.registered, isEmpty);
      },
    );

    test(
      'reports a refused permission and registers after the user allows it and retries',
      () async {
        final h = Harness()..messaging.permission = PushPermission.denied;
        await h.controller.onUserChanged(camper);
        expect(h.controller.status, PushAvailability.permissionDenied);
        expect(h.api.registered, isEmpty);

        h.messaging.permission = PushPermission.granted;
        await h.controller.enable();
        expect(h.controller.status, PushAvailability.enabled);
      },
    );

    test(
      'does not pretend to be enabled when the token or the API fails',
      () async {
        final noToken = Harness()..messaging.token = null;
        await noToken.controller.onUserChanged(camper);
        expect(noToken.controller.status, PushAvailability.error);
        expect(noToken.controller.errorMessage, contains('mã thiết bị'));

        final apiDown = Harness()..api.failRegister = Exception('503');
        await apiDown.controller.onUserChanged(camper);
        expect(apiDown.controller.status, PushAvailability.error);
        expect(apiDown.controller.errorMessage, contains('Máy chủ'));

        apiDown.api.failRegister = null;
        await apiDown.controller.enable();
        expect(apiDown.controller.status, PushAvailability.enabled);
      },
    );

    test(
      'removes the token before sign-out and tolerates a failed removal',
      () async {
        final h = Harness();
        await h.controller.onUserChanged(camper);
        await h.controller.unregister();
        expect(h.api.unregistered, ['fcm-token-1']);
        await h.controller.unregister();
        expect(h.api.unregistered, hasLength(1));

        final failing = Harness()..api.failUnregister = Exception('offline');
        await failing.controller.onUserChanged(camper);
        await expectLater(failing.controller.unregister(), completes);
      },
    );

    test(
      'does nothing for roles without the mobile app and resets on sign-out',
      () async {
        final h = Harness();
        await h.controller.onUserChanged(
          const AuthUser(
            id: 'h',
            email: 'h@x',
            role: UserRole.host,
            roles: [UserRole.host],
          ),
        );
        expect(h.controller.status, PushAvailability.idle);
        expect(h.api.registered, isEmpty);

        await h.controller.onUserChanged(camper);
        await h.controller.onUserChanged(null);
        expect(h.controller.status, PushAvailability.idle);
      },
    );
  });

  group('received and opened pushes', () {
    test(
      'shows a foreground push once even when it is delivered twice (AC-4)',
      () async {
        final h = Harness();
        await h.controller.onUserChanged(camper);
        h.messaging.foreground.add(notice('booking.updated'));
        await settle();
        expect(h.controller.banner?.title, 'Chuyến đi đã đổi lịch');

        h.controller.dismissBanner();
        h.messaging.foreground.add(notice('booking.updated'));
        await settle();
        expect(h.controller.banner, isNull);
        expect(h.seen.keys, ['e-1']);
      },
    );

    test('opens the related screen of the signed-in role', () async {
      final h = Harness();
      await h.controller.onUserChanged(camper);
      h.messaging.opened.add(notice('trip.weather.changed', eventId: 'w-1'));
      await settle();
      expect(h.routes, ['/camper/trips']);

      final p = Harness();
      await p.controller.onUserChanged(porter);
      p.messaging.opened.add(notice('porter.request.created', eventId: 'r-1'));
      await settle();
      expect(p.routes, ['/porter/alerts']);
    });

    test(
      'opens the push that launched the app once the session is restored',
      () async {
        final h = Harness()
          ..messaging.initial = notice('booking.updated', eventId: 'cold');
        await h.controller.onUserChanged(camper);
        expect(h.routes, ['/camper/trips']);
      },
    );

    test('opens the banner target and clears it', () async {
      final h = Harness();
      await h.controller.onUserChanged(camper);
      h.messaging.foreground.add(notice('emergency.broadcast', eventId: 'x'));
      await settle();
      h.controller.openBanner();
      expect(h.routes, ['/camper/trips']);
      expect(h.controller.banner, isNull);
    });
  });

  group('pushRouteFor (AC-5)', () {
    test('never opens another role\'s screens', () {
      expect(
        pushRouteFor(notice('booking.updated'), [UserRole.camper]),
        '/camper/trips',
      );
      expect(
        pushRouteFor(notice('porter.request.created'), [UserRole.camper]),
        '/camper/overview',
      );
      expect(
        pushRouteFor(notice('booking.updated'), [UserRole.porter]),
        '/porter/overview',
      );
      expect(
        pushRouteFor(notice('porter.request.state_changed'), [UserRole.porter]),
        '/porter/alerts',
      );
      expect(
        pushRouteFor(notice('booking.updated'), [UserRole.host]),
        '/login',
      );
    });

    test('builds a notice from FCM data with a stable key', () {
      final withId = PushNotice.fromMessage(
        title: ' ',
        body: null,
        data: {'eventId': 'e', 'n': 1},
      );
      expect(withId.key, 'e');
      expect(withId.title, 'Thông báo CTMS');
      expect(withId.data['n'], '1');
      final withoutId = PushNotice.fromMessage(
        title: 'A',
        body: 'B',
        data: const {},
      );
      expect(withoutId.key, 'A|B');
    });
  });

  group('widgets', () {
    Future<Harness> pump(WidgetTester tester, {required Widget child}) async {
      final h = Harness();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            pushNotificationsControllerProvider.overrideWith(
              (ref) => h.controller,
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: Scaffold(body: SingleChildScrollView(child: child)),
          ),
        ),
      );
      return h;
    }

    testWidgets('settings card reflects each state and offers a retry', (
      tester,
    ) async {
      final h = await pump(
        tester,
        child: const PushNotificationsSettingsCard(),
      );
      expect(find.text('Chưa bật'), findsOneWidget);

      h.messaging.permission = PushPermission.denied;
      await tester.runAsync(() => h.controller.onUserChanged(camper));
      await tester.pump();
      expect(find.text('Đang tắt'), findsOneWidget);
      expect(find.textContaining('Cài đặt của điện thoại'), findsOneWidget);

      h.messaging.permission = PushPermission.granted;
      await tester.tap(find.byKey(const Key('push-settings-retry')));
      await tester.runAsync(settle);
      await tester.pump();
      expect(find.text('Đang bật'), findsOneWidget);
      expect(find.byKey(const Key('push-settings-retry')), findsNothing);
      expect(find.textContaining('luôn được gửi'), findsOneWidget);
    });

    testWidgets('settings card says when push is unavailable on this build', (
      tester,
    ) async {
      final h = await pump(
        tester,
        child: const PushNotificationsSettingsCard(),
      );
      h.messaging.available = false;
      await tester.runAsync(() => h.controller.onUserChanged(camper));
      await tester.pump();
      expect(find.text('Không khả dụng'), findsOneWidget);
    });

    testWidgets('overlay shows a foreground push and opens it', (tester) async {
      final h = await pump(
        tester,
        child: const PushNotificationOverlay(
          child: SizedBox(width: 400, height: 560),
        ),
      );
      await tester.runAsync(() => h.controller.onUserChanged(camper));
      h.messaging.foreground.add(
        notice(
          'emergency.broadcast',
          eventId: 'x',
          title: 'Cảnh báo khẩn: Bidoup',
          body: 'Xuống núi',
        ),
      );
      await tester.runAsync(settle);
      await tester.pump();
      expect(find.byKey(const Key('push-notification-banner')), findsOneWidget);
      expect(find.text('Cảnh báo khẩn: Bidoup'), findsOneWidget);

      await tester.tap(find.byKey(const Key('push-notification-open')));
      await tester.pump();
      expect(h.routes, ['/camper/trips']);
      expect(find.byKey(const Key('push-notification-banner')), findsNothing);
    });
  });
}
