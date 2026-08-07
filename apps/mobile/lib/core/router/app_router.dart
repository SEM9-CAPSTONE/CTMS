import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/domain/user_role.dart';
import '../../features/auth/data/auth_api.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/verify_screen.dart';
import '../../features/camper/presentation/camper_ai_assistant_screen.dart';
import '../../features/camper/presentation/camper_explore_screen.dart';
import '../../features/camper/overview/presentation/camper_overview_screen.dart';
import '../../features/camper/presentation/camper_profile_screen.dart';
import '../../features/camper/presentation/camper_shell_screen.dart';
import '../../features/camper/presentation/camper_trips_screen.dart';
import '../../features/porter/presentation/porter_alerts_screen.dart';
import '../../features/porter/presentation/porter_incidents_screen.dart';
import '../../features/porter/presentation/porter_map_screen.dart';
import '../../features/porter/presentation/porter_overview_screen.dart';
import '../../features/porter/presentation/porter_schedule_screen.dart';
import '../../features/porter/presentation/porter_settings_screen.dart';
import '../../features/porter/presentation/porter_shell_screen.dart';
import '../../features/porter/presentation/porter_team_screen.dart';

/// Default landing tab per role — also doubles as the "does this location
/// belong to this role" prefix check in [redirect] below.
const _camperHome = '/camper/overview';
const _porterHome = '/porter/overview';

/// Role-based redirect — the Flutter equivalent of
/// apps/web/src/routes/AppRoleGuard.tsx. Rebuilds (and re-evaluates the
/// initial redirect) whenever [authControllerProvider] changes, which is
/// enough for a single-shell app where role switches only happen via a
/// fresh login.
final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authControllerProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      if (authState.isLoading) return null;

      final user = authState.valueOrNull;
      final onAuthScreen =
          state.matchedLocation == '/login' ||
          state.matchedLocation == '/register' ||
          // Reached only right after a successful register — the account
          // exists but is pending_verification, so it has no session (see
          // RegisterScreen's class doc). Must not bounce to /login before
          // the account context (route `extra`) has been read.
          state.matchedLocation == '/verify';

      if (user == null) {
        return onAuthScreen ? null : '/login';
      }

      final rolePrefix = switch (user.role) {
        UserRole.camper => '/camper',
        UserRole.porter => '/porter',
        // Host/Admin manage CTMS from the web dashboard, not this app.
        UserRole.host || UserRole.admin => null,
      };
      if (rolePrefix == null) return '/login';

      final home = rolePrefix == '/camper' ? _camperHome : _porterHome;
      if (onAuthScreen) return home;
      if (!state.matchedLocation.startsWith(rolePrefix)) return home;
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/register', builder: (context, state) => const RegisterScreen()),
      GoRoute(
        path: '/verify',
        builder: (context, state) => VerifyScreen(account: state.extra! as RegisterResult),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            CamperShellScreen(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/camper/overview',
                builder: (context, state) => const CamperOverviewScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/camper/explore',
                builder: (context, state) => const CamperExploreScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/camper/trips',
                builder: (context, state) => const CamperTripsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/camper/ai',
                builder: (context, state) => const CamperAiAssistantScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/camper/profile',
                builder: (context, state) => const CamperProfileScreen(),
              ),
            ],
          ),
        ],
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            PorterShellScreen(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/porter/overview',
                builder: (context, state) => const PorterOverviewScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/porter/schedule',
                builder: (context, state) => const PorterScheduleScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/porter/map', builder: (context, state) => const PorterMapScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/porter/alerts',
                builder: (context, state) => const PorterAlertsScreen(),
              ),
            ],
          ),
        ],
      ),
      // Reached from the porter shell's "Thêm" sheet, not the bottom nav —
      // pushed on top of the whole shell rather than swapping a branch.
      GoRoute(path: '/porter/team', builder: (context, state) => const PorterTeamScreen()),
      GoRoute(
        path: '/porter/incidents',
        builder: (context, state) => const PorterIncidentsScreen(),
      ),
      GoRoute(path: '/porter/settings', builder: (context, state) => const PorterSettingsScreen()),
    ],
  );
});
