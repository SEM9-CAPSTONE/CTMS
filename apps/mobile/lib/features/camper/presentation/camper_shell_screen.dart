import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Bottom-nav frame for the Camper role — the mobile adaptation of §2.1
/// AppSidebar (`docs/design/CTMS-DESIGN-SYSTEM.md`). Each destination is a
/// [StatefulShellBranch] in `core/router/app_router.dart`, so switching tabs
/// preserves each tab's own navigation/scroll state.
class CamperShellScreen extends StatelessWidget {
  const CamperShellScreen({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _destinations = [
    NavigationDestination(
      icon: Icon(Icons.dashboard_outlined),
      selectedIcon: Icon(Icons.dashboard),
      label: 'Tổng quan',
    ),
    NavigationDestination(
      icon: Icon(Icons.explore_outlined),
      selectedIcon: Icon(Icons.explore),
      label: 'Khám phá',
    ),
    NavigationDestination(
      icon: Icon(Icons.hiking_outlined),
      selectedIcon: Icon(Icons.hiking),
      label: 'Chuyến đi',
    ),
    NavigationDestination(
      icon: Icon(Icons.smart_toy_outlined),
      selectedIcon: Icon(Icons.smart_toy),
      label: 'Trợ lý AI',
    ),
    NavigationDestination(
      icon: Icon(Icons.person_outline),
      selectedIcon: Icon(Icons.person),
      label: 'Hồ sơ',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
        destinations: _destinations,
      ),
    );
  }
}
