import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../features/checkpoint_arrivals/presentation/checkpoint_arrival_panel.dart';
import '../application/offline_map_controller.dart';
import '../domain/offline_map_models.dart';
import 'widgets/offline_map_canvas.dart';
import 'widgets/offline_map_checkpoint_list.dart';

/// Full-screen navigation map view for on-trail orientation.
/// Reuses the existing [OfflineMapController] via [offlineMapControllerProvider].
class OfflineMapScreen extends ConsumerStatefulWidget {
  const OfflineMapScreen({
    super.key,
    required this.tripId,
    this.clock,
    this.integrateArrivals = false,
  });

  final String tripId;
  final bool integrateArrivals;
  final DateTime Function()? clock;

  @override
  ConsumerState<OfflineMapScreen> createState() => _OfflineMapScreenState();
}

class _OfflineMapScreenState extends ConsumerState<OfflineMapScreen> {
  final _canvasKey = GlobalKey<OfflineMapCanvasState>();

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(offlineMapControllerProvider(widget.tripId));
    final state = controller.state;
    final now = (widget.clock ?? DateTime.now)();
    final isStale = state.location.isStale(now);

    final subtitle = state.hasUsableMap
        ? 'Gói bản đồ v${state.context!.packageVersion} · ${state.context!.checkpoints.length} trạm kiểm tra'
        : 'Bản đồ ngoại tuyến';

    final gpsNotice = state.hasUsableMap
        ? _buildGpsBanner(context, controller, state)
        : null;

    return CtmsScaffold(
      title: 'Bản đồ ngoại tuyến',
      subtitle: subtitle,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Package Status Warning Banner (when not ready)
          if (!state.hasUsableMap)
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: _buildPackageStatusBanner(context, controller, state),
            ),

          // 2. GPS Issue Notice (when map is usable but GPS has issue)
          if (gpsNotice != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.md,
                AppSpacing.xs,
              ),
              child: gpsNotice,
            ),

          // 3. Map Canvas Area
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: state.hasUsableMap
                  ? LayoutBuilder(
                      builder: (context, constraints) {
                        return OfflineMapCanvas(
                          mbtilesPath: controller.basemapPath ?? '',
                          key: _canvasKey,
                          route: state.context!.route,
                          checkpoints: state.context!.checkpoints,
                          location: state.location,
                          clock: widget.clock,
                          height: constraints.maxHeight,
                          interactive: true,
                        );
                      },
                    )
                  : const OfflineMapCanvas(route: null, interactive: false),
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          // 4. Bottom Checkpoint Sheet / Details
          if (state.hasUsableMap)
            Container(
              constraints: const BoxConstraints(maxHeight: 220),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                boxShadow: AppColors.cardShadow,
              ),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: widget.integrateArrivals
                    ? CheckpointArrivalPanel(
                        showDistances:
                            state.location.status == OfflineMapGpsStatus.ready,
                        distanceNote: isStale
                            ? 'Mẫu GPS cũ'
                            : state.location.quality == GpsSignalQuality.poor
                            ? 'GPS độ chính xác thấp'
                            : null,
                        showReachedDialog: false,
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
                          }
                        },
                      ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildPackageStatusBanner(
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
        return const Center(
          child: Padding(
            padding: EdgeInsets.all(AppSpacing.lg),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                SizedBox(width: AppSpacing.md),
                Text('Đang nạp dữ liệu bản đồ ngoại tuyến…'),
              ],
            ),
          ),
        );

      case OfflineMapPackageStatus.packageMissing:
        return CtmsAlertBanner(
          severity: CtmsAlertSeverity.warning,
          title: 'Chưa có dữ liệu bản đồ ngoại tuyến',
          message:
              'Không tìm thấy gói dữ liệu cho chuyến đi này trên thiết bị. Vui lòng tải trước khi ngắt mạng.',
          actions: [
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
          message: state.errorMessage ?? 'Dữ liệu bản đồ bị lỗi.',
          actions: [
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
          message: state.errorMessage ?? 'Quyền truy cập gói bị từ chối.',
        );

      case OfflineMapPackageStatus.ready:
        return const SizedBox.shrink();
    }
  }

  Widget? _buildGpsBanner(
    BuildContext context,
    OfflineMapController controller,
    OfflineMapState state,
  ) {
    final loc = state.location;
    switch (loc.status) {
      case OfflineMapGpsStatus.permissionDenied:
        return CtmsAlertBanner(
          severity: CtmsAlertSeverity.warning,
          title: 'Chưa cấp quyền vị trí',
          message: 'Vui lòng cấp quyền vị trí để định vị trên tuyến đường.',
          actions: [
            CtmsButton(
              label: 'Cấp quyền',
              variant: CtmsButtonVariant.soft,
              onPressed: () => controller.refreshLocation(),
            ),
          ],
        );

      case OfflineMapGpsStatus.permissionDeniedForever:
        return const CtmsAlertBanner(
          severity: CtmsAlertSeverity.danger,
          title: 'Quyền vị trí bị chặn',
          message: 'Vui lòng mở Cài đặt thiết bị để cho phép quyền vị trí.',
        );

      case OfflineMapGpsStatus.serviceDisabled:
        return const CtmsAlertBanner(
          severity: CtmsAlertSeverity.warning,
          title: 'GPS đang tắt',
          message: 'Vui lòng bật định vị trên thiết bị.',
        );

      case OfflineMapGpsStatus.unavailable:
        return const CtmsAlertBanner(
          severity: CtmsAlertSeverity.info,
          title: 'Đang tìm tín hiệu GPS…',
          message: 'Di chuyển ra khu vực thoáng để bắt sóng vệ tinh.',
        );

      case OfflineMapGpsStatus.checking:
      case OfflineMapGpsStatus.ready:
        return null;
    }
  }
}
