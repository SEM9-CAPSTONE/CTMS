import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/lifecycle/app_lifecycle_observer.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/incidents/application/incidents_controller.dart';
import 'features/push_notifications/application/push_notifications_controller.dart';
import 'features/push_notifications/presentation/push_notification_widgets.dart';
import 'features/sync/application/reconnection_sync_coordinator.dart';

class CtmsApp extends ConsumerWidget {
  const CtmsApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    // Keep account-scoped synchronization active across navigation.
    ref.watch(
      incidentsControllerProvider.select((controller) => controller != null),
    );
    // Keep reconnection sync coordinator active across app navigation (CTMS-065).
    ref.watch(reconnectionSyncCoordinatorProvider);
    // CTMS-090-T02: push registration follows the signed-in user for the app's lifetime.
    ref.watch(pushNotificationsControllerProvider.select((controller) => controller.status));

    // CTMS-04-T03, DG-M6: wraps the whole app so the lifecycle observer is
    // registered once for the app's lifetime, independent of whatever
    // screen/route is currently active -- see AppLifecycleObserver's doc
    // comment for the frozen scope of what it does on resume.
    return AppLifecycleObserver(
      child: MaterialApp.router(
        title: 'CTMS',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.light(),
        themeMode: ThemeMode.light,
        routerConfig: router,
        // Required for RestorationMixin anywhere in the tree (e.g.
        // RegisterScreen) to actually persist/restore state across the app
        // being backgrounded and the OS reclaiming the process.
        restorationScopeId: 'ctms',
        // CTMS-090-T02: a push received while the app is open appears above every screen.
        builder: (context, child) =>
            PushNotificationOverlay(child: child ?? const SizedBox.shrink()),
      ),
    );
  }
}
