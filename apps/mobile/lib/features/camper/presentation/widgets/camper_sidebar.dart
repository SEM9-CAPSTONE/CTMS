import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/ctms_logo.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/domain/auth_user.dart';
import '../../profile/application/camper_profile_controller.dart';

/// Navigation item model for Camper Sidebar
class _NavItem {
  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.branchIndex,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final int branchIndex;
}

const _navItems = [
  _NavItem(
    icon: Icons.dashboard_outlined,
    activeIcon: Icons.dashboard_rounded,
    label: 'Tổng quan',
    branchIndex: 0,
  ),
  _NavItem(
    icon: Icons.explore_outlined,
    activeIcon: Icons.explore_rounded,
    label: 'Khám phá',
    branchIndex: 1,
  ),
  _NavItem(
    icon: Icons.hiking_outlined,
    activeIcon: Icons.hiking_rounded,
    label: 'Chuyến đi',
    branchIndex: 2,
  ),
  _NavItem(
    icon: Icons.smart_toy_outlined,
    activeIcon: Icons.smart_toy_rounded,
    label: 'Trợ lý AI',
    branchIndex: 3,
  ),
  _NavItem(
    icon: Icons.person_outline,
    activeIcon: Icons.person_rounded,
    label: 'Hồ sơ',
    branchIndex: 4,
  ),
];

/// Sidebar for Camper role:
/// Pure white surface, subtle border #DFE8DF, black text #10221B,
/// and green CTA buttons #164027 only for active states.
class CamperSidebar extends ConsumerWidget {
  const CamperSidebar({
    super.key,
    required this.currentIndex,
    required this.onSelectIndex,
    this.isDrawer = false,
  });

  final int currentIndex;
  final ValueChanged<int> onSelectIndex;
  final bool isDrawer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(camperProfileControllerProvider).valueOrNull;
    final user = ref.watch(authControllerProvider).valueOrNull;
    final fullName = profile?.fullName.trim();
    final displayName = fullName != null && fullName.isNotEmpty
        ? fullName
        : user?.displayName ?? 'Camper';

    return Container(
      width: 280,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          right: BorderSide(color: AppColors.border, width: 1.0),
        ),
      ),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Sidebar Header
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.md,
              ),
              child: Row(
                children: [
                  const CtmsLogo(size: 28, showText: true, badgeText: 'Camper'),
                  const Spacer(),
                  if (isDrawer)
                    IconButton(
                      icon: const Icon(
                        Icons.close_rounded,
                        color: AppColors.textPrimary,
                        size: 20,
                      ),
                      onPressed: () => Navigator.of(context).pop(),
                      tooltip: 'Đóng',
                    ),
                ],
              ),
            ),
            const Divider(color: AppColors.border, height: 1, thickness: 1),
            const SizedBox(height: AppSpacing.md),

            // 2. Navigation Items List
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                itemCount: _navItems.length,
                separatorBuilder: (context, _) => const SizedBox(height: 4),
                itemBuilder: (context, index) {
                  final item = _navItems[index];
                  final isActive = item.branchIndex == currentIndex;

                  return Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () {
                        onSelectIndex(item.branchIndex);
                        if (isDrawer) {
                          Navigator.of(context).pop();
                        }
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: isActive
                              ? AppColors.brandPrimary
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: isActive
                              ? [
                                  BoxShadow(
                                    color: const Color(0x33164027),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ]
                              : null,
                        ),
                        child: Row(
                          children: [
                            Icon(
                              isActive ? item.activeIcon : item.icon,
                              size: 20,
                              color: isActive
                                  ? Colors.white
                                  : AppColors.textPrimary,
                            ),
                            const SizedBox(width: AppSpacing.md),
                            Expanded(
                              child: Text(
                                item.label,
                                style: TextStyle(
                                  color: isActive
                                      ? Colors.white
                                      : AppColors.textPrimary,
                                  fontWeight: isActive
                                      ? FontWeight.w700
                                      : FontWeight.w600,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

            // 3. User Footer Section
            const Divider(color: AppColors.border, height: 1, thickness: 1),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.brandBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border, width: 1),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: Colors.white,
                      child: Text(
                        displayName.isNotEmpty ? displayName[0].toUpperCase() : 'C',
                        style: const TextStyle(
                          color: AppColors.brandPrimary,
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            displayName,
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const Text(
                            'Thành viên Camper',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
