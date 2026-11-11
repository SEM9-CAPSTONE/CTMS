// Manual visual review only; not imported by the production application.
// Fixtures exercise real production widgets, not an authenticated API flow.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';
import 'package:mobile/features/offline_map/domain/offline_map_models.dart';
import 'package:mobile/features/offline_map/presentation/widgets/offline_map_canvas.dart';
import 'package:mobile/features/route_recovery/domain/recovery_geometry.dart';
import 'package:mobile/features/route_recovery/domain/recovery_state.dart';
import 'package:mobile/features/route_recovery/presentation/recovery_card.dart';
import 'son_tra_preview_route.dart';

void main() => runApp(
  MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light(),
    home: const RecoveryPreview(),
  ),
);

class RecoveryPreview extends StatefulWidget {
  const RecoveryPreview({
    super.key,
    this.fullScreen = false,
    this.initialMode = RecoveryDisplay.ready,
  });
  final bool fullScreen;
  final RecoveryDisplay initialMode;
  @override
  State<RecoveryPreview> createState() => _RecoveryPreviewState();
}

class _RecoveryPreviewState extends State<RecoveryPreview> {
  final canvas = GlobalKey<OfflineMapCanvasState>();
  final tileProvider = _LocalPreviewTiles();
  final observedAt = DateTime.now().subtract(const Duration(minutes: 2));
  Timer? timer;
  @override
  void initState() {
    super.initState();
    mode = widget.initialMode;
    timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  RecoveryDisplay mode = RecoveryDisplay.ready;
  static const modes = {
    RecoveryDisplay.artifactInvalid: 'Thiếu/hỏng dữ liệu tuyến',
    RecoveryDisplay.ready: 'GPS tốt',
    RecoveryDisplay.offlineReady: 'Mất mạng, có xác thực cũ',
    RecoveryDisplay.staleRoute: 'Dữ liệu tuyến đã cũ',
    RecoveryDisplay.gpsStale: 'GPS cũ',
    RecoveryDisplay.gpsPoor: 'GPS yếu',
    RecoveryDisplay.restricted: 'Mất quyền truy cập',
    RecoveryDisplay.serverError: 'Lỗi máy chủ',
    RecoveryDisplay.unverified: 'Chưa xác thực',
    RecoveryDisplay.packageMissing: 'Thiếu package',
    RecoveryDisplay.mismatch: 'Gói hỏng / MISMATCH',
    RecoveryDisplay.unavailable: 'UNAVAILABLE',
    RecoveryDisplay.loading: 'Đang kiểm tra',
    RecoveryDisplay.gpsMissing: 'Chưa có GPS',
    RecoveryDisplay.contextMismatch: 'Lệch ngữ cảnh detector',
    RecoveryDisplay.notOffRoute: 'Chưa xác nhận lệch tuyến',
  };
  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final points = sonTraPreviewRoute;
    final anchor = points[points.length ~/ 2];
    final origin = RecoveryPoint(anchor.latitude + .003, anchor.longitude);
    final target = nearestRecoveryTarget(origin, points)!;
    final guides =
        mode == RecoveryDisplay.ready || mode == RecoveryDisplay.offlineReady;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.fullScreen
              ? 'Toàn màn hình · Dữ liệu mô phỏng'
              : 'Duyệt giao diện · CTMS-316',
        ),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: widget.fullScreen ? 1000 : 620),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Text(
                'Nền OSM Sơn Trà thật · Tuyến minh họa đường Hoàng Sa và GPS mô phỏng. Chưa kiểm chứng API.',
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<RecoveryDisplay>(
                initialValue: mode,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Trạng thái xem thử',
                ),
                items: [
                  for (final entry in modes.entries)
                    DropdownMenuItem(
                      value: entry.key,
                      child: Text(
                        entry.value,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                onChanged: (value) => setState(() => mode = value!),
              ),
              const SizedBox(height: 16),
              if (mode != RecoveryDisplay.packageMissing &&
                  mode != RecoveryDisplay.mismatch)
                OfflineMapCanvas(
                  recoveryNotice: recoveryMapNotice(mode),
                  key: canvas,
                  previewTileProvider: tileProvider,
                  previewTileBounds: LatLngBounds(
                    const LatLng(16.065, 108.225),
                    const LatLng(16.165, 108.335),
                  ),
                  route: OfflineRouteGeometry(
                    routeId: 'preview',
                    points: [
                      for (final p in points)
                        OfflineRoutePoint(
                          latitude: p.latitude,
                          longitude: p.longitude,
                        ),
                    ],
                  ),
                  location: OfflineMapLocationState(
                    status: mode == RecoveryDisplay.gpsMissing
                        ? OfflineMapGpsStatus.unavailable
                        : OfflineMapGpsStatus.ready,
                    sample: mode == RecoveryDisplay.gpsMissing
                        ? null
                        : GpsSample(
                            capturedAt: mode == RecoveryDisplay.gpsStale
                                ? now.subtract(const Duration(seconds: 45))
                                : now,
                            latitude: origin.latitude,
                            longitude: origin.longitude,
                            accuracyMeters: mode == RecoveryDisplay.gpsPoor
                                ? 60
                                : 5,
                          ),
                  ),
                  recoveryTarget: guides ? target : null,
                  clock: () => now,
                  height: widget.fullScreen
                      ? MediaQuery.sizeOf(context).height * .60
                      : 340,
                ),
              const SizedBox(height: 16),
              if (!widget.fullScreen)
                OutlinedButton.icon(
                  icon: const Icon(Icons.fullscreen),
                  label: const Text('Xem toàn màn hình'),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) =>
                          RecoveryPreview(fullScreen: true, initialMode: mode),
                    ),
                  ),
                ),
              RecoveryCardContent(
                view: RecoveryView(
                  mode,
                  target: guides ? target : null,
                  observedAt: observedAt,
                ),
                onRetry: () {},
                onFocus: () {
                  final box =
                      canvas.currentContext?.findRenderObject() as RenderBox?;
                  if (box != null) {
                    canvas.currentState?.focusOnRecovery(box.size);
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Reads extracted XYZ tiles from the existing MBTiles via localhost only.
class _LocalPreviewTiles extends TileProvider {
  @override
  ImageProvider getImage(
    TileCoordinates coordinates,
    TileLayer options,
  ) => NetworkImage(
    'http://127.0.0.1:8087/${coordinates.z}/${coordinates.x}/${coordinates.y}.png',
  );
}
