import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/domain/user_role.dart';
import '../../features/auth/data/auth_api.dart';
import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/unsupported_mobile_role_screen.dart';
import '../../features/auth/presentation/verify_screen.dart';
import '../../features/camper/presentation/camper_ai_assistant_screen.dart';
import '../../features/camper/presentation/camper_explore_screen.dart';
import '../../features/camper/overview/presentation/camper_overview_screen.dart';
import '../../features/camper/presentation/camper_profile_screen.dart';
import '../../features/camper/presentation/camper_shell_screen.dart';
import '../../features/camper/presentation/camper_trips_screen.dart';
import '../../features/offline_packages/application/offline_trip_providers.dart';
import '../../features/porter/presentation/porter_alerts_screen.dart';
import '../../features/porter/presentation/porter_incidents_screen.dart';
import '../../features/porter/presentation/porter_overview_screen.dart';
import '../../features/trip_operations/presentation/porter_trips_screen.dart';
import '../../features/porter/presentation/porter_settings_screen.dart';
import '../../features/porter/presentation/porter_shell_screen.dart';
import '../../features/porter/presentation/porter_team_screen.dart';
import '../../features/terms/presentation/terms_screen.dart';

/// Default landing tab per role — also doubles as the "does this location
/// belong to this role" prefix check in [redirect] below.
const _camperHome = '/camper/overview';
const _porterHome = '/porter/overview';
const _unsupportedMobileRole = '/unsupported-mobile-role';

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
      final isPublicTermsRoute =
          state.matchedLocation == '/terms' ||
          state.matchedLocation == '/terms-and-policy';
      if (isPublicTermsRoute) return null;

      final onAuthScreen =
          state.matchedLocation == '/login' ||
          state.matchedLocation == '/register' ||
          state.matchedLocation == '/forgot-password' ||
          // Reached only right after a successful register — the account
          // exists but is pending_verification, so it has no session (see
          // RegisterScreen's class doc). Must not bounce to /login before
          // the account context (route `extra`) has been read.
          state.matchedLocation == '/verify';

      if (user == null) {
        return onAuthScreen ? null : '/login';
      }

      final roles = user.roles.isNotEmpty ? user.roles : [user.role];
      final rolePrefix = roles.contains(UserRole.camper)
          ? '/camper'
          : roles.contains(UserRole.porter)
          ? '/porter'
          // Host/Admin manage CTMS from the web dashboard, not this app.
          : null;
      if (rolePrefix == null) {
        return state.matchedLocation == _unsupportedMobileRole
            ? null
            : _unsupportedMobileRole;
      }

      final home = rolePrefix == '/camper' ? _camperHome : _porterHome;
      if (onAuthScreen) return home;
      if (!state.matchedLocation.startsWith(rolePrefix)) return home;
      return null;
    },
    routes: [
      GoRoute(path: '/', redirect: (context, state) => '/login'),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/terms-and-policy',
        builder: (context, state) => const TermsScreen(),
      ),
      GoRoute(
        path: '/terms',
        builder: (context, state) => const TermsScreen(),
      ),
      GoRoute(
        path: '/verify',
        builder: (context, state) =>
            VerifyScreen(account: state.extra! as RegisterResult),
      ),
      GoRoute(
        path: _unsupportedMobileRole,
        builder: (context, state) => const UnsupportedMobileRoleScreen(),
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
                builder: (context, state) => CamperAiAssistantScreen(
                  trip: switch (state.extra) {
                    final OfflineTripSelection selection => selection,
                    _ => null,
                  },
                ),
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
                path: '/porter/trips',
                builder: (context, state) => PorterTripsScreen(
                  initialTripId: state.uri.queryParameters['tripId'],
                ),
              ),
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
      // Keep existing bookmarks pointing to the combined trip workspace.
      GoRoute(
        path: '/porter/map',
        redirect: (context, state) => Uri(
          path: '/porter/trips',
          queryParameters: state.uri.queryParameters,
        ).toString(),
      ),
      GoRoute(
        path: '/porter/schedule',
        redirect: (context, state) => Uri(
          path: '/porter/trips',
          queryParameters: state.uri.queryParameters,
        ).toString(),
      ),
      GoRoute(
        path: '/porter/team',
        builder: (context, state) => const PorterTeamScreen(),
      ),
      GoRoute(
        path: '/porter/incidents',
        builder: (context, state) => const PorterIncidentsScreen(),
      ),
      GoRoute(
        path: '/porter/settings',
        builder: (context, state) => const PorterSettingsScreen(),
      ),
    ],
  );
});
