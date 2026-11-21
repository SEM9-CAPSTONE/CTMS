import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../offline_packages/presentation/package_policy_copy.dart';
import '../application/danger_zone_report_queue.dart';
import '../domain/danger_zone_report.dart';
import 'report_danger_zone_form.dart';

class DangerZoneReportsPanel extends ConsumerStatefulWidget {
  const DangerZoneReportsPanel({
    super.key,
    required this.tripId,
    required this.tripTitle,
    required this.canReport,
  });
  final String tripId;
  final String tripTitle;
  final bool canReport;
  @override
  ConsumerState<DangerZoneReportsPanel> createState() =>
      _DangerZoneReportsPanelState();
}

class _DangerZoneReportsPanelState
    extends ConsumerState<DangerZoneReportsPanel> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref
            .read(dangerZoneReportQueueProvider.notifier)
            ?.refresh(widget.tripId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final queue = ref.watch(dangerZoneReportQueueProvider);
    if (queue == null) return const SizedBox.shrink();
    final remote = queue.remote[widget.tripId] ?? [];
    final local = queue.restrictedTrips.contains(widget.tripId)
        ? <DangerZoneReport>[]
        : queue.records.where((v) => v.tripId == widget.tripId).toList();
    final rows = [
      ...local,
      for (final server in remote)
        if (!local.any((v) => v.id == server['clientRequestId']))
          DangerZoneReport(
            tripId: widget.tripId,
            payload: {
              'clientRequestId': server['clientRequestId'],
              'hazardType': server['hazardType'],
              'description': server['description'],
              'observedAt': server['observedAt'],
            },
            server: server,
            photoCount: (server['photos'] as List?)?.length ?? 0,
            photosSent: (server['photos'] as List?)?.length ?? 0,
          ),
    ];
    rows.sort(
      (a, b) => (b.payload['observedAt'] as String).compareTo(
        a.payload['observedAt'] as String,
      ),
    );
    final error = queue.listErrors[widget.tripId] ?? queue.loadError;
    return CtmsSectionCard(
      title: 'Điểm nguy hiểm đã báo',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.canReport &&
              !queue.restrictedTrips.contains(widget.tripId))
            FilledButton.icon(
              icon: const Icon(Icons.add_location_alt_outlined),
              label: const Text('Báo điểm nguy hiểm'),
              onPressed: () async {
                final saved = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) => ReportDangerZoneForm(
                      tripId: widget.tripId,
                      tripTitle: widget.tripTitle,
                      queue: queue,
                    ),
                  ),
                );
                if (context.mounted && saved == true) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      backgroundColor: Colors.green,
                      content: Text(
                        'Đã lưu báo cáo. Ứng dụng sẽ gửi khi có kết nối.',
                      ),
                    ),
                  );
                }
              },
            ),
          if (error != null) Text(error),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: () => queue.refresh(widget.tripId),
              icon: const Icon(Icons.refresh),
              label: const Text('Làm mới báo cáo'),
            ),
          ),
          if (rows.isEmpty && error == null)
            const Text('Chưa có báo cáo điểm nguy hiểm.'),
          for (final row in rows)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    hazardLabels[row.payload['hazardType']] ?? 'Điểm nguy hiểm',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  Text(
                    '${row.statusLabel} · ${packageTime(row.payload['observedAt'] as String)}',
                  ),
                  Text(row.payload['description'] as String),
                  if (row.server?['reviewReason'] case final String reason)
                    Text('Lý do: $reason'),
                  if (row.error != null) Text(row.error!),
                  if (row.photoStatusLabel case final String photos)
                    Text(photos),
                  if (row.photoError != null) Text(row.photoError!),
                  if (row.canRetry)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        onPressed: () async {
                          try {
                            await queue.retry(row);
                          } catch (_) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  backgroundColor: Colors.red,
                                  content: Text(
                                    'Chưa lưu được lần thử lại. Vui lòng thử lại.',
                                  ),
                                ),
                              );
                            }
                          }
                        },
                        child: const Text('Thử gửi lại'),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
