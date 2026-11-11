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
import '../../gps_tracking/presentation/gps_tracking_panel.dart';
import '../application/route_deviation_controller.dart';
import '../domain/route_deviation_detector.dart';
import '../domain/route_deviation_models.dart';

const _ineligibleReasons = {
  'TRIP_NOT_ONGOING': 'Chuyến đi chưa diễn ra hoặc đã kết thúc.',
  'CAMPER_NOT_JOINED': 'Bạn chưa check-in tham gia chuyến đi.',
  'PORTER_NOT_ASSIGNED': 'Bạn chưa được phân công cho chuyến đi này.',
};

const _rejectionReasons = {
  'TRIP_NOT_TRACKABLE': 'Chuyến đi không còn nhận dữ liệu',
  'PARTICIPATION_NOT_ELIGIBLE': 'Không còn đủ điều kiện tham gia',
  'EVENT_TIME_OUTSIDE_PARTICIPATION': 'Ngoài thời gian tham gia',
  'ROUTE_VERSION_MISMATCH': 'Tuyến đã thay đổi',
  'THRESHOLD_NOT_MET': 'Dữ liệu không đạt ngưỡng',
  'ID_CONFLICT': 'Trùng mã sự kiện',
};

const _eventLabels = {
  SafetyEventType.offRoute: 'Lệch tuyến',
  SafetyEventType.onRouteRecovered: 'Đã quay lại tuyến',
  SafetyEventType.gpsDegraded: 'Tín hiệu GPS yếu',
  SafetyEventType.gpsRestored: 'GPS ổn định trở lại',
};

/// Safe action shown with a confirmed OFF_ROUTE (BR-384). Directions back to the
/// Route belong to CTMS-062.
String offRouteWarningMessage(double? distanceMeters) =>
    'Bạn có thể đã đi lệch tuyến'
    '${distanceMeters == null ? '' : ' (cách tuyến khoảng ${distanceMeters.round()} m)'}. '
    'Dừng lại, kiểm tra xung quanh và quay về đoạn tuyến gần nhất. '
    'Nếu không chắc chắn, liên hệ Host/Porter hoặc dùng SOS.';

/// On-device route-deviation state for one Trip (CTMS-060): navigation and GPS
/// quality states, the current detection progress, the local OFF_ROUTE warning
/// and the safety events with their synchronization state.
class RouteDeviationPanel extends ConsumerStatefulWidget {
  const RouteDeviationPanel({super.key, required this.tripId});

  final String tripId;

  @override
  ConsumerState<RouteDeviationPanel> createState() => _RouteDeviationPanelState();
}

class _RouteDeviationPanelState extends ConsumerState<RouteDeviationPanel> {
  String? _dialogShownFor;
  bool _showAll = false;

  void _maybeShowWarning(RouteDeviationController controller) {
    final warning = controller.activeWarning;
    if (warning == null || warning.id == _dialogShownFor) return;
    _dialogShownFor = warning.id;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(
        showDialog<void>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            key: const Key('off-route-dialog'),
            icon: const Icon(Icons.wrong_location_outlined, size: 36),
            title: const Text('Cảnh báo lệch tuyến'),
            content: Text(offRouteWarningMessage(warning.distanceToRouteMeters)),
            actions: [
              TextButton(
                key: const Key('off-route-dialog-dismiss'),
                onPressed: () {
                  controller.dismissWarning();
                  Navigator.of(dialogContext).pop();
                },
                child: const Text('Đã hiểu'),
              ),
            ],
          ),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(routeDeviationControllerProvider(widget.tripId));
    _maybeShowWarning(controller);
    final (label, badgeStatus) = _statusBadge(controller);
    final recent = controller.events.reversed.toList();
    final shown = _showAll ? recent : recent.take(5).toList();

    return CtmsSectionCard(
      title: 'Cảnh báo lệch tuyến',
      trailing: CtmsStatusBadge(
        key: const Key('route-deviation-status'),
        label: label,
        status: badgeStatus,
        showDot: controller.status == RouteDeviationStatus.active,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ..._notices(controller),
          if (controller.status == RouteDeviationStatus.active && controller.detector != null) ...[
            _DetectionRow(detector: controller.detector!),
            const SizedBox(height: AppSpacing.md),
          ],
          Row(
            children: [
              Expanded(
                child: Text(
                  'Sự kiện an toàn (${controller.events.length})',
                  style: AppTypography.caption.copyWith(
                    fontWeight: FontWeight.w800,
                    color: Theme.of(context).colorScheme.onSurface,
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
                'Chưa có sự kiện lệch tuyến hay mất tín hiệu GPS nào.',
                style: AppTypography.caption.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            )
          else
            ...shown.map((event) => _EventTile(event: event)),
          const SizedBox(height: AppSpacing.md),
          CtmsButton(
            key: const Key('route-deviation-sync-now'),
            label: 'Đồng bộ sự kiện',
            icon: Icons.cloud_upload_outlined,
            isLoading: controller.syncing,
            onPressed: controller.pendingCount == 0 || controller.syncing
                ? null
                : () => unawaited(controller.syncNow(force: true)),
          ),
        ],
      ),
    );
  }

  (String, CtmsStatus) _statusBadge(RouteDeviationController controller) =>
      switch (controller.status) {
        RouteDeviationStatus.checking => ('Đang kiểm tra', CtmsStatus.neutral),
        RouteDeviationStatus.active => switch (controller.navigation) {
          RouteNavigationState.onRoute => ('Đúng tuyến', CtmsStatus.success),
          RouteNavigationState.offRoute => ('Có thể lệch tuyến', CtmsStatus.danger),
        },
        RouteDeviationStatus.paused => ('Tạm dừng', CtmsStatus.neutral),
        RouteDeviationStatus.notEligible => ('Không theo dõi', CtmsStatus.neutral),
        RouteDeviationStatus.unavailable => ('Chưa có dữ liệu tuyến', CtmsStatus.danger),
      };

  List<Widget> _notices(RouteDeviationController controller) {
    Widget banner(
      Key key,
      CtmsAlertSeverity severity,
      String title,
      String message, [
      List<Widget> actions = const [],
    ]) => Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: CtmsAlertBanner(
        key: key,
        severity: severity,
        title: title,
        message: message,
        actions: actions,
      ),
    );

    final tracking =
        controller.status == RouteDeviationStatus.active ||
        controller.status == RouteDeviationStatus.paused;
    return [
      if (tracking && controller.navigation == RouteNavigationState.offRoute)
        banner(
          const Key('off-route-banner'),
          CtmsAlertSeverity.danger,
          'Có thể bạn đã lệch tuyến',
          offRouteWarningMessage(
            controller.activeWarning?.distanceToRouteMeters ??
                controller.detector?.lastDistanceMeters,
          ),
        ),
      if (tracking && controller.quality == GpsQualityState.degraded)
        banner(
          const Key('gps-degraded-banner'),
          CtmsAlertSeverity.warning,
          'Tín hiệu GPS yếu',
          'Đã hơn 2 phút không có vị trí đủ chính xác (±20 m) nên chưa xác định được bạn có '
              'đi đúng tuyến hay không. Hãy ra chỗ thoáng, giữ điện thoại ổn định và tiếp tục '
              'đi theo tuyến đã biết.',
        ),
      ...switch (controller.status) {
        RouteDeviationStatus.paused => [
          banner(
            const Key('route-deviation-paused'),
            CtmsAlertSeverity.info,
            'Đang tạm dừng phát hiện lệch tuyến',
            'Phát hiện lệch tuyến chạy cùng lúc với ghi GPS hành trình ở trên.',
          ),
        ],
        RouteDeviationStatus.notEligible => [
          banner(
            const Key('route-deviation-not-eligible'),
            CtmsAlertSeverity.info,
            'Không theo dõi lệch tuyến lúc này',
            _ineligibleReasons[controller.context?.reason] ??
                'Bạn chưa đủ điều kiện theo dõi lệch tuyến cho chuyến đi.',
          ),
        ],
        RouteDeviationStatus.unavailable => [
          banner(
            const Key('route-deviation-unavailable'),
            CtmsAlertSeverity.danger,
            'Chưa có dữ liệu tuyến',
            controller.error ?? 'Không tải được dữ liệu tuyến.',
            [
              CtmsButton(
                label: 'Thử lại',
                onPressed: () => unawaited(controller.refreshContext()),
              ),
            ],
          ),
        ],
        _ => const <Widget>[],
      },
    ];
  }
}

class _DetectionRow extends StatelessWidget {
  const _DetectionRow({required this.detector});
  final RouteDeviationDetector detector;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final sample = detector.lastSample;
    final distance = detector.lastDistanceMeters;
    final valid = detector.lastSampleValid;
    final progress = switch (detector.navigation) {
      RouteNavigationState.onRoute when detector.offRouteCount > 0 =>
        'Đang xác nhận lệch tuyến: ${detector.offRouteCount}/$routeDeviationConsecutiveSamples '
            'mẫu cách tuyến hơn ${offRouteMinDistanceMeters.round()} m',
      RouteNavigationState.offRoute when detector.recoveryCount > 0 =>
        'Đang xác nhận quay lại tuyến: ${detector.recoveryCount}/$routeDeviationConsecutiveSamples '
            'mẫu trong ${onRouteMaxDistanceMeters.round()} m',
      _ when distance != null &&
              valid == true &&
              distance >= onRouteMaxDistanceMeters &&
              distance <= offRouteMinDistanceMeters =>
        'Vùng đệm ${onRouteMaxDistanceMeters.round()}–${offRouteMinDistanceMeters.round()} m: '
            'giữ nguyên trạng thái hiện tại',
      _ => null,
    };

    return Container(
      key: const Key('route-deviation-detection'),
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        borderRadius: AppRadius.controlBorderRadius,
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.route_outlined, size: 16, color: scheme.onSurface),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  // An INVALID sample says nothing about the distance; never show the
                  // previous VALID distance as if it were current.
                  distance == null || valid == false
                      ? (valid == false
                            ? 'Chưa xác định được khoảng cách tới tuyến'
                            : 'Đang chờ mẫu GPS hợp lệ...')
                      : 'Cách tuyến khoảng ${distance.round()} m',
                  key: const Key('route-deviation-distance'),
                  style: AppTypography.body.copyWith(
                    color: scheme.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (valid != null)
                CtmsStatusBadge(
                  key: const Key('route-deviation-sample-validity'),
                  label: valid ? 'Mẫu hợp lệ' : 'Mẫu không đủ chính xác',
                  status: valid ? CtmsStatus.success : CtmsStatus.warning,
                ),
            ],
          ),
          if (sample != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Text(
                'Độ chính xác ±${sample.accuracyMeters.round()} m · đo lúc ${formatGpsTime(sample.capturedAt)}'
                '${valid == false ? ' · bỏ qua, đếm lại từ đầu' : ''}',
                style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
              ),
            ),
          if (progress != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Text(
                progress,
                key: const Key('route-deviation-progress'),
                style: AppTypography.caption.copyWith(
                  color: scheme.onSurface,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({required this.event});
  final LocalSafetyEvent event;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    // Never present a device-only event as server-confirmed (BR-226).
    final (label, status) = switch (event.syncState) {
      SafetyEventSyncState.synced => ('Đã đồng bộ', CtmsStatus.success),
      SafetyEventSyncState.pending => ('Chờ đồng bộ', CtmsStatus.warning),
      SafetyEventSyncState.failed => (
        _rejectionReasons[event.rejectionReason] ?? 'Lỗi đồng bộ',
        CtmsStatus.danger,
      ),
    };
    final icon = switch (event.type) {
      SafetyEventType.offRoute => Icons.wrong_location_outlined,
      SafetyEventType.onRouteRecovered => Icons.where_to_vote_outlined,
      SafetyEventType.gpsDegraded => Icons.gps_off,
      SafetyEventType.gpsRestored => Icons.gps_fixed,
    };
    final details = [
      formatGpsTime(event.eventTime),
      if (event.distanceToRouteMeters != null) '${event.distanceToRouteMeters!.round()} m',
      if (event.detectedOffline) 'phát hiện khi offline',
    ].join(' · ');
    return Padding(
      key: Key('safety-event-${event.id}'),
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          Icon(icon, size: 18, color: scheme.onSurface),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _eventLabels[event.type]!,
                  style: AppTypography.body.copyWith(
                    color: scheme.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  details,
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
