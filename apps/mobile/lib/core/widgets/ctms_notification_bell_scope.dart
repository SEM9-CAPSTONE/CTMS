import 'package:flutter/widgets.dart';

/// Supplies the default notification bell (unread count + tap action) to every
/// [CtmsScaffold] below it that does not pass its own `unreadNotifications` /
/// `onNotificationsTap`. Lets one role-specific bell be wired once, above the
/// navigator, instead of on every screen.
class CtmsNotificationBellScope extends InheritedWidget {
  const CtmsNotificationBellScope({
    super.key,
    required this.count,
    required this.onTap,
    required super.child,
  });

  final int count;

  /// Receives the tapping scaffold's context, so sheets open on that screen.
  final void Function(BuildContext context) onTap;

  static CtmsNotificationBellScope? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<CtmsNotificationBellScope>();

  @override
  bool updateShouldNotify(CtmsNotificationBellScope oldWidget) =>
      count != oldWidget.count || onTap != oldWidget.onTap;
}
