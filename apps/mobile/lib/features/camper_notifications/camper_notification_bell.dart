import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/ctms_notification_bell_scope.dart';
import '../../core/widgets/ctms_status_badge.dart';
import '../emergency_broadcasts/data/emergency_broadcasts_api.dart';
import '../missed_alerts/missed_alerts_controller.dart';
import 'camper_notifications_controller.dart';

/// Title shown for one alert, same wording as the "Cảnh báo đã bỏ lỡ" panel.
String camperAlertTitle(MissedAlert alert) => switch (alert.source) {
  'broadcast' =>
    'Cảnh báo khẩn: ${emergencyAlertTypeLabel(alert.details['alertType'] as String? ?? '')}',
  'sos' => switch (alert.details['transition']) {
    'SOS_CANCELLED' => 'Đã hủy yêu cầu cứu trợ',
    'SOS_ACKNOWLEDGED' => 'Yêu cầu cứu trợ đã được tiếp nhận',
    'SOS_CLOSED' => 'Yêu cầu cứu trợ đã kết thúc',
    _ => 'Cập nhật yêu cầu cứu trợ',
  },
  _ => 'Thông báo chuyến đi',
};

/// Gives every Camper screen's top-right bell the live alert count and list.
/// Placed above the navigator (MaterialApp builder); other roles get nothing.
class CamperNotificationBellScope extends ConsumerWidget {
  const CamperNotificationBellScope({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(camperNotificationsControllerProvider);
    if (controller == null) return child;
    return CtmsNotificationBellScope(
      count: controller.unreadCount,
      onTap: (screenContext) =>
          showCamperNotificationsSheet(screenContext, controller),
      child: child,
    );
  }
}

Future<void> showCamperNotificationsSheet(
  BuildContext context,
  CamperNotificationsController controller,
) async {
  // Which items were new is decided before marking, so the sheet can tag them.
  final newKeys = {
    for (final alert in controller.alerts.where(controller.isNew)) alert.key,
  };
  final sheet = showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) =>
        _CamperNotificationsSheet(controller: controller, newKeys: newKeys),
  );
  await controller.markAllSeen();
  await sheet;
}

class _CamperNotificationsSheet extends StatelessWidget {
  const _CamperNotificationsSheet({
    required this.controller,
    required this.newKeys,
  });

  final CamperNotificationsController controller;
  final Set<String> newKeys;

  static final _time = DateFormat('HH:mm dd/MM/yyyy');

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final alerts = controller.alerts;
        return ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.75,
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.xl,
              AppSpacing.xl,
              AppSpacing.xl,
              AppSpacing.lg,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Thông báo', style: AppTypography.h2),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Cảnh báo khẩn từ Host và cập nhật cứu trợ trong 24 giờ qua.',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                if (controller.failed && alerts.isEmpty)
                  _Message(
                    text:
                        'Chưa tải được thông báo. Kiểm tra kết nối mạng rồi thử lại.',
                    action: TextButton(
                      onPressed: controller.refresh,
                      child: const Text('Thử lại'),
                    ),
                  )
                else if (alerts.isEmpty)
                  const _Message(
                    text: 'Chưa có thông báo nào trong 24 giờ qua.',
                  )
                else
                  Flexible(
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: alerts.length,
                      separatorBuilder: (_, _) =>
                          const Divider(height: 1, color: AppColors.border),
                      itemBuilder: (context, index) => _AlertTile(
                        alert: alerts[index],
                        isNew: newKeys.contains(alerts[index].key),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _AlertTile extends StatelessWidget {
  const _AlertTile({required this.alert, required this.isNew});

  final MissedAlert alert;
  final bool isNew;

  @override
  Widget build(BuildContext context) {
    final content = alert.details['content'];
    final urgent = alert.source == 'broadcast';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            urgent ? Icons.campaign_rounded : Icons.notifications_none_rounded,
            color: urgent ? AppColors.statusDanger : AppColors.brandPrimary,
            size: 22,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(camperAlertTitle(alert), style: AppTypography.bodyStrong),
                if (content is String && content.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    content,
                    style: AppTypography.body.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
                const SizedBox(height: 2),
                Text(
                  _CamperNotificationsSheet._time.format(
                    alert.occurredAt.toLocal(),
                  ),
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
          if (isNew) ...[
            const SizedBox(width: AppSpacing.sm),
            const CtmsStatusBadge(label: 'Mới', status: CtmsStatus.danger),
          ],
        ],
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.text, this.action});

  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      child: Column(
        children: [
          Text(
            text,
            textAlign: TextAlign.center,
            style: AppTypography.body.copyWith(color: AppColors.textSecondary),
          ),
          ?action,
        ],
      ),
    );
  }
}
