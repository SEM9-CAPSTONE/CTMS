import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/application/auth_controller.dart';
import '../../features/camper/profile/application/camper_profile_controller.dart';

/// CTMS-04-T03, DG-M6. Revalidates the session when the app returns to the
/// foreground, using the one real protected provider the app has today
/// (`camperProfileControllerProvider`, backed by `GET /profiles/me`) as the
/// vehicle. Invalidating it makes any currently-watching screen refetch,
/// which naturally exercises `ApiClient`'s 401-detect-refresh-retry
/// interceptor (Step 4) if the access token expired while the app was
/// backgrounded -- the actual refresh decision still belongs entirely to
/// that interceptor, not to this function.
///
/// Frozen scope (do not extend without a new Decision Gate):
/// - Only reacts to `AppLifecycleState.resumed`.
/// - Only invalidates `camperProfileControllerProvider` -- not a list, not
///   "every protected provider". Extend this only once a second real
///   protected provider exists AND a new DG says so.
/// - Never fires when unauthenticated (`authControllerProvider.valueOrNull
///   == null`) -- no proactive network call before a real session exists.
/// - No timer/polling -- this runs only on the OS lifecycle callback.
/// - No JWT decoding, no `/auth/me` call.
///
/// Extracted as a plain function (not inlined in the widget below) so it is
/// testable directly against a [WidgetRef] without pumping a full widget
/// tree/simulating a real OS lifecycle transition.
void handleAppLifecycleChange(AppLifecycleState state, WidgetRef ref) {
  if (state != AppLifecycleState.resumed) return;

  final isAuthenticated = ref.read(authControllerProvider).valueOrNull != null;
  if (!isAuthenticated) return;

  ref.invalidate(camperProfileControllerProvider);
}

/// Thin `WidgetsBindingObserver` wiring around [handleAppLifecycleChange],
/// registered once for the app's lifetime and disposed with it. Wraps
/// [child] instead of folding into `CtmsApp` directly, keeping this a
/// single narrowly-scoped addition to the widget tree.
class AppLifecycleObserver extends ConsumerStatefulWidget {
  const AppLifecycleObserver({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<AppLifecycleObserver> createState() => _AppLifecycleObserverState();
}

class _AppLifecycleObserverState extends ConsumerState<AppLifecycleObserver>
    with WidgetsBindingObserver {
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
    handleAppLifecycleChange(state, ref);
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
