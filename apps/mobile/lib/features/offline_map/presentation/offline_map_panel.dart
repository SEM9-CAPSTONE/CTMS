import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../../../features/checkpoint_arrivals/presentation/checkpoint_arrival_panel.dart';
import '../../offline_packages/application/package_download_controller.dart';
import '../../offline_packages/presentation/offline_package_screen.dart';
import '../application/offline_map_controller.dart';
import '../domain/offline_map_models.dart';
import 'offline_map_screen.dart';
import 'widgets/offline_map_canvas.dart';
import 'widgets/offline_map_checkpoint_list.dart';
import '../../route_recovery/application/recovery_controller.dart';
import '../../route_recovery/presentation/recovery_card.dart';
import '../../route_recovery/domain/recovery_state.dart';

/// Card section displaying the verified offline map with route, checkpoints,
/// and live GPS position for a specific trip.
class OfflineMapPanel extends ConsumerStatefulWidget {
  const OfflineMapPanel({
    super.key,
    required this.tripId,
    this.tripTitle,
    this.clock,
    this.integrateArrivals = false,
    this.enableRecovery = false,
  });

  final String tripId;
  final String? tripTitle;
  final bool integrateArrivals;
  final bool enableRecovery;
  final DateTime Function()? clock;

  @override
  ConsumerState<OfflineMapPanel> createState() => _OfflineMapPanelState();
}

class _OfflineMapPanelState extends ConsumerState<OfflineMapPanel>
    with WidgetsBindingObserver {
  final _canvasKey = GlobalKey<OfflineMapCanvasState>();
  DateTime get _now => (widget.clock ?? DateTime.now)();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      final controller = ref.read(offlineMapControllerProvider(widget.tripId));
      controller.reloadPackage();
      controller.refreshLocation();
    }
  }

  void _openFullScreen(OfflineMapState state) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => OfflineMapScreen(
          tripId: widget.tripId,
          clock: widget.clock,
          integrateArrivals: widget.integrateArrivals,
          enableRecovery: widget.enableRecovery,
        ),
      ),
    );
  }

  Future<void> _openPackageScreen(OfflineMapController controller) async {
    final accountId = ref.read(offlinePackageAccountProvider);
    if (accountId == null) return;
    final tripId = widget.tripId;
    final tripTitle = widget.tripTitle ?? tripId;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => OfflinePackageScreen(
          tripId: tripId,
          accountId: accountId,
          tripTitle: tripTitle,
        ),
      ),
    );
    if (!mounted ||
        widget.tripId != tripId ||
        ref.read(offlinePackageAccountProvider) != accountId) {
      return;
    }
    await controller.reloadPackage(force: true);
  }

  Widget _buildPackageStatusNotice(
    BuildContext context,
    OfflineMapController controller,
    OfflineMapState state,
  ) {
    switch (state.packageStatus) {
      case OfflineMapPackageStatus.unsupportedPlatform:
        return const CtmsAlertBanner(
          severity: CtmsAlertSeverity.info,
          title: 'Bản đồ ngoại tuyến chưa hỗ trợ trên Web',
          message:
              'Vui lòng dùng ứng dụng Android/iOS để tải và mở gói bản đồ ngoại tuyến.',
        );
      case OfflineMapPackageStatus.loading:
        return const Padding(
          padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
          child: Center(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2.0),
                ),
                SizedBox(width: AppSpacing.sm),
                Flexible(
                  child: Text(
                    'Đang tải dữ liệu bản đồ ngoại tuyến…',
                    style: AppTypography.caption,
                  ),
                ),
              ],
            ),
          ),
        );

      case OfflineMapPackageStatus.packageMissing:
        return CtmsAlertBanner(
          severity: CtmsAlertSeverity.warning,
          title: 'Chưa có gói dữ liệu ngoại tuyến',
          message:
              'Vui lòng tải gói bản đồ của chuyến đi trước khi xuất phát để sử dụng ngoại tuyến.',
          actions: [
            CtmsButton(
              key: const Key('offline-map-download-package-btn'),
              label: 'Tải gói ngoại tuyến',
              icon: Icons.download_outlined,
              variant: CtmsButtonVariant.primary,
              onPressed: () => _openPackageScreen(controller),
            ),
            CtmsButton(
              label: 'Kiểm tra lại',
              variant: CtmsButtonVariant.soft,
              onPressed: () => controller.reloadPackage(force: true),
            ),
          ],
        );

      case OfflineMapPackageStatus.packageInvalid:
        return CtmsAlertBanner(
          severity: CtmsAlertSeverity.danger,
          title: 'Gói dữ liệu không hợp lệ',
          message:
              state.errorMessage ??
              'Dữ liệu bản đồ bị lỗi hoặc sai định dạng. Vui lòng tải lại gói.',
          actions: [
            CtmsButton(
              key: const Key('offline-map-redownload-package-btn'),
              label: 'Tải lại gói ngoại tuyến',
              icon: Icons.refresh_rounded,
              variant: CtmsButtonVariant.primary,
              onPressed: () => _openPackageScreen(controller),
            ),
            CtmsButton(
              label: 'Thử lại',
              variant: CtmsButtonVariant.soft,
              onPressed: () => controller.reloadPackage(force: true),
            ),
          ],
        );

      case OfflineMapPackageStatus.accessDenied:
        return CtmsAlertBanner(
          severity: CtmsAlertSeverity.danger,
          title: 'Không có quyền truy cập',
          message:
              state.errorMessage ??
              'Bạn không có quyền truy cập gói dữ liệu của chuyến đi này.',
        );

      case OfflineMapPackageStatus.ready:
        return const SizedBox.shrink();
    }
  }

  Widget? _buildGpsStatusNotice(
    BuildContext context,
    OfflineMapController controller,
    OfflineMapState state,
  ) {
    if (!state.hasUsableMap) return null;

    final loc = state.location;
    switch (loc.status) {
      case OfflineMapGpsStatus.permissionDenied:
        return CtmsAlertBanner(
          severity: CtmsAlertSeverity.warning,
          title: 'Chưa cấp quyền vị trí',
          message:
              'Ứng dụng cần quyền vị trí để định vị bạn trên tuyến đường ngoại tuyến.',
          actions: [
            CtmsButton(
              label: 'Cấp quyền',
              variant: CtmsButtonVariant.soft,
              onPressed: () => controller.refreshLocation(force: true),
            ),
          ],
        );

      case OfflineMapGpsStatus.permissionDeniedForever:
        return const CtmsAlertBanner(
          severity: CtmsAlertSeverity.danger,
          title: 'Quyền vị trí bị chặn',
          message:
              'Quyền vị trí đã bị từ chối vĩnh viễn trong Cài đặt thiết bị. Vui lòng mở Cài đặt để cấp lại quyền.',
        );

      case OfflineMapGpsStatus.serviceDisabled:
        return const CtmsAlertBanner(
          severity: CtmsAlertSeverity.warning,
          title: 'Dịch vụ GPS đang tắt',
          message:
              'Vui lòng bật tính năng định vị (GPS) trên thiết bị để xem vị trí của bạn trên bản đồ.',
        );

      case OfflineMapGpsStatus.unavailable:
        return const CtmsAlertBanner(
          severity: CtmsAlertSeverity.info,
          title: 'Đang tìm tín hiệu GPS…',
          message:
              'Hãy di chuyển ra khu vực thông thoáng ngoài trời để bắt sóng vệ tinh tốt hơn.',
        );

      case OfflineMapGpsStatus.checking:
      case OfflineMapGpsStatus.ready:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(offlineMapControllerProvider(widget.tripId));
    final state = controller.state;
    final recovery = widget.enableRecovery && state.hasUsableMap
        ? ref.watch(recoveryControllerProvider(widget.tripId)).view
        : null;
    final now = _now;
    final isStale = state.location.isStale(now);

    final statusNotice = _buildPackageStatusNotice(context, controller, state);
    final gpsNotice = _buildGpsStatusNotice(context, controller, state);

    return CtmsSectionCard(
      title: 'Bản đồ ngoại tuyến',
      trailing: state.hasUsableMap
          ? CtmsStatusBadge(
              label: 'Gói v${state.context!.packageVersion}',
              status: CtmsStatus.success,
              showDot: true,
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Package status notification if not ready
          statusNotice,

          // 2. GPS status warning/info if package is ready
          if (gpsNotice != null) ...[
            if (state.packageStatus != OfflineMapPackageStatus.ready)
              const SizedBox(height: AppSpacing.sm),
            gpsNotice,
            const SizedBox(height: AppSpacing.md),
          ],

          // 3. Map Canvas when package is ready
          if (state.hasUsableMap) ...[
            if (statusNotice is SizedBox && gpsNotice == null)
              const SizedBox(height: 0),
            OfflineMapCanvas(
              recoveryNotice: recovery == null ? null : recoveryMapNotice(recovery.display),
              mbtilesPath: controller.basemapPath ?? '',
              key: _canvasKey,
              route: state.context!.route,
              checkpoints: state.context!.checkpoints,
              location: state.location,
              clock: widget.clock,
              height: 250.0,
              recoveryTarget: recovery?.guides == true
                  ? recovery!.target
                  : null,
            ),
            const SizedBox(height: AppSpacing.md),
            if (widget.enableRecovery) ...[
              RecoveryCard(
                tripId: widget.tripId,
                onFocus: () {
                  final box =
                      _canvasKey.currentContext?.findRenderObject()
                          as RenderBox?;
                  if (box != null) {
                    _canvasKey.currentState?.focusOnRecovery(box.size);
                    Scrollable.ensureVisible(
                      _canvasKey.currentContext!,
                      alignment: 0.1,
                      duration: const Duration(milliseconds: 300),
                    );
                  }
                },
              ),
              const SizedBox(height: AppSpacing.md),
            ],

            // 4. Action button to open full-screen map
            if (controller.basemapPath == null)
              const Padding(
                padding: EdgeInsets.only(bottom: AppSpacing.sm),
                child: Text(
                  'Chưa có nền bản đồ đã xác thực. Đang hiển thị sơ đồ dự phòng.',
                ),
              ),
            OutlinedButton(
              key: const Key('offline-map-open-fullscreen'),
              onPressed: () => _openFullScreen(state),
              child: const Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.fullscreen_outlined),
                    SizedBox(width: AppSpacing.sm),
                    Flexible(
                      child: Text(
                        'Xem bản đồ toàn màn hình',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            // 5. Checkpoint list with distances
            widget.integrateArrivals
                ? CheckpointArrivalPanel(
                    showDistances:
                        state.location.status == OfflineMapGpsStatus.ready,
                    distanceNote: isStale
                        ? 'Mẫu GPS cũ'
                        : state.location.quality == GpsSignalQuality.poor
                        ? 'GPS độ chính xác thấp'
                        : null,
                    tripId: widget.tripId,
                    onSelectCheckpoint: (selected) {
                      final matches = state.context!.checkpoints.where(
                        (cp) => cp.id == selected.id,
                      );
                      final renderBox =
                          _canvasKey.currentContext?.findRenderObject()
                              as RenderBox?;
                      if (matches.isNotEmpty && renderBox != null) {
                        _canvasKey.currentState?.focusOnCheckpoint(
                          matches.first,
                          renderBox.size,
                        );
                        Scrollable.ensureVisible(
                          _canvasKey.currentContext!,
                          duration: const Duration(milliseconds: 300),
                          alignment: 0.1,
                        );
                      }
                    },
                  )
                : OfflineMapCheckpointList(
                    checkpoints: state.context!.checkpoints,
                    currentLocation: state.location,
                    isStale: isStale,
                    onSelectCheckpoint: (cp) {
                      final renderBox =
                          _canvasKey.currentContext?.findRenderObject()
                              as RenderBox?;
                      if (renderBox != null) {
                        _canvasKey.currentState?.focusOnCheckpoint(
                          cp,
                          renderBox.size,
                        );
                        Scrollable.ensureVisible(
                          _canvasKey.currentContext!,
                          duration: const Duration(milliseconds: 300),
                          alignment: 0.1,
                        );
                      }
                    },
                  ),
          ],
        ],
      ),
    );
  }
}
