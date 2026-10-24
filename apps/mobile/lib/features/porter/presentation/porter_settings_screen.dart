import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/domain/auth_user.dart';
import '../../auth/presentation/widgets/logout_actions.dart';
import '../../sync/presentation/device_sync_status_screen.dart';

class PorterSettingsScreen extends ConsumerWidget {
  const PorterSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).valueOrNull;

    return CtmsScaffold(
      title: 'Hồ sơ & cài đặt',
      subtitle: 'Thông tin tài khoản porter và cấu hình ngoại tuyến',
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Porter Profile Card
            Container(
              padding: const EdgeInsets.all(AppSpacing.cardPadding),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppRadius.cardBorderRadius,
                border: Border.all(color: AppColors.border, width: 1.0),
                boxShadow: AppColors.cardShadowSm,
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.brandPrimary,
                    child: Text(
                      user?.displayName.substring(0, 1).toUpperCase() ?? 'P',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.lg),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.displayName ?? 'Điều phối viên Porter',
                          style: AppTypography.h3.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          user?.email ?? 'porter@ctms.dev',
                          style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 6),
                        const CtmsStatusBadge(
                          label: 'Porter Chuyên nghiệp',
                          status: CtmsStatus.success,
                          showDot: true,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: AppSpacing.lg),

            // 2. Offline Telemetry Card
            CtmsSectionCard(
              title: 'Đồng bộ & Ngoại tuyến',
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.sync_outlined, color: AppColors.textPrimary),
                title: const Text(
                  'Trạng thái truyền telemetry',
                  style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
                subtitle: const Text(
                  'Xem GPS và sự cố an toàn chờ tải lên máy chủ',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
                trailing: const Icon(Icons.chevron_right, color: AppColors.textSecondary),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const DeviceSyncStatusScreen(
                        tripId: 'a1736fee-62be-4991-9478-a62288e9b80a',
                      ),
                    ),
                  );
                },
              ),
            ),

            const SizedBox(height: AppSpacing.xxl),

            // 3. Logout Section
            const LogoutActions(),

            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }
}
