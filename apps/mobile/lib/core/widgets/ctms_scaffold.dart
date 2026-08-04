import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';

/// Standard page scaffold — the mobile adaptation of §2.2 AppHeader +
/// §2.3 PageHeader (`docs/design/CTMS-DESIGN-SYSTEM.md`): the breadcrumb is
/// dropped, the connection pill shrinks to a status dot, and the bell keeps
/// its unread badge. Every screen under `features/camper` and
/// `features/porter` builds on this instead of a bare [Scaffold].
///
/// ```dart
/// CtmsScaffold(
///   title: 'Lịch phân công',
///   subtitle: 'Theo dõi và xác nhận các ca trekking được giao cho bạn',
///   unreadNotifications: 3,
///   body: ListView(children: [...]),
///   floatingActionButton: FloatingActionButton(onPressed: openScanner, child: const Icon(Icons.qr_code_scanner)),
/// )
/// ```
class CtmsScaffold extends StatelessWidget {
  const CtmsScaffold({
    super.key,
    required this.title,
    this.subtitle,
    this.actions,
    required this.body,
    this.floatingActionButton,
    this.bottom,
    this.isConnected = true,
    this.unreadNotifications = 0,
    this.onNotificationsTap,
  });

  final String title;
  final String? subtitle;
  final List<Widget>? actions;
  final Widget body;
  final Widget? floatingActionButton;
  final PreferredSizeWidget? bottom;
  final bool isConnected;
  final int unreadNotifications;
  final VoidCallback? onNotificationsTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: subtitle == null
            ? Text(title)
            : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title),
                  Text(
                    subtitle!,
                    style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
        actions: [
          ...?actions,
          Container(
            width: 8,
            height: 8,
            margin: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
            decoration: BoxDecoration(
              color: isConnected ? AppColors.statusSuccess : AppColors.statusNeutral,
              shape: BoxShape.circle,
            ),
          ),
          _NotificationBell(count: unreadNotifications, onTap: onNotificationsTap),
          const SizedBox(width: AppSpacing.xs),
        ],
        bottom: bottom,
      ),
      body: body,
      floatingActionButton: floatingActionButton,
    );
  }
}

class _NotificationBell extends StatelessWidget {
  const _NotificationBell({required this.count, this.onTap});

  final int count;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton(onPressed: onTap, icon: const Icon(Icons.notifications_outlined)),
        if (count > 0)
          Positioned(
            right: 6,
            top: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              decoration: const BoxDecoration(
                color: AppColors.statusDanger,
                borderRadius: BorderRadius.all(Radius.circular(8)),
              ),
              alignment: Alignment.center,
              child: Text(
                count > 9 ? '9+' : '$count',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  height: 1,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
