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
/// Follows Design System:
/// - Background: Pure white / ultra-light gray (#F8FAF7)
/// - AppBar: White surface, 1px bottom border (#DFE8DF)
/// - Titles and text: Black (#10221B)
/// - Leading: Back button if canPop, otherwise Menu button to open Drawer
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
    this.leading,
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
  final Widget? leading;

  void _openAncestorDrawer(BuildContext context) {
    ScaffoldState? current = Scaffold.maybeOf(context);
    while (current != null) {
      if (current.hasDrawer) {
        current.openDrawer();
        return;
      }
      final parentContext = current.context;
      current = parentContext.findAncestorStateOfType<ScaffoldState>();
    }
  }

  @override
  Widget build(BuildContext context) {
    final PreferredSizeWidget appBarBottom = bottom != null
        ? PreferredSize(
            preferredSize: Size.fromHeight(bottom!.preferredSize.height + 1),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                bottom!,
                const Divider(height: 1, thickness: 1, color: AppColors.border),
              ],
            ),
          )
        : const PreferredSize(
            preferredSize: Size.fromHeight(1),
            child: Divider(height: 1, thickness: 1, color: AppColors.border),
          );

    return Scaffold(
      backgroundColor: AppColors.brandBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: leading ??
            Builder(
              builder: (ctx) {
                final canPop = ModalRoute.of(ctx)?.canPop ?? false;
                if (canPop) {
                  return IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
                    onPressed: () => Navigator.of(ctx).maybePop(),
                    tooltip: 'Quay lại',
                  );
                }
                return IconButton(
                  icon: const Icon(Icons.menu_rounded, color: AppColors.textPrimary),
                  tooltip: 'Menu điều hướng',
                  onPressed: () => _openAncestorDrawer(ctx),
                );
              },
            ),
        title: subtitle == null
            ? Text(
                title,
                style: AppTypography.h3.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTypography.h3.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    subtitle!,
                    style: AppTypography.caption.copyWith(
                      color: AppColors.textSecondary,
                    ),
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
        bottom: appBarBottom,
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
        IconButton(
          onPressed: onTap,
          icon: const Icon(Icons.notifications_none_rounded, color: AppColors.textPrimary),
        ),
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
