import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../application/gps_tracking_controller.dart';
import '../domain/gps_tracking_models.dart';

/// A sample older than this is shown as stale instead of current.
const gpsStaleAfter = Duration(seconds: 30);

const _ineligibleReasons = {
  'TRIP_NOT_ONGOING': 'Chuyến đi chưa diễn ra hoặc đã kết thúc.',
  'CAMPER_NOT_JOINED': 'Bạn chưa check-in tham gia chuyến đi.',
  'PORTER_NOT_ASSIGNED': 'Bạn chưa được phân công cho chuyến đi này.',
};

const _rejectionReasons = {
  'TRIP_NOT_TRACKABLE': 'Chuyến đi không còn nhận dữ liệu GPS',
  'PARTICIPATION_NOT_ELIGIBLE': 'Không còn đủ điều kiện tham gia',
  'EVENT_TIME_OUTSIDE_PARTICIPATION': 'Ngoài thời gian tham gia',
  'ID_CONFLICT': 'Trùng mã bản ghi',
};

String _two(int value) => value.toString().padLeft(2, '0');

String formatGpsTime(DateTime value) {
  final local = value.toLocal();
  return '${_two(local.hour)}:${_two(local.minute)}:${_two(local.second)} '
      '${_two(local.day)}/${_two(local.month)}';
}

String formatGpsCoordinate(double latitude, double longitude) =>
    '${latitude.toStringAsFixed(5)}, ${longitude.toStringAsFixed(5)}';

/// Breadcrumb recording state for one Trip: tracking status, latest sample with
/// its freshness, local buffer counts and the most recent logs.
class GpsTrackingPanel extends ConsumerStatefulWidget {
  const GpsTrackingPanel({super.key, required this.tripId, this.now});

  final String tripId;

  /// Test hook for the freshness clock.
  final DateTime Function()? now;

  @override
  ConsumerState<GpsTrackingPanel> createState() => _GpsTrackingPanelState();
}

class _GpsTrackingPanelState extends ConsumerState<GpsTrackingPanel> {
  bool _showAll = false;

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(gpsTrackingControllerProvider(widget.tripId));
    final scheme = Theme.of(context).colorScheme;
    final now = (widget.now ?? DateTime.now)();
    final recent = controller.logs.reversed.toList();
    final shown = _showAll ? recent : recent.take(5).toList();
    final (label, badgeStatus) = _statusBadge(controller.status);

    return CtmsSectionCard(
      title: 'Ghi GPS hành trình',
      trailing: CtmsStatusBadge(
        key: const Key('gps-tracking-status'),
        label: label,
        status: badgeStatus,
        showDot: controller.status == GpsTrackingStatus.active,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ..._statusNotice(context, controller),
          if (controller.status == GpsTrackingStatus.active) ...[
            _SampleRow(controller: controller, now: now),
            const SizedBox(height: AppSpacing.md),
          ],
          Row(
            children: [
              Expanded(
                child: _CountTile(
                  key: const Key('gps-count-pending'),
                  label: 'Chờ đồng bộ',
                  value: controller.pendingCount,
                  status: CtmsStatus.warning,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _CountTile(
                  key: const Key('gps-count-synced'),
                  label: 'Đã đồng bộ',
                  value: controller.syncedCount,
                  status: CtmsStatus.success,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _CountTile(
                  key: const Key('gps-count-failed'),
                  label: 'Bị từ chối',
                  value: controller.failedCount,
                  status: CtmsStatus.danger,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Bản ghi GPS (${controller.logs.length})',
                  style: AppTypography.caption.copyWith(
                    fontWeight: FontWeight.w800,
                    color: scheme.onSurface,
                  ),
                ),
              ),
              if (recent.length > 5)
                TextButton(
                  onPressed: () => setState(() => _showAll = !_showAll),
                  child: Text(_showAll ? 'Thu gọn' : 'Xem tất cả'),
                ),
            ],
          ),
          if (recent.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              child: Text(
                'Chưa có bản ghi GPS nào cho chuyến đi này.',
                style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
              ),
            )
          else
            ...shown.map((log) => _LogTile(log: log)),
          const SizedBox(height: AppSpacing.md),
          CtmsButton(
            key: const Key('gps-sync-now'),
            label: 'Đồng bộ ngay',
            icon: Icons.cloud_upload_outlined,
            variant: CtmsButtonVariant.secondary,
            isLoading: controller.syncing,
            onPressed: controller.pendingCount == 0 || controller.syncing
                ? null
                : () => unawaited(controller.syncNow(force: true)),
          ),
        ],
      ),
    );
  }

  (String, CtmsStatus) _statusBadge(GpsTrackingStatus status) => switch (status) {
    GpsTrackingStatus.checking => ('Đang kiểm tra', CtmsStatus.neutral),
    GpsTrackingStatus.active => ('Đang ghi', CtmsStatus.success),
    GpsTrackingStatus.notEligible => ('Không ghi', CtmsStatus.neutral),
    GpsTrackingStatus.permissionDenied ||
    GpsTrackingStatus.permissionDeniedForever => ('Chưa cấp quyền', CtmsStatus.warning),
    GpsTrackingStatus.serviceDisabled => ('GPS tắt', CtmsStatus.warning),
    GpsTrackingStatus.unavailable => ('Chưa kết nối', CtmsStatus.danger),
  };

  List<Widget> _statusNotice(BuildContext context, GpsTrackingController controller) {
    Widget banner(CtmsAlertSeverity severity, String title, String message, [List<Widget> actions = const []]) =>
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.md),
          child: CtmsAlertBanner(severity: severity, title: title, message: message, actions: actions),
        );
    return switch (controller.status) {
      GpsTrackingStatus.notEligible => [
        banner(
          CtmsAlertSeverity.info,
          'Không ghi GPS lúc này',
          _ineligibleReasons[controller.context?.reason] ?? 'Bạn chưa đủ điều kiện ghi GPS cho chuyến đi.',
        ),
      ],
      GpsTrackingStatus.permissionDenied => [
        banner(
          CtmsAlertSeverity.warning,
          'Cần quyền vị trí',
          'Cho phép CTMS truy cập vị trí để ghi lại hành trình an toàn của bạn.',
          [
            CtmsButton(
              key: const Key('gps-request-permission'),
              label: 'Cấp quyền vị trí',
              icon: Icons.my_location_outlined,
              onPressed: () => unawaited(controller.requestPermission()),
            ),
          ],
        ),
      ],
      GpsTrackingStatus.permissionDeniedForever => [
        banner(
          CtmsAlertSeverity.warning,
          'Quyền vị trí đã bị chặn',
          'Mở Cài đặt của điện thoại và cho phép CTMS truy cập vị trí để ghi GPS.',
        ),
      ],
      GpsTrackingStatus.serviceDisabled => [
        banner(
          CtmsAlertSeverity.warning,
          'GPS đang tắt',
          'Bật dịch vụ định vị của điện thoại để tiếp tục ghi hành trình.',
          [
            CtmsButton(
              label: 'Kiểm tra lại',
              variant: CtmsButtonVariant.soft,
              onPressed: () => unawaited(controller.refreshEligibility()),
            ),
          ],
        ),
      ],
      GpsTrackingStatus.unavailable => [
        banner(
          CtmsAlertSeverity.danger,
          'Chưa kết nối máy chủ',
          controller.error ?? 'Không kiểm tra được điều kiện ghi GPS.',
          [
            CtmsButton(
              label: 'Thử lại',
              variant: CtmsButtonVariant.soft,
              onPressed: () => unawaited(controller.refreshEligibility()),
            ),
          ],
        ),
      ],
      _ => const [],
    };
  }
}

class _SampleRow extends StatelessWidget {
  const _SampleRow({required this.controller, required this.now});
  final GpsTrackingController controller;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final sample = controller.lastSample;
    final stale = sample == null || sample.ageAt(now) > gpsStaleAfter;
    final ageSeconds = sample?.ageAt(now).inSeconds;
    return Container(
      key: const Key('gps-last-sample'),
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest.withValues(alpha: 0.35),
        borderRadius: AppRadius.controlBorderRadius,
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.gps_fixed, size: 16, color: scheme.primary),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Mẫu GPS gần nhất',
                  style: AppTypography.caption.copyWith(fontWeight: FontWeight.w800, color: scheme.onSurface),
                ),
              ),
              CtmsStatusBadge(
                key: const Key('gps-sample-freshness'),
                label: sample == null ? 'Chưa có mẫu' : (stale ? 'Tín hiệu cũ ${ageSeconds}s' : 'Mới'),
                status: stale ? CtmsStatus.warning : CtmsStatus.success,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            sample == null
                ? 'Đang chờ tín hiệu GPS đầu tiên...'
                : '${formatGpsCoordinate(sample.latitude, sample.longitude)} · ±${sample.accuracyMeters.round()} m'
                      '${sample.altitudeMeters != null ? ' · ${sample.altitudeMeters!.round()} m' : ''}',
            style: AppTypography.body.copyWith(color: scheme.onSurface),
          ),
          if (sample != null)
            Text(
              'Đo lúc ${formatGpsTime(sample.capturedAt)}',
              style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
            ),
          if (controller.lastBoundarySkipped)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Text(
                'Không có mẫu GPS mới ở lần ghi gần nhất nên không tạo bản ghi.',
                key: const Key('gps-boundary-skipped'),
                style: AppTypography.caption.copyWith(color: scheme.error, fontWeight: FontWeight.w600),
              ),
            ),
        ],
      ),
    );
  }
}

class _CountTile extends StatelessWidget {
  const _CountTile({super.key, required this.label, required this.value, required this.status});
  final String label;
  final int value;
  final CtmsStatus status;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.md),
      decoration: BoxDecoration(
        borderRadius: AppRadius.controlBorderRadius,
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: Column(
        children: [
          Text(
            '$value',
            style: AppTypography.h3.copyWith(fontWeight: FontWeight.w800, color: scheme.onSurface),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _LogTile extends StatelessWidget {
  const _LogTile({required this.log});
  final LocalGpsLog log;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final (label, status) = switch (log.syncState) {
      GpsLogSyncState.synced => ('Đã đồng bộ', CtmsStatus.success),
      GpsLogSyncState.pending => ('Chờ đồng bộ', CtmsStatus.warning),
      GpsLogSyncState.failed => (
        _rejectionReasons[log.rejectionReason] ?? 'Lỗi đồng bộ',
        CtmsStatus.danger,
      ),
    };
    return Padding(
      key: Key('gps-log-${log.id}'),
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          Icon(Icons.place_outlined, size: 18, color: scheme.onSurfaceVariant),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  formatGpsCoordinate(log.latitude, log.longitude),
                  style: AppTypography.body.copyWith(color: scheme.onSurface, fontWeight: FontWeight.w600),
                ),
                Text(
                  '${formatGpsTime(log.eventTime)} · ±${log.accuracyMeters.round()} m',
                  style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
          CtmsStatusBadge(label: label, status: status),
        ],
      ),
    );
  }
}
