import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_spacing.dart';

/// Bottom-nav frame for the Porter role — the mobile adaptation of §2.1
/// AppSidebar (`docs/design/CTMS-DESIGN-SYSTEM.md`). The sidebar has 7
/// items; per the desktop→mobile conversion rule ("> 5 mục thì 4 mục chính +
/// Thêm"), only the top 4 get a [StatefulShellBranch] in
/// `core/router/app_router.dart` — "Thêm" opens a sheet that pushes the rest
/// (`Thành viên đoàn`, `Sự cố`, `Hồ sơ & cài đặt`) as regular routes.
class PorterShellScreen extends StatelessWidget {
  const PorterShellScreen({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _branchDestinations = [
    NavigationDestination(
      icon: Icon(Icons.dashboard_outlined),
      selectedIcon: Icon(Icons.dashboard),
      label: 'Tổng quan',
    ),
    NavigationDestination(
      icon: Icon(Icons.event_note_outlined),
      selectedIcon: Icon(Icons.event_note),
      label: 'Lịch',
    ),
    NavigationDestination(icon: Icon(Icons.map_outlined), selectedIcon: Icon(Icons.map), label: 'Bản đồ'),
    NavigationDestination(
      icon: Icon(Icons.notifications_active_outlined),
      selectedIcon: Icon(Icons.notifications_active),
      label: 'Cảnh báo',
    ),
  ];

  static const _moreDestination = NavigationDestination(
    icon: Icon(Icons.more_horiz),
    label: 'Thêm',
  );

  void _openMoreSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.groups_outlined),
              title: const Text('Thành viên đoàn'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                context.push('/porter/team');
              },
            ),
            ListTile(
              leading: const Icon(Icons.report_gmailerrorred_outlined),
              title: const Text('Sự cố'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                context.push('/porter/incidents');
              },
            ),
            ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: const Text('Hồ sơ & cài đặt'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                context.push('/porter/settings');
              },
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) {
          if (index == _branchDestinations.length) {
            _openMoreSheet(context);
            return;
          }
          navigationShell.goBranch(index, initialLocation: index == navigationShell.currentIndex);
        },
        destinations: const [..._branchDestinations, _moreDestination],
      ),
    );
  }
}
