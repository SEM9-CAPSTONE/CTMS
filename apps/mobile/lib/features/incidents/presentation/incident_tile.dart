import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../domain/trip_incident.dart';

class IncidentApprovalInfo {
  const IncidentApprovalInfo({
    required this.label,
    required this.status,
    required this.isApproved,
    this.note,
  });

  final String label;
  final CtmsStatus status;
  final bool isApproved;
  final String? note;
}

IncidentApprovalInfo getIncidentApprovalInfo(LocalIncident record) {
  if (record.syncState == IncidentSyncState.pending) {
    return const IncidentApprovalInfo(
      label: 'Chưa đồng bộ máy chủ',
      status: CtmsStatus.neutral,
      isApproved: false,
      note: 'Lưu trên thiết bị · Sẽ gửi khi có mạng',
    );
  }

  final serverStatus = record.server?['status']?.toString() ??
      record.payload['status']?.toString() ??
      'open';
  final assignedToName = record.server?['assignedToName']?.toString();

  switch (serverStatus) {
    case 'open':
      return const IncidentApprovalInfo(
        label: 'Chờ Host duyệt',
        status: CtmsStatus.warning,
        isApproved: false,
        note: 'Host chưa tiếp nhận / chưa phân công',
      );
    case 'investigating':
      return IncidentApprovalInfo(
        label: 'Host đã duyệt • Đang xử lý',
        status: CtmsStatus.info,
        isApproved: true,
        note: assignedToName != null ? 'Người xử lý: $assignedToName' : 'Đang xử lý tại hiện trường',
      );
    case 'resolved':
      return const IncidentApprovalInfo(
        label: 'Host đã giải quyết',
        status: CtmsStatus.success,
        isApproved: true,
        note: 'Sự cố đã được khắc phục hoàn tất',
      );
    case 'closed':
      return const IncidentApprovalInfo(
        label: 'Đã đóng hồ sơ',
        status: CtmsStatus.neutral,
        isApproved: true,
        note: 'Hồ sơ sự cố đã được lưu trữ',
      );
    default:
      return const IncidentApprovalInfo(
        label: 'Chờ Host duyệt',
        status: CtmsStatus.warning,
        isApproved: false,
      );
  }
}

class IncidentTile extends StatelessWidget {
  const IncidentTile({
    super.key,
    required this.record,
    this.onRetry,
  });

  final LocalIncident record;
  final VoidCallback? onRetry;

  CtmsStatus _getSeverityStatus(String? severity) => switch (severity) {
    'critical' => CtmsStatus.danger,
    'high' => CtmsStatus.danger,
    'medium' => CtmsStatus.warning,
    'low' => CtmsStatus.neutral,
    _ => CtmsStatus.neutral,
  };

  String _formatDateTime(dynamic rawIso) {
    if (rawIso == null) return '';
    try {
      final dt = DateTime.parse(rawIso.toString()).toLocal();
      final day = dt.day.toString().padLeft(2, '0');
      final month = dt.month.toString().padLeft(2, '0');
      final hour = dt.hour.toString().padLeft(2, '0');
      final minute = dt.minute.toString().padLeft(2, '0');
      return '$hour:$minute • $day/$month/${dt.year}';
    } catch (_) {
      return rawIso.toString();
    }
  }

  String _formatLocation(dynamic loc) {
    if (loc == null || loc is! Map) return 'Vị trí không khả dụng';
    final lat = loc['latitude'];
    final lng = loc['longitude'];
    if (lat == null || lng == null) return 'Vị trí không khả dụng';
    final latStr = lat is num ? lat.toStringAsFixed(4) : lat.toString();
    final lngStr = lng is num ? lng.toStringAsFixed(4) : lng.toString();
    return 'GPS: $latStr, $lngStr';
  }

  @override
  Widget build(BuildContext context) {
    final approval = getIncidentApprovalInfo(record);
    final categoryKey = record.payload['category']?.toString();
    final severityKey = record.payload['severity']?.toString();
    final categoryName = incidentCategories[categoryKey] ?? 'Sự cố';
    final severityName = incidentSeverities[severityKey] ?? 'Bình thường';
    final description = record.payload['description']?.toString().trim() ?? '';
    final location = record.payload['location'];
    final timeStr = _formatDateTime(record.payload['occurredAt']);

    final failed = record.syncState == IncidentSyncState.failed ||
        record.mediaState == IncidentMediaState.failed;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row 1: Category + Severity Badge + Host Review Badge
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      categoryName,
                      style: AppTypography.h3.copyWith(
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        CtmsStatusBadge(
                          label: 'Mức: $severityName',
                          status: _getSeverityStatus(severityKey),
                          showDot: true,
                        ),
                        CtmsStatusBadge(
                          label: approval.label,
                          status: approval.status,
                          showDot: true,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          if (approval.note != null) ...[
            const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Icon(
                  approval.isApproved ? Icons.verified_user_outlined : Icons.pending_actions_outlined,
                  size: 14,
                  color: CtmsStatusBadge.colorFor(approval.status),
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    approval.note!,
                    style: AppTypography.caption.copyWith(
                      color: CtmsStatusBadge.colorFor(approval.status),
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],

          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.md),

          // Description
          Text(
            description,
            style: AppTypography.body.copyWith(
              color: AppColors.textPrimary,
              height: 1.4,
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          // Photo preview if available
          if (record.photo != null) ...[
            ClipRRect(
              borderRadius: AppRadius.cardBorderRadius,
              child: Image.memory(
                record.photo!,
                height: 120,
                width: 160,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],

          // Metadata row (Time + Location)
          Wrap(
            spacing: AppSpacing.lg,
            runSpacing: 4,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.access_time, size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    timeStr,
                    style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    _formatLocation(location),
                    style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ],
          ),

          // Sync State / Errors
          if (failed || record.hasWork || record.error != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: Text(
                    record.error ??
                        (record.syncState == IncidentSyncState.pending
                            ? 'Đang chờ đồng bộ lên máy chủ...'
                            : 'Đồng bộ thất bại. Vui lòng thử lại.'),
                    style: AppTypography.caption.copyWith(
                      color: failed ? AppColors.statusDanger : AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (failed || record.hasWork)
                  TextButton(
                    onPressed: onRetry,
                    child: Text(
                      'Thử lại',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.brandPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
