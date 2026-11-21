import '../../auth/domain/user_role.dart';

/// What the push channel can do on this device for the signed-in user (CTMS-090-T02).
enum PushAvailability {
  /// Signed out, or not started yet.
  idle,

  /// Firebase is not configured for this build, or the platform has no push (web/desktop).
  unavailable,

  /// The user refused (or later turned off) notification permission.
  permissionDenied,

  /// Asking for permission / registering the token with the API.
  registering,

  /// The API accepted this device's token: background pushes can arrive.
  enabled,

  /// Registration failed; nothing is assumed to work until a retry succeeds.
  error,
}

enum PushPermission { granted, denied }

/// One push as the app shows it. The text is a hint; the screen it opens reloads the
/// authoritative data (spec Section 8).
class PushNotice {
  const PushNotice({
    required this.key,
    required this.type,
    required this.title,
    required this.body,
    required this.data,
  });

  /// Event identity for de-duplication (`eventId`, else `pushId`, else title + body).
  final String key;

  /// Source event, e.g. `booking.updated`, `porter.request.created`.
  final String type;
  final String title;
  final String body;
  final Map<String, String> data;

  factory PushNotice.fromMessage({
    String? title,
    String? body,
    required Map<String, Object?> data,
  }) {
    final strings = {
      for (final entry in data.entries)
        if (entry.value != null) entry.key: '${entry.value}',
    };
    final resolvedTitle = (title ?? '').trim().isEmpty
        ? 'Thông báo CTMS'
        : title!.trim();
    final resolvedBody = (body ?? '').trim();
    final key =
        strings['eventId'] ??
        strings['pushId'] ??
        '$resolvedTitle|$resolvedBody';
    return PushNotice(
      key: key,
      type: strings['type'] ?? '',
      title: resolvedTitle,
      body: resolvedBody,
      data: strings,
    );
  }
}

const _camperTypes = {
  'booking.updated',
  'trip.weather.changed',
  'emergency.broadcast',
  'sos.state_changed',
};

const _porterTypes = {
  'porter.request.created',
  'porter.request.state_changed',
  'emergency.broadcast',
};

/// Where opening a push leads. Only to screens the signed-in role may open; otherwise the role's
/// home, so a push meant for another account never reveals anything (AC-5).
String pushRouteFor(PushNotice notice, List<UserRole> roles) {
  if (roles.contains(UserRole.camper)) {
    return _camperTypes.contains(notice.type)
        ? '/camper/trips'
        : '/camper/overview';
  }
  if (roles.contains(UserRole.porter)) {
    if (notice.type == 'emergency.broadcast') return '/porter/overview';
    return _porterTypes.contains(notice.type)
        ? '/porter/alerts'
        : '/porter/overview';
  }
  return '/login';
}
