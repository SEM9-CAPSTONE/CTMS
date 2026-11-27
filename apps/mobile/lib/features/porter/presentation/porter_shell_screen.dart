import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../terms/presentation/widgets/terms_reconsent_dialog.dart';

/// Porter navigation with overview, the combined trip workspace, and alerts.
/// "Thêm" opens team, incident, and profile routes in a sheet.
///
/// Styled with Brand Green background (#164027) and crisp white text/icons.
class PorterShellScreen extends StatelessWidget {
  const PorterShellScreen({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _branchDestinations = [
    NavigationDestination(
      icon: Icon(Icons.dashboard_outlined),
      selectedIcon: Icon(Icons.dashboard_rounded),
      label: 'Tổng quan',
    ),
    NavigationDestination(
      icon: Icon(Icons.event_note_outlined),
      selectedIcon: Icon(Icons.event_note_rounded),
      label: 'Chuyến đi',
    ),
    NavigationDestination(
      icon: Icon(Icons.notifications_active_outlined),
      selectedIcon: Icon(Icons.notifications_active_rounded),
      label: 'Cảnh báo',
    ),
  ];

  static const _moreDestination = NavigationDestination(
    icon: Icon(Icons.more_horiz_rounded),
    label: 'Thêm',
  );

  void _openMoreSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(
                Icons.groups_outlined,
                color: AppColors.textPrimary,
              ),
              title: const Text(
                'Thành viên đoàn',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              trailing: const Icon(
                Icons.chevron_right,
                color: AppColors.textSecondary,
              ),
              onTap: () {
                Navigator.of(sheetContext).pop();
                context.push('/porter/team');
              },
            ),
            const Divider(height: 1, thickness: 1, color: AppColors.border),
            ListTile(
              leading: const Icon(
                Icons.report_gmailerrorred_outlined,
                color: AppColors.textPrimary,
              ),
              title: const Text(
                'Sự cố',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              trailing: const Icon(
                Icons.chevron_right,
                color: AppColors.textSecondary,
              ),
              onTap: () {
                Navigator.of(sheetContext).pop();
                context.push('/porter/incidents');
              },
            ),
            const Divider(height: 1, thickness: 1, color: AppColors.border),
            ListTile(
              leading: const Icon(
                Icons.settings_outlined,
                color: AppColors.textPrimary,
              ),
              title: const Text(
                'Hồ sơ & cài đặt',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              trailing: const Icon(
                Icons.chevron_right,
                color: AppColors.textSecondary,
              ),
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
    return TermsReconsentGate(
      child: Scaffold(
        body: navigationShell,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.brandPrimary,
          border: Border(top: BorderSide(color: Color(0xFF0F2E1C), width: 1)),
          boxShadow: [
            BoxShadow(
              color: Color(0x33164027),
              blurRadius: 10,
              offset: Offset(0, -2),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: NavigationBarTheme(
            data: NavigationBarThemeData(
              backgroundColor: AppColors.brandPrimary,
              elevation: 0,
              surfaceTintColor: Colors.transparent,
              indicatorColor: const Color(0x33FFFFFF),
              indicatorShape: const StadiumBorder(),
              iconTheme: WidgetStateProperty.resolveWith((states) {
                final isSelected = states.contains(WidgetState.selected);
                return IconThemeData(
                  color: isSelected ? Colors.white : Colors.white70,
                  size: 24,
                );
              }),
              labelTextStyle: WidgetStateProperty.resolveWith((states) {
                final isSelected = states.contains(WidgetState.selected);
                return AppTypography.caption.copyWith(
                  color: isSelected ? Colors.white : Colors.white70,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                );
              }),
            ),
            child: NavigationBar(
              backgroundColor: AppColors.brandPrimary,
              elevation: 0,
              surfaceTintColor: Colors.transparent,
              selectedIndex: navigationShell.currentIndex,
              onDestinationSelected: (index) {
                if (index == _branchDestinations.length) {
                  _openMoreSheet(context);
                  return;
                }
                navigationShell.goBranch(
                  index,
                  initialLocation: index == navigationShell.currentIndex,
                );
              },
              destinations: const [..._branchDestinations, _moreDestination],
            ),
          ),
        ),
      ),
      ),
    );
  }
}
