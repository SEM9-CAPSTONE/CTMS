import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/widgets/ctms_section_card.dart';
import '../emergency_broadcasts/application/emergency_broadcasts_controller.dart';
import '../emergency_broadcasts/data/emergency_broadcasts_api.dart';
import 'missed_alerts_controller.dart';

class MissedAlertsPanel extends ConsumerWidget {
  const MissedAlertsPanel({super.key, required this.tripId});

  final String tripId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(missedAlertsControllerProvider);
    if (controller == null) return const SizedBox.shrink();
    final displayedBroadcasts = ref
        .watch(emergencyBroadcastsControllerProvider(tripId))
        .broadcasts
        .map((item) => 'broadcast:${item.id}')
        .toSet();
    final items = controller.items
        .where((item) => !displayedBroadcasts.contains(item.key))
        .toList();
    if (items.isEmpty &&
        displayedBroadcasts.isNotEmpty &&
        !controller.loading &&
        !controller.failed &&
        !controller.hasNew &&
        !controller.canLoadMore) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: CtmsSectionCard(
        title: 'Cảnh báo đã bỏ lỡ',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (controller.loading) ...[
              const LinearProgressIndicator(),
              const Text('Đang khôi phục cảnh báo…'),
            ],
            if (controller.failed) ...[
              Text(
                controller.failedSources.isEmpty
                    ? 'Chưa tải được cảnh báo.'
                    : 'Một số cảnh báo chưa tải được.',
              ),
              TextButton(
                onPressed: controller.loading ? null : controller.retry,
                child: const Text('Thử lại'),
              ),
            ],
            if (controller.hasNew)
              TextButton(
                onPressed: controller.showNew,
                child: const Text('Xem cảnh báo mới'),
              ),
            if (!controller.loading && !controller.failed && items.isEmpty)
              Text(
                displayedBroadcasts.isEmpty
                    ? 'Không có cảnh báo bỏ lỡ trong 24 giờ qua.'
                    : 'Các cảnh báo khẩn của chuyến đã có trong danh sách phía trên.',
              ),
            for (final item in items)
              ListTile(
                key: ValueKey(item.key),
                contentPadding: EdgeInsets.zero,
                title: Text(_title(item)),
                subtitle: Text(
                  [
                    if (item.details['content'] case final String content)
                      content,
                    DateFormat(
                      'HH:mm dd/MM/yyyy',
                    ).format(item.occurredAt.toLocal()),
                    if (item.unread) 'Chưa đọc',
                  ].join('\n'),
                ),
              ),
            if (controller.canLoadMore)
              TextButton(
                onPressed: controller.loading ? null : controller.loadMore,
                child: const Text('Tải thêm'),
              ),
          ],
        ),
      ),
    );
  }

  String _title(MissedAlert item) => switch (item.source) {
    'broadcast' => emergencyAlertTypeLabel(
      item.details['alertType'] as String? ?? '',
    ),
    'sos' => switch (item.details['transition']) {
      'SOS_CANCELLED' => 'Đã hủy yêu cầu cứu trợ',
      'SOS_ACKNOWLEDGED' => 'Yêu cầu cứu trợ đã được tiếp nhận',
      'SOS_CLOSED' => 'Yêu cầu cứu trợ đã kết thúc',
      _ => 'Cập nhật yêu cầu cứu trợ',
    },
    _ => 'Thông báo chuyến đi',
  };
}
