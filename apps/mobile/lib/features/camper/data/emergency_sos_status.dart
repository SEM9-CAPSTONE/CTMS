import '../../sos/domain/sos_alert.dart';

String? emergencySosStatus(
  Iterable<LocalSosAlert> local,
  Iterable<SosAlert> server,
) {
  final choices = <String, ({DateTime time, String? message})>{
    for (final record in local)
      record.id: (
        time: record.eventTime,
        message: switch (record.syncState) {
          SosSyncState.pending => 'SOS đã lưu trên thiết bị, đang chờ gửi.',
          SosSyncState.failed => 'Chưa gửi được SOS.',
          SosSyncState.synced =>
            record.serverAlert == null
                ? null
                : _serverDelivery(record.serverAlert!),
        },
      ),
    for (final alert in server)
      alert.id: (time: alert.eventTime, message: _serverDelivery(alert)),
  };
  final dated = choices.values.where((value) => value.message != null).toList()
    ..sort((left, right) => right.time.compareTo(left.time));
  return dated.firstOrNull?.message;
}

String? _serverDelivery(SosAlert alert) {
  if (alert.isLocalPending) return 'SOS đã lưu trên thiết bị, đang chờ gửi.';
  return switch (alert.status) {
    'active' => 'Hệ thống đã nhận SOS. Chủ chuyến chưa xác nhận.',
    'acknowledged' => 'Chủ chuyến đã xác nhận SOS.',
    'cancelled' => 'SOS đã được hủy.',
    'closed' => 'SOS đã được đóng.',
    _ => null,
  };
}
