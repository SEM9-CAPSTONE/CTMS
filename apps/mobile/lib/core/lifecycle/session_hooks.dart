import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Work that must run while the session is still valid, right before a user-initiated sign-out
/// (CTMS-090: remove this device's push token so the signed-out account stops getting pushes).
typedef SessionEndingHook = Future<void> Function();

/// No-op by default; `main.dart` (the composition root) overrides it, so `auth` never imports the
/// features that need the hook.
final sessionEndingHookProvider = Provider<SessionEndingHook>(
  (ref) => () async {},
);
