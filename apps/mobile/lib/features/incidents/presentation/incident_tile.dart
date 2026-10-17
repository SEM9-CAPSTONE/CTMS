import 'package:flutter/material.dart';
import '../domain/trip_incident.dart';

class IncidentTile extends StatelessWidget {
  const IncidentTile({super.key, required this.record, this.onRetry});
  final LocalIncident record;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) {
    final status = switch (record.syncState) {
      IncidentSyncState.pending => 'Chờ đồng bộ · Đã lưu trên thiết bị',
      IncidentSyncState.synced => 'Đã đồng bộ',
      IncidentSyncState.failed => 'Đồng bộ thất bại',
    };
    final failed =
        record.syncState == IncidentSyncState.failed ||
        record.mediaState == IncidentMediaState.failed;
    final location = record.payload['location'];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${incidentCategories[record.payload['category']]} · ${incidentSeverities[record.payload['severity']]}',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            Text(record.payload['description'] as String),
            Text(
              DateTime.parse(
                record.payload['occurredAt'] as String,
              ).toLocal().toString(),
            ),
            Text(
              location == null
                  ? 'Vị trí không khả dụng'
                  : 'Vị trí: ${(location as Map)['latitude']}, ${location['longitude']}',
            ),
            if (record.server?['locationStatus'] == 'stale')
              const Text('Vị trí đã cũ'),
            const SizedBox(height: 8),
            Text(
              status,
              style: TextStyle(
                color: failed ? Theme.of(context).colorScheme.error : null,
                fontWeight: FontWeight.bold,
              ),
            ),
            if (record.mediaState == IncidentMediaState.pending)
              const Text('Ảnh chờ đồng bộ'),
            if (record.mediaState == IncidentMediaState.failed)
              const Text(
                'Ảnh tải lên thất bại. Báo cáo sự cố đã được lưu trên máy chủ.',
              ),
            if (record.mediaState == IncidentMediaState.uploaded)
              const Text('Ảnh đã tải lên'),
            if (record.error != null) Text(record.error!),
            if (failed || record.hasWork)
              TextButton(
                onPressed: onRetry,
                child: const Text('Thử đồng bộ lại'),
              ),
          ],
        ),
      ),
    );
  }
}
