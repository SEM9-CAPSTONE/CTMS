import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../incidents/application/incidents_controller.dart';
import '../../incidents/domain/trip_incident.dart';
import '../../incidents/presentation/incident_tile.dart';
import '../../incidents/presentation/report_incident_form.dart';

class PorterIncidentsScreen extends ConsumerStatefulWidget {
  const PorterIncidentsScreen({super.key});
  @override
  ConsumerState<PorterIncidentsScreen> createState() =>
      _PorterIncidentsScreenState();
}

class _PorterIncidentsScreenState extends ConsumerState<PorterIncidentsScreen> {
  String? _tripId;
  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(incidentsControllerProvider);
    if (controller == null) {
      return const CtmsScaffold(
        title: 'Sự cố',
        body: Center(child: Text('Vui lòng đăng nhập với vai trò Porter.')),
      );
    }
    final trips = [...controller.trips];
    for (final record in controller.records) {
      if (!trips.any((trip) => trip.id == record.tripId)) {
        trips.add(
          IncidentTrip(
            id: record.tripId,
            title: 'Chuyến đi đã lưu · ${record.tripId}',
            status: 'unavailable',
          ),
        );
      }
    }
    final trip = trips.where((v) => v.id == _tripId).firstOrNull;
    final items = <String, LocalIncident>{
      for (final record in controller.records.where((v) => v.tripId == _tripId))
        record.id: record,
    };
    for (final server
        in controller.serverRecords[_tripId] ?? <IncidentJson>[]) {
      final id = server['id'] as String;
      items.putIfAbsent(
        id,
        () => LocalIncident(
          tripId: _tripId!,
          payload: server,
          server: server,
          syncState: IncidentSyncState.synced,
        ),
      );
    }
    final sorted = items.values.toList()
      ..sort(
        (a, b) => (b.payload['occurredAt'] as String).compareTo(
          a.payload['occurredAt'] as String,
        ),
      );
    return CtmsScaffold(
      title: 'Sự cố',
      isConnected: controller.online,
      actions: [
        IconButton(
          tooltip: 'Đồng bộ',
          onPressed: controller.syncing
              ? null
              : () async {
                  await controller.refresh();
                  if (_tripId != null) await controller.loadTrip(_tripId!);
                },
          icon: const Icon(Icons.sync),
        ),
      ],
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (!controller.ready && controller.error == null)
            const LinearProgressIndicator(),
          Text(
            controller.online
                ? 'Thiết bị có Wi-Fi / dữ liệu di động'
                : 'Ngoại tuyến · Sự cố được lưu trên thiết bị',
          ),
          if (controller.error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                controller.error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          const SizedBox(height: 16),
          if (trips.isEmpty && controller.ready)
            const Text(
              'Chưa có chuyến đi được phân công trên thiết bị. Kết nối mạng để tải phân công.',
            ),
          DropdownButtonFormField<String>(
            key: ValueKey(
              '${controller.hashCode}:$_tripId:${trips.map((v) => v.id).join()}',
            ),
            initialValue: trip?.id,
            isExpanded: true,
            decoration: const InputDecoration(
              labelText: 'Chuyến đi được phân công',
            ),
            items: trips
                .map(
                  (v) => DropdownMenuItem(
                    value: v.id,
                    child: Text(v.title, overflow: TextOverflow.ellipsis),
                  ),
                )
                .toList(),
            onChanged: (value) {
              setState(() => _tripId = value);
              if (value != null) controller.loadTrip(value);
            },
          ),
          const SizedBox(height: 16),
          if (trip != null && trip.canReport && controller.ready)
            CtmsButton(
              icon: Icons.add,
              label: 'Báo cáo sự cố',
              variant: CtmsButtonVariant.primary,
              onPressed: () async {
                final saved = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) =>
                        ReportIncidentForm(trip: trip, controller: controller),
                  ),
                );
                if (saved == true && context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Đã lưu trên thiết bị. Trạng thái đổi khi máy chủ xác nhận.',
                      ),
                    ),
                  );
                }
              },
            ),
          if (trip != null && !trip.canReport)
            const Text('Chỉ có thể báo cáo mới khi chuyến đi đang diễn ra.'),
          const SizedBox(height: 16),
          if (_tripId != null && sorted.isEmpty)
            const Text('Chưa có sự cố nào được báo cáo.'),
          for (final record in sorted)
            IncidentTile(
              record: record,
              onRetry: controller.syncing
                  ? null
                  : () async {
                      try {
                        await controller.retry(record.id);
                      } catch (_) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Không thể cập nhật bộ nhớ. Vui lòng thử lại.',
                              ),
                            ),
                          );
                        }
                      }
                    },
            ),
        ],
      ),
    );
  }
}
