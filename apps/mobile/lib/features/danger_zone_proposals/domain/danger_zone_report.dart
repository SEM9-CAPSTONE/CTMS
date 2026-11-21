typedef ReportJson = Map<String, dynamic>;

const hazardLabels = {
  'ROUTE_OBSTRUCTION': 'Chướng ngại trên tuyến',
  'LOST_MEMBER': 'Nơi thành viên bị lạc',
  'SLIPPERY_OR_LANDSLIDE': 'Trơn trượt, sạt lở',
  'DAMAGED_BARRIER': 'Hư rào chắn',
  'WILDLIFE': 'Động vật hoang dã',
  'OTHER': 'Khác',
};
const hazardSeverityLabels = {
  'low': 'Thấp',
  'medium': 'Trung bình',
  'high': 'Cao',
};

/// At most this many photos are attached to one report; the server enforces the same limit.
const dangerReportMaxPhotos = 3;
const dangerReportPhotoMaxBytes = 5 * 1024 * 1024;

class DangerZoneReport {
  const DangerZoneReport({
    required this.tripId,
    required this.payload,
    this.server,
    this.failed = false,
    this.attempts = 0,
    this.nextAttemptAt,
    this.error,
    this.photoCount = 0,
    this.photosSent = 0,
    this.photoFailed = false,
    this.photoError,
  });
  final String tripId;
  final ReportJson payload;
  final ReportJson? server;
  final bool failed;
  final int attempts;
  final DateTime? nextAttemptAt;
  final String? error;

  /// Photos are saved on the device with the report and uploaded one by one after it.
  final int photoCount;
  final int photosSent;
  final bool photoFailed;
  final String? photoError;
  String get id => payload['clientRequestId'] as String;
  bool get photosPending =>
      server != null && photosSent < photoCount && !photoFailed;
  bool get pending => (server == null && !failed) || photosPending;
  bool get canRetry => server == null || photoFailed;
  String? get photoStatusLabel {
    if (photoCount == 0) return null;
    if (photosSent >= photoCount) return 'Đã gửi $photoCount ảnh';
    if (photoFailed) return 'Chưa gửi được ảnh ($photosSent/$photoCount)';
    return 'Đang chờ gửi ảnh ($photosSent/$photoCount)';
  }

  String get statusLabel => server == null
      ? (failed ? 'Gửi thất bại' : 'Chờ gửi')
      : switch (server!['status']) {
          'APPROVED' => 'Đã duyệt',
          'REJECTED' => 'Bị từ chối',
          _ => 'Chờ duyệt',
        };
  DangerZoneReport delivery({
    ReportJson? server,
    bool failed = false,
    int attempts = 0,
    DateTime? nextAttemptAt,
    String? error,
    int? photosSent,
    bool? photoFailed,
    String? photoError,
  }) => DangerZoneReport(
    tripId: tripId,
    payload: payload,
    server: server ?? this.server,
    failed: failed,
    attempts: attempts,
    nextAttemptAt: nextAttemptAt,
    error: error,
    photoCount: photoCount,
    photosSent: photosSent ?? this.photosSent,
    photoFailed: photoFailed ?? this.photoFailed,
    photoError: photoError ?? (photoFailed == false ? null : this.photoError),
  );
  ReportJson toJson() => {
    'tripId': tripId,
    'payload': payload,
    'server': server,
    'failed': failed,
    'attempts': attempts,
    'nextAttemptAt': nextAttemptAt?.toIso8601String(),
    'error': error,
    'photoCount': photoCount,
    'photosSent': photosSent,
    'photoFailed': photoFailed,
    'photoError': photoError,
  };
  factory DangerZoneReport.fromJson(ReportJson json) => DangerZoneReport(
    tripId: json['tripId'] as String,
    payload: Map<String, dynamic>.from(json['payload'] as Map),
    server: json['server'] == null
        ? null
        : Map<String, dynamic>.from(json['server'] as Map),
    failed: json['failed'] == true,
    attempts: json['attempts'] as int? ?? 0,
    nextAttemptAt: DateTime.tryParse(json['nextAttemptAt'] as String? ?? ''),
    error: json['error'] as String?,
    photoCount: json['photoCount'] as int? ?? 0,
    photosSent: json['photosSent'] as int? ?? 0,
    photoFailed: json['photoFailed'] == true,
    photoError: json['photoError'] as String?,
  );
}
