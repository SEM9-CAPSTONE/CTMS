import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../application/push_notifications_controller.dart';
import '../domain/push_models.dart';

const _mandatoryTypes = {'emergency.broadcast', 'sos.state_changed'};

/// Wraps every screen: a push received while the app is open appears on top, once (CTMS-090).
class PushNotificationOverlay extends ConsumerWidget {
  const PushNotificationOverlay({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(pushNotificationsControllerProvider);
    final notice = controller.banner;
    final urgent =
        notice != null &&
        (_mandatoryTypes.contains(notice.type) ||
            notice.data['riskLevel'] == 'red');
    return Stack(
      children: [
        child,
        if (notice != null)
          Positioned(
            left: AppSpacing.md,
            right: AppSpacing.md,
            top: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: Material(
                  color: Colors.transparent,
                  child: CtmsAlertBanner(
                    key: const Key('push-notification-banner'),
                    severity: urgent
                        ? CtmsAlertSeverity.emergency
                        : CtmsAlertSeverity.info,
                    icon: Icons.notifications_active_outlined,
                    title: notice.title,
                    message: notice.body,
                    actions: [
                      CtmsButton(
                        key: const Key('push-notification-open'),
                        label: 'Xem',
                        // White buttons stay readable on the filled red emergency banner.
                        variant: urgent
                            ? CtmsButtonVariant.secondary
                            : CtmsButtonVariant.primary,
                        onPressed: controller.openBanner,
                      ),
                      CtmsButton(
                        key: const Key('push-notification-dismiss'),
                        label: 'Đóng',
                        variant: urgent
                            ? CtmsButtonVariant.secondary
                            : CtmsButtonVariant.ghost,
                        onPressed: controller.dismissBanner,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

final _body = AppTypography.body.copyWith(color: AppColors.textPrimary);
final _caption = AppTypography.caption.copyWith(color: AppColors.textSecondary);

({String label, CtmsStatus status, String text}) _describe(
  PushNotificationsController controller,
) {
  return switch (controller.status) {
    PushAvailability.enabled => (
      label: 'Đang bật',
      status: CtmsStatus.success,
      text:
          'Bạn sẽ nhận thông báo về đặt chỗ, lời mời Porter, thời tiết và SOS kể cả khi không mở ứng dụng.',
    ),
    PushAvailability.registering => (
      label: 'Đang bật…',
      status: CtmsStatus.info,
      text: 'Đang đăng ký thiết bị này với máy chủ.',
    ),
    PushAvailability.permissionDenied => (
      label: 'Đang tắt',
      status: CtmsStatus.warning,
      text:
          'Bạn đã tắt quyền thông báo. Hãy bật lại trong Cài đặt của điện thoại (Ứng dụng › CTMS › Thông báo), rồi bấm "Thử lại".',
    ),
    PushAvailability.unavailable => (
      label: 'Không khả dụng',
      status: CtmsStatus.neutral,
      text:
          'Thiết bị hoặc bản cài đặt này chưa hỗ trợ thông báo đẩy. Cảnh báo vẫn hiện khi bạn mở ứng dụng.',
    ),
    PushAvailability.error => (
      label: 'Lỗi',
      status: CtmsStatus.danger,
      text: controller.errorMessage ?? 'Không bật được thông báo đẩy.',
    ),
    PushAvailability.idle => (
      label: 'Chưa bật',
      status: CtmsStatus.neutral,
      text: 'Thông báo đẩy sẽ được bật sau khi đăng nhập.',
    ),
  };
}

/// Push status on the profile / settings screen, with the retry action (CTMS-090-T02).
class PushNotificationsSettingsCard extends ConsumerWidget {
  const PushNotificationsSettingsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(pushNotificationsControllerProvider);
    final view = _describe(controller);
    final canRetry =
        controller.status == PushAvailability.permissionDenied ||
        controller.status == PushAvailability.error;
    return CtmsSectionCard(
      key: const Key('push-settings-card'),
      title: 'Thông báo đẩy',
      trailing: CtmsStatusBadge(
        key: const Key('push-settings-status'),
        label: view.label,
        status: view.status,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(view.text, style: _body),
          if (controller.status == PushAvailability.enabled) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Cảnh báo SOS, cảnh báo khẩn và thời tiết nguy hiểm luôn được gửi.',
              style: _caption,
            ),
          ],
          if (canRetry) ...[
            const SizedBox(height: AppSpacing.md),
            CtmsButton(
              key: const Key('push-settings-retry'),
              label: 'Thử lại',
              variant: CtmsButtonVariant.soft,
              onPressed: controller.enable,
            ),
          ],
        ],
      ),
    );
  }
}
