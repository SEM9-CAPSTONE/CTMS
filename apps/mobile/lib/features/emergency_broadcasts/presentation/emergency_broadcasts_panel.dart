import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../application/emergency_broadcasts_controller.dart';
import '../data/emergency_broadcasts_api.dart';

String _time(DateTime value) {
  final local = value.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(local.hour)}:${two(local.minute)} ${two(local.day)}/${two(local.month)}';
}

// CtmsSectionCard is always white, so text uses the fixed text tokens like its title.
final _body = AppTypography.body.copyWith(color: AppColors.textPrimary);
final _bodyStrong = AppTypography.bodyStrong.copyWith(
  color: AppColors.textPrimary,
);
final _caption = AppTypography.caption.copyWith(color: AppColors.textSecondary);

/// CTMS-081-T02: emergency alerts the Host broadcast to this Trip, for the Camper and the Porter.
/// Shows nothing until there is an alert; the newest unacknowledged one is shown as an emergency
/// banner until the viewer taps "Đã xem".
class EmergencyBroadcastsPanel extends ConsumerWidget {
  const EmergencyBroadcastsPanel({super.key, required this.tripId});

  final String tripId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(emergencyBroadcastsControllerProvider(tripId));
    final broadcasts = controller.broadcasts;
    if (broadcasts.isEmpty) return const SizedBox.shrink();

    final unseen = controller.unseen;
    final latest = broadcasts.first;
    final older = broadcasts.skip(1).toList();

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        key: const Key('emergency-broadcasts-panel'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (unseen.isNotEmpty) ...[
            CtmsAlertBanner(
              key: const Key('emergency-broadcast-unseen'),
              severity: CtmsAlertSeverity.emergency,
              icon: Icons.campaign_outlined,
              title:
                  'Cảnh báo khẩn từ Host · ${emergencyAlertTypeLabel(unseen.first.alertType)}',
              message: unseen.first.content,
              timestamp: _time(unseen.first.createdAt),
              actions: [
                CtmsButton(
                  label: unseen.length > 1
                      ? 'Đã xem (${unseen.length})'
                      : 'Đã xem',
                  variant: CtmsButtonVariant.danger,
                  onPressed: controller.markAllSeen,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          CtmsSectionCard(
            title: 'Cảnh báo khẩn từ Host',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Làm theo hướng dẫn mới nhất của Host.', style: _caption),
                const SizedBox(height: AppSpacing.sm),
                _BroadcastRow(broadcast: latest, emphasized: true),
                for (final item in older) _BroadcastRow(broadcast: item),
                if (controller.lastRefreshFailed)
                  Text(
                    'Không cập nhật được, đang hiển thị danh sách đã tải trước đó.',
                    key: const Key('emergency-broadcasts-stale'),
                    style: _caption,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BroadcastRow extends StatelessWidget {
  const _BroadcastRow({required this.broadcast, this.emphasized = false});

  final EmergencyBroadcast broadcast;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    return Padding(
      key: Key('emergency-broadcast-${broadcast.id}'),
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  emergencyAlertTypeLabel(broadcast.alertType),
                  style: _bodyStrong.copyWith(
                    color: emphasized ? AppColors.statusDanger : null,
                  ),
                ),
              ),
              Text(_time(broadcast.createdAt), style: _caption),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(broadcast.content, style: emphasized ? _bodyStrong : _body),
        ],
      ),
    );
  }
}
