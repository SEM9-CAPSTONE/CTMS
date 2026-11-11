import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' as ll;
import 'package:sqflite/sqflite.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../gps_tracking/domain/gps_tracking_models.dart';
import '../../data/offline_mbtiles_provider.dart';
import '../../domain/offline_map_models.dart';

/// Coordinate projection helper from geographic coordinates (lat, lon) to 2D canvas pixels.
/// Uses a local equirectangular projection centered on the route bounding box.
class OfflineMapViewport {
  const OfflineMapViewport({
    required this.centerLat,
    required this.centerLon,
    required this.cosLat,
    required this.baseScale,
    required this.padding,
    required this.canvasSize,
    this.latSpan = 0.008,
    this.lonSpan = 0.008,
  });

  final double centerLat;
  final double centerLon;
  final double cosLat;
  final double baseScale;
  final double padding;
  final Size canvasSize;
  final double latSpan;
  final double lonSpan;

  static const double earthMetersPerDegree = 111320.0;

  factory OfflineMapViewport.fromRoute({
    required OfflineRouteGeometry route,
    required Size size,
    double padding = 48.0,
  }) {
    final points = route.points;
    if (points.isEmpty) {
      return OfflineMapViewport(
        centerLat: 0,
        centerLon: 0,
        cosLat: 1.0,
        baseScale: 1.0,
        padding: padding,
        canvasSize: size,
        latSpan: 0.008,
        lonSpan: 0.008,
      );
    }

    final minLat = route.minLatitude;
    final maxLat = route.maxLatitude;
    final minLon = route.minLongitude;
    final maxLon = route.maxLongitude;

    final centerLat = (minLat + maxLat) / 2.0;
    final centerLon = (minLon + maxLon) / 2.0;
    final cosLat = cos(centerLat * pi / 180.0).abs().clamp(0.01, 1.0);

    final latSpan = max(maxLat - minLat, 0.0012);
    final lonSpan = max(maxLon - minLon, 0.0012);

    final geoWidth = lonSpan * cosLat;
    final geoHeight = latSpan;

    final usableW = max(size.width - padding * 2, 10.0);
    final usableH = max(size.height - padding * 2, 10.0);

    final scale = min(usableW / geoWidth, usableH / geoHeight);

    return OfflineMapViewport(
      centerLat: centerLat,
      centerLon: centerLon,
      cosLat: cosLat,
      baseScale: scale,
      padding: padding,
      canvasSize: size,
      latSpan: latSpan,
      lonSpan: lonSpan,
    );
  }

  /// Converts (lat, lon) to screen pixel coordinate applying pan and zoom.
  Offset geoToScreen(
    double lat,
    double lon, {
    Offset panOffset = Offset.zero,
    double zoomScale = 1.0,
  }) {
    final xGeo = (lon - centerLon) * cosLat;
    final yGeo = -(lat - centerLat); // Screen Y increases downwards

    final baseX = (canvasSize.width / 2.0) + xGeo * baseScale;
    final baseY = (canvasSize.height / 2.0) + yGeo * baseScale;

    final screenX =
        (canvasSize.width / 2.0) +
        panOffset.dx +
        (baseX - canvasSize.width / 2.0) * zoomScale;
    final screenY =
        (canvasSize.height / 2.0) +
        panOffset.dy +
        (baseY - canvasSize.height / 2.0) * zoomScale;

    return Offset(screenX, screenY);
  }

  /// Converts a physical ground distance in meters into screen pixels at current zoom.
  double metersToPixels(double meters, {double zoomScale = 1.0}) {
    final effectiveScale = baseScale * zoomScale;
    return meters * (effectiveScale / earthMetersPerDegree);
  }
}

/// Interactive vector canvas rendering neutral survey grid, trail with direction chevrons,
/// checkpoints, auto-follow GPS mode, and next checkpoint HUD.
class OfflineMapCanvas extends StatefulWidget {
  const OfflineMapCanvas({
    super.key,
    required this.route,
    this.checkpoints = const [],
    this.location = const OfflineMapLocationState(),
    this.clock,
    this.height = 280.0,
    this.interactive = true,
    this.onSelectCheckpoint,
    this.mbtilesPath,
  });

  final OfflineRouteGeometry? route;
  final List<OfflineMapCheckpoint> checkpoints;
  final OfflineMapLocationState location;
  final DateTime Function()? clock;
  final double height;
  final bool interactive;
  final ValueChanged<OfflineMapCheckpoint>? onSelectCheckpoint;
  final String? mbtilesPath;

  @override
  State<OfflineMapCanvas> createState() => OfflineMapCanvasState();
}

class OfflineMapCanvasState extends State<OfflineMapCanvas>
    with SingleTickerProviderStateMixin {
  Offset _panOffset = Offset.zero;
  double _zoomScale = 1.0;
  double _baseScaleOnGesture = 1.0;
  bool _autoFollowGps = true;
  bool _hasInitialFramed = false;
  AnimationController? _pulseController;
  Animation<double>? _pulseAnimation;
  Database? _mbtilesDb;
  double _tileMinZoom = 12;
  double _tileMaxZoom = 16;
  LatLngBounds? _tileBounds;
  int _tileLoadGeneration = 0;
  MapController? _mapController;

  @visibleForTesting
  double get zoomScale => _zoomScale;

  @visibleForTesting
  Offset get panOffset => _panOffset;

  @visibleForTesting
  bool get autoFollowGps => _autoFollowGps;

  DateTime get _now => (widget.clock ?? DateTime.now)();

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );

    _pulseAnimation = CurvedAnimation(
      parent: _pulseController!,
      curve: Curves.easeInOut,
    );

    _scheduleInitialFramingIfNeeded();
    _initMbTiles();
  }

  void _initMbTiles() async {
    final generation = ++_tileLoadGeneration;
    final path = widget.mbtilesPath ?? '';
    if (kIsWeb || path.isEmpty) return;
    try {
      final file = File(path);
      if (await file.exists()) {
        final db = await openDatabase(
          path,
          readOnly: true,
          singleInstance: false,
        );
        final metadata = await db.rawQuery('SELECT name, value FROM metadata');
        final values = {
          for (final row in metadata)
            row['name'].toString(): row['value'].toString(),
        };
        final bounds = values['bounds']
            ?.split(',')
            .map(double.tryParse)
            .toList();
        final route = widget.route;
        final covered =
            bounds != null &&
            bounds.length == 4 &&
            bounds.every((v) => v != null) &&
            route != null &&
            route.points.every(
              (p) =>
                  p.longitude >= bounds[0]! &&
                  p.latitude >= bounds[1]! &&
                  p.longitude <= bounds[2]! &&
                  p.latitude <= bounds[3]!,
            );
        final minZoom = int.tryParse(values['minzoom'] ?? '');
        final maxZoom = int.tryParse(values['maxzoom'] ?? '');
        if (!covered ||
            values['format'] != 'png' ||
            minZoom == null ||
            maxZoom == null ||
            minZoom < 0 ||
            maxZoom < minZoom ||
            maxZoom > 20) {
          await db.close();
          return;
        }
        if (mounted && generation == _tileLoadGeneration) {
          setState(() {
            _mbtilesDb = db;
            _tileMinZoom = minZoom.toDouble();
            _tileMaxZoom = maxZoom.toDouble();
            _tileBounds = LatLngBounds(
              ll.LatLng(bounds[1]!, bounds[0]!),
              ll.LatLng(bounds[3]!, bounds[2]!),
            );
          });
        } else {
          await db.close();
        }
      }
    } catch (_) {}
  }

  void _scheduleInitialFramingIfNeeded() {
    if (!_hasInitialFramed &&
        widget.location.sample != null &&
        widget.location.status == OfflineMapGpsStatus.ready &&
        widget.route != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _hasInitialFramed) return;
        final renderBox = context.findRenderObject() as RenderBox?;
        if (renderBox != null && renderBox.hasSize) {
          fitUserAndNextCheckpoint(renderBox.size);
        }
      });
    }
  }

  void _syncPulseAnimation({
    required bool hasFix,
    required bool isStale,
    required bool disableAnimations,
  }) {
    final shouldPulse = hasFix && !isStale && !disableAnimations;
    if (shouldPulse) {
      if (!_pulseController!.isAnimating) {
        _pulseController!.repeat(reverse: true);
      }
    } else {
      if (_pulseController!.isAnimating) {
        _pulseController!.stop();
        _pulseController!.value = 0.0;
      }
    }
  }

  @override
  void didUpdateWidget(covariant OfflineMapCanvas oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.mbtilesPath != widget.mbtilesPath ||
        oldWidget.route != widget.route) {
      _mbtilesDb?.close();
      _mbtilesDb = null;
      _initMbTiles();
    }
    // Lần đầu có GPS: Căn khung bao gồm cả vị trí người dùng và trạm kế tiếp
    if (!_hasInitialFramed &&
        widget.location.sample != null &&
        widget.location.status == OfflineMapGpsStatus.ready &&
        widget.route != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _hasInitialFramed) return;
        final renderBox = context.findRenderObject() as RenderBox?;
        if (renderBox != null && renderBox.hasSize) {
          fitUserAndNextCheckpoint(renderBox.size);
        }
      });
    } else if (_autoFollowGps &&
        widget.location.sample != null &&
        widget.location.sample != oldWidget.location.sample &&
        widget.route != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !_autoFollowGps) return;
        final renderBox = context.findRenderObject() as RenderBox?;
        if (renderBox != null && renderBox.hasSize) {
          recenterOnGps(renderBox.size);
        }
      });
    }
  }

  @override
  void dispose() {
    _tileLoadGeneration++;
    _mbtilesDb?.close();
    _mapController?.dispose();
    _pulseController?.dispose();
    super.dispose();
  }

  /// Reset view to show the entire route.
  void fitRoute() {
    if (_mbtilesDb != null && _mapController != null && widget.route != null) {
      final points = widget.route!.points
          .map((p) => ll.LatLng(p.latitude, p.longitude))
          .toList();
      _mapController!.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(points),
          padding: const EdgeInsets.all(32),
        ),
      );
      setState(() => _autoFollowGps = false);
      return;
    }
    setState(() {
      _autoFollowGps = false;
      _panOffset = Offset.zero;
      _zoomScale = 1.0;
    });
  }

  /// Center the view on the current GPS position and activate auto-follow mode.
  bool recenterOnGps(Size canvasSize) {
    final sample = widget.location.sample;
    final route = widget.route;
    if (sample == null || route == null) return false;
    if (_mbtilesDb != null) {
      _flutterMapRecenter();
      setState(() => _autoFollowGps = true);
      return true;
    }

    final viewport = OfflineMapViewport.fromRoute(
      route: route,
      size: canvasSize,
    );

    final baseGps = viewport.geoToScreen(
      sample.latitude,
      sample.longitude,
      panOffset: Offset.zero,
      zoomScale: 1.0,
    );

    setState(() {
      _autoFollowGps = true;
      _panOffset = Offset(
        (canvasSize.width / 2.0 - baseGps.dx) * _zoomScale,
        (canvasSize.height / 2.0 - baseGps.dy) * _zoomScale,
      );
    });
    return true;
  }

  /// Căn khung hiển thị đồng thời vị trí người dùng và trạm kiểm tra kế tiếp (Giai đoạn 1).
  bool fitUserAndNextCheckpoint(Size canvasSize) {
    final sample = widget.location.sample;
    final route = widget.route;
    if (sample == null || route == null || canvasSize.width <= 0) return false;

    final info = _findNextCheckpoint(sample);
    final targetCp =
        info?.checkpoint ??
        (widget.checkpoints.isNotEmpty ? widget.checkpoints.first : null);

    final viewport = OfflineMapViewport.fromRoute(
      route: route,
      size: canvasSize,
    );

    if (targetCp != null) {
      final minLat = min(sample.latitude, targetCp.latitude);
      final maxLat = max(sample.latitude, targetCp.latitude);
      final minLon = min(sample.longitude, targetCp.longitude);
      final maxLon = max(sample.longitude, targetCp.longitude);

      final midLat = (minLat + maxLat) / 2.0;
      final midLon = (minLon + maxLon) / 2.0;

      final baseMid = viewport.geoToScreen(
        midLat,
        midLon,
        panOffset: Offset.zero,
        zoomScale: 1.0,
      );
      final p1 = viewport.geoToScreen(
        minLat,
        minLon,
        panOffset: Offset.zero,
        zoomScale: 1.0,
      );
      final p2 = viewport.geoToScreen(
        maxLat,
        maxLon,
        panOffset: Offset.zero,
        zoomScale: 1.0,
      );

      final spanX = (p1.dx - p2.dx).abs();
      final spanY = (p1.dy - p2.dy).abs();

      final usableW = max(canvasSize.width - 112.0, 20.0);
      final usableH = max(canvasSize.height - 110.0, 20.0);

      double targetZoom = 1.2;
      if (spanX > 5 || spanY > 5) {
        final scaleX = usableW / max(spanX, 10.0);
        final scaleY = usableH / max(spanY, 10.0);
        targetZoom = (min(scaleX, scaleY) * 0.90).clamp(0.85, 3.5);
      }

      setState(() {
        _hasInitialFramed = true;
        _autoFollowGps = true;
        _zoomScale = targetZoom;
        _panOffset = Offset(
          (canvasSize.width / 2.0 - baseMid.dx) * targetZoom,
          (canvasSize.height / 2.0 - baseMid.dy) * targetZoom,
        );
      });
      return true;
    } else {
      _hasInitialFramed = true;
      return recenterOnGps(canvasSize);
    }
  }

  /// Smoothly center and zoom in on a specific checkpoint.
  void focusOnCheckpoint(OfflineMapCheckpoint cp, Size canvasSize) {
    final route = widget.route;
    if (route == null) return;

    if (_mbtilesDb != null && _mapController != null) {
      setState(() => _autoFollowGps = false);
      _mapController!.move(
        ll.LatLng(cp.latitude, cp.longitude),
        max(
          _mapController!.camera.zoom,
          15.0,
        ).clamp(_tileMinZoom, _tileMaxZoom),
      );
      widget.onSelectCheckpoint?.call(cp);
      return;
    }

    final viewport = OfflineMapViewport.fromRoute(
      route: route,
      size: canvasSize,
    );

    final basePos = viewport.geoToScreen(
      cp.latitude,
      cp.longitude,
      panOffset: Offset.zero,
      zoomScale: 1.0,
    );

    setState(() {
      _autoFollowGps = false;
      _zoomScale = max(_zoomScale, 1.7);
      _panOffset = Offset(
        (canvasSize.width / 2.0 - basePos.dx) * _zoomScale,
        (canvasSize.height / 2.0 - basePos.dy) * _zoomScale,
      );
    });
  }

  void zoomIn() {
    if (_mbtilesDb != null) {
      _flutterMapZoom(1);
      return;
    }
    setState(() {
      _zoomScale = (_zoomScale * 1.35).clamp(0.6, 6.0);
    });
  }

  void zoomOut() {
    if (_mbtilesDb != null) {
      _flutterMapZoom(-1);
      return;
    }
    setState(() {
      _zoomScale = (_zoomScale / 1.35).clamp(0.6, 6.0);
    });
  }

  void _flutterMapZoom(double delta) {
    if (_mapController == null) return;
    final curZoom = _mapController!.camera.zoom;
    final newZoom = (curZoom + delta).clamp(_tileMinZoom, _tileMaxZoom);
    _mapController!.move(_mapController!.camera.center, newZoom);
  }

  void _flutterMapRecenter() {
    if (_mapController == null || widget.location.sample == null) return;
    final sample = widget.location.sample!;
    _mapController!.move(ll.LatLng(sample.latitude, sample.longitude), 15.0);
  }

  void _handleCanvasTap(Offset localPosition, Size canvasSize) {
    if (widget.route == null || widget.checkpoints.isEmpty) return;

    final viewport = OfflineMapViewport.fromRoute(
      route: widget.route!,
      size: canvasSize,
    );

    // Check hit within 22 pixels of any checkpoint pin
    for (final cp in widget.checkpoints) {
      final pinPos = viewport.geoToScreen(
        cp.latitude,
        cp.longitude,
        panOffset: _panOffset,
        zoomScale: _zoomScale,
      );
      final dist = (pinPos - localPosition).distance;
      if (dist <= 22.0) {
        widget.onSelectCheckpoint?.call(cp);
        focusOnCheckpoint(cp, canvasSize);
        return;
      }
    }
  }

  NextCheckpointInfo? _findNextCheckpoint(GpsSample? sample) {
    if (sample == null || widget.checkpoints.isEmpty) return null;
    final currentPos = OfflineRoutePoint(
      latitude: sample.latitude,
      longitude: sample.longitude,
    );

    // 1. Kiểm tra xem người dùng có đang nằm trong bán kính của trạm nào không
    int arrivedIndex = -1;
    for (int i = 0; i < widget.checkpoints.length; i++) {
      final cp = widget.checkpoints[i];
      final cpPos = OfflineRoutePoint(
        latitude: cp.latitude,
        longitude: cp.longitude,
      );
      if (currentPos.distanceTo(cpPos) <= cp.radiusMeters) {
        arrivedIndex = i;
        break;
      }
    }

    if (arrivedIndex != -1) {
      final arrivedCp = widget.checkpoints[arrivedIndex];
      // Nếu còn trạm tiếp theo dọc tuyến
      if (arrivedIndex + 1 < widget.checkpoints.length) {
        final nextCp = widget.checkpoints[arrivedIndex + 1];
        final distToNext = currentPos.distanceTo(
          OfflineRoutePoint(
            latitude: nextCp.latitude,
            longitude: nextCp.longitude,
          ),
        );
        return NextCheckpointInfo(
          checkpoint: nextCp,
          distanceMeters: distToNext,
          isArrived: true,
          arrivedCheckpoint: arrivedCp,
        );
      } else {
        // Đã đến trạm kết thúc (đích đến)
        return NextCheckpointInfo(
          checkpoint: arrivedCp,
          distanceMeters: 0.0,
          isArrived: true,
          arrivedCheckpoint: arrivedCp,
        );
      }
    }

    // 2. Chưa nằm trong trạm nào: Tìm trạm đầu tiên theo thứ tự tuyến mà người dùng chưa vượt qua
    final route = widget.route;
    if (route != null && route.points.isNotEmpty) {
      int userRouteIdx = 0;
      double minUserDist = double.infinity;
      for (int i = 0; i < route.points.length; i++) {
        final d = currentPos.distanceTo(route.points[i]);
        if (d < minUserDist) {
          minUserDist = d;
          userRouteIdx = i;
        }
      }

      for (int i = 0; i < widget.checkpoints.length; i++) {
        final cp = widget.checkpoints[i];
        final cpPos = OfflineRoutePoint(
          latitude: cp.latitude,
          longitude: cp.longitude,
        );
        int cpRouteIdx = 0;
        double minCpDist = double.infinity;
        for (int r = 0; r < route.points.length; r++) {
          final d = cpPos.distanceTo(route.points[r]);
          if (d < minCpDist) {
            minCpDist = d;
            cpRouteIdx = r;
          }
        }

        if (cpRouteIdx >= userRouteIdx) {
          return NextCheckpointInfo(
            checkpoint: cp,
            distanceMeters: currentPos.distanceTo(cpPos),
            isArrived: false,
          );
        }
      }
    }

    // Fallback: Tìm trạm có khoảng cách ngắn nhất
    OfflineMapCheckpoint closest = widget.checkpoints.first;
    double minDistance = double.infinity;
    for (final cp in widget.checkpoints) {
      final cpPos = OfflineRoutePoint(
        latitude: cp.latitude,
        longitude: cp.longitude,
      );
      final dist = currentPos.distanceTo(cpPos);
      if (dist < minDistance) {
        minDistance = dist;
        closest = cp;
      }
    }
    return NextCheckpointInfo(
      checkpoint: closest,
      distanceMeters: minDistance,
      isArrived: false,
    );
  }

  String _buildSemanticsLabel(bool isStale) {
    final route = widget.route;
    final sample = widget.location.sample;
    final routeDesc = route != null
        ? 'Tuyến đường có ${route.points.length} điểm tọa độ, ${widget.checkpoints.length} trạm kiểm tra.'
        : 'Chưa có dữ liệu tuyến đường.';

    if (sample == null) {
      return 'Bản đồ ngoại tuyến. $routeDesc Chưa nhận được tín hiệu GPS.';
    }

    final qualityDesc = widget.location.quality == GpsSignalQuality.good
        ? 'Tín hiệu tốt'
        : 'Tín hiệu yếu (sai số lớn)';
    final staleDesc = isStale ? 'Mẫu vị trí cũ (>30s)' : 'Vị trí hiện tại';

    return 'Bản đồ ngoại tuyến. $routeDesc $staleDesc: sai số ${sample.accuracyMeters.toStringAsFixed(1)} mét, $qualityDesc.';
  }

  @override
  Widget build(BuildContext context) {
    final disableAnimations =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final isStale = widget.location.isStale(_now);
    final hasFix =
        widget.location.sample != null &&
        widget.location.status == OfflineMapGpsStatus.ready;

    _syncPulseAnimation(
      hasFix: hasFix,
      isStale: isStale,
      disableAnimations: disableAnimations,
    );

    return Semantics(
      label: _buildSemanticsLabel(isStale),
      hint: widget.interactive
          ? 'Kéo để di chuyển bản đồ, bấm nút điều khiển để thu phóng'
          : null,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final canvasSize = Size(constraints.maxWidth, widget.height);

          final viewport = widget.route != null
              ? OfflineMapViewport.fromRoute(
                  route: widget.route!,
                  size: canvasSize,
                )
              : null;

          final nextCheckpoint = hasFix
              ? _findNextCheckpoint(widget.location.sample)
              : null;

          return Container(
            height: widget.height,
            width: double.infinity,
            decoration: BoxDecoration(
              color: const Color(
                0xFFF7F8F4,
              ), // Clean neutral outdoor survey paper
              borderRadius: AppRadius.cardBorderRadius,
              border: Border.all(color: const Color(0xFFD6DEC7), width: 1.0),
              boxShadow: AppColors.cardShadowSm,
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              children: [
                // Mode A: Real Offline MBTiles Basemap (when son_tra.mbtiles is available)
                if (_mbtilesDb != null && viewport != null)
                  Positioned.fill(
                    child: FlutterMap(
                      mapController: _mapController ??= MapController(),
                      options: MapOptions(
                        initialCenter: ll.LatLng(
                          viewport.centerLat,
                          viewport.centerLon,
                        ),
                        initialZoom: 13.8.clamp(_tileMinZoom, _tileMaxZoom),
                        minZoom: _tileMinZoom,
                        maxZoom: _tileMaxZoom,
                        cameraConstraint: CameraConstraint.contain(
                          bounds: _tileBounds!,
                        ),
                        interactionOptions: InteractionOptions(
                          flags: widget.interactive
                              ? InteractiveFlag.all & ~InteractiveFlag.rotate
                              : InteractiveFlag.none,
                        ),
                      ),
                      children: [
                        TileLayer(
                          minZoom: _tileMinZoom,
                          maxZoom: _tileMaxZoom,
                          tileProvider: MbTilesTileProvider(
                            database: _mbtilesDb!,
                          ),
                        ),
                        PolylineLayer(
                          polylines: [
                            Polyline(
                              points: widget.route!.points
                                  .map(
                                    (p) => ll.LatLng(p.latitude, p.longitude),
                                  )
                                  .toList(),
                              strokeWidth: 4.5,
                              color: const Color(0xFF1B5E20),
                            ),
                          ],
                        ),
                        CircleLayer(
                          circles: [
                            for (final cp in widget.checkpoints)
                              CircleMarker(
                                point: ll.LatLng(cp.latitude, cp.longitude),
                                radius: cp.radiusMeters,
                                useRadiusInMeter: true,
                                color: const Color(0x302E7D32),
                                borderColor: const Color(0xFF2E7D32),
                                borderStrokeWidth: 1.5,
                              ),
                            if (hasFix)
                              CircleMarker(
                                point: ll.LatLng(
                                  widget.location.sample!.latitude,
                                  widget.location.sample!.longitude,
                                ),
                                radius: widget.location.sample!.accuracyMeters,
                                useRadiusInMeter: true,
                                color: const Color(0x2800875A),
                                borderColor: const Color(0xFF00875A),
                                borderStrokeWidth: 1.2,
                              ),
                          ],
                        ),
                        MarkerLayer(
                          markers: [
                            for (int i = 0; i < widget.checkpoints.length; i++)
                              Marker(
                                point: ll.LatLng(
                                  widget.checkpoints[i].latitude,
                                  widget.checkpoints[i].longitude,
                                ),
                                width: 26,
                                height: 26,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: i == 0
                                        ? const Color(0xFF2E7D32)
                                        : (i == widget.checkpoints.length - 1
                                              ? const Color(0xFFC62828)
                                              : const Color(0xFFEF6C00)),
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: Colors.white,
                                      width: 2.0,
                                    ),
                                    boxShadow: const [
                                      BoxShadow(
                                        color: Color(0x33000000),
                                        blurRadius: 3,
                                        offset: Offset(0, 1.5),
                                      ),
                                    ],
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    '${i + 1}',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                              ),
                            if (hasFix)
                              Marker(
                                point: ll.LatLng(
                                  widget.location.sample!.latitude,
                                  widget.location.sample!.longitude,
                                ),
                                width: 24,
                                height: 24,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: isStale
                                        ? AppColors.statusNeutral
                                        : AppColors.brandPrimary,
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: Colors.white,
                                      width: 2.5,
                                    ),
                                    boxShadow: const [
                                      BoxShadow(
                                        color: Color(0x40000000),
                                        blurRadius: 4,
                                        offset: Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        ),
                        Align(
                          alignment: Alignment.bottomCenter,
                          child: Padding(
                            padding: EdgeInsets.only(bottom: 2.0),
                            child: GestureDetector(
                              onTap: () => showDialog<void>(
                                context: context,
                                builder: (context) => const AlertDialog(
                                  title: Text('Nguồn dữ liệu bản đồ'),
                                  content: SelectableText(
                                    '© OpenStreetMap contributors\nDữ liệu theo giấy phép ODbL.\nhttps://www.openstreetmap.org/copyright\n\nBản thử raster tự dựng; không có DEM hoặc đường đồng mức. Độ phủ đường mòn phụ thuộc dữ liệu OSM.',
                                  ),
                                ),
                              ),
                              child: const Text(
                                '© OpenStreetMap contributors · ODbL ⓘ',
                                style: TextStyle(
                                  fontSize: 8.0,
                                  color: Color(0x99000000),
                                  backgroundColor: Color(0xCCFFFFFF),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                // Mode B: Fallback Neutral Vector Canvas (when no MBTiles is available)
                if (_mbtilesDb == null && viewport != null) ...[
                  // 1. Static Route & Neutral Survey Grid layer (Background)
                  RepaintBoundary(
                    child: CustomPaint(
                      size: canvasSize,
                      painter: _OfflineRoutePainter(
                        viewport: viewport,
                        route: widget.route!,
                        checkpoints: widget.checkpoints,
                        panOffset: _panOffset,
                        zoomScale: _zoomScale,
                      ),
                    ),
                  ),

                  // 2. Dynamic Foreground layer (GPS marker & Checkpoint pins)
                  AnimatedBuilder(
                    animation: _pulseAnimation!,
                    builder: (context, _) {
                      return CustomPaint(
                        size: canvasSize,
                        painter: _OfflineMarkerPainter(
                          viewport: viewport,
                          checkpoints: widget.checkpoints,
                          location: widget.location,
                          isStale: isStale,
                          pulseValue: disableAnimations
                              ? 0.0
                              : _pulseAnimation!.value,
                          panOffset: _panOffset,
                          zoomScale: _zoomScale,
                        ),
                      );
                    },
                  ),

                  // 3. Gesture detector & Pointer listener
                  if (widget.interactive)
                    Positioned.fill(
                      child: Listener(
                        onPointerSignal: (pointerSignal) {
                          if (pointerSignal is PointerScrollEvent) {
                            if (pointerSignal.scrollDelta.dy < 0) {
                              zoomIn();
                            } else if (pointerSignal.scrollDelta.dy > 0) {
                              zoomOut();
                            }
                          }
                        },
                        child: GestureDetector(
                          key: const Key('offline-map-gesture-area'),
                          behavior: HitTestBehavior.opaque,
                          onScaleStart: (details) {
                            _baseScaleOnGesture = _zoomScale;
                          },
                          onScaleUpdate: (details) {
                            setState(() {
                              _autoFollowGps = false;
                              _panOffset += details.focalPointDelta;
                              if (details.scale != 1.0) {
                                _zoomScale =
                                    (_baseScaleOnGesture * details.scale).clamp(
                                      0.6,
                                      6.0,
                                    );
                              }
                            });
                          },
                          onDoubleTapDown: (_) => zoomIn(),
                          onDoubleTap: zoomIn,
                          onTapUp: (details) => _handleCanvasTap(
                            details.localPosition,
                            canvasSize,
                          ),
                        ),
                      ),
                    ),
                ],

                // Empty state if route is null
                if (viewport == null)
                  const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.terrain_outlined,
                          size: 44,
                          color: AppColors.textMuted,
                        ),
                        SizedBox(height: AppSpacing.xs),
                        Text(
                          'Chưa có dữ liệu tuyến đường',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),

                // 4. Compass Rose in top-left
                if (viewport != null)
                  const Positioned(
                    top: AppSpacing.sm,
                    left: AppSpacing.sm,
                    child: _CompassRose(),
                  ),

                // 5. Next Checkpoint HUD card (centered at top, safe margin to clear compass and zoom controls)
                if (viewport != null && nextCheckpoint != null && hasFix)
                  Positioned(
                    top: AppSpacing.sm,
                    left: 56,
                    right: 56,
                    child: Align(
                      alignment: Alignment.topCenter,
                      child: _NextCheckpointHud(
                        info: nextCheckpoint,
                        onTap: () => focusOnCheckpoint(
                          nextCheckpoint.checkpoint,
                          canvasSize,
                        ),
                      ),
                    ),
                  ),

                // Missing GPS does not imply that the offline basemap is missing.
                if (viewport != null && !hasFix && _mbtilesDb == null)
                  Positioned(
                    top: AppSpacing.sm,
                    left: 56,
                    right: 56,
                    child: Align(
                      alignment: Alignment.topCenter,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.88),
                          borderRadius: BorderRadius.circular(4.0),
                          border: Border.all(
                            color: const Color(0xFFD0D8C4),
                            width: 0.8,
                          ),
                        ),
                        child: const Text(
                          'Sơ đồ tuyến đường & trạm kiểm tra (Chưa có nền bản đồ)',
                          style: TextStyle(
                            fontSize: 9.0,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textMuted,
                          ),
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ),

                // 7. Map Control Overlay Buttons in top-right
                if (widget.interactive && viewport != null)
                  Positioned(
                    top: AppSpacing.sm,
                    right: AppSpacing.sm,
                    child: _MapControlsOverlay(
                      canRecenter: hasFix,
                      isAutoFollow: _autoFollowGps && hasFix,
                      onRecenter: () => recenterOnGps(canvasSize),
                      onFitRoute: fitRoute,
                      onZoomIn: zoomIn,
                      onZoomOut: zoomOut,
                    ),
                  ),

                // 8. Metric Dynamic Scale Bar in bottom-right
                if (viewport != null && _mbtilesDb == null)
                  Positioned(
                    bottom: AppSpacing.sm,
                    right: AppSpacing.sm,
                    child: _ScaleBar(viewport: viewport, zoomScale: _zoomScale),
                  ),

                // 9. GPS Signal Quality badge in bottom-left
                if (hasFix)
                  Positioned(
                    bottom: AppSpacing.sm,
                    left: AppSpacing.sm,
                    child: _GpsAccuracyBadge(
                      accuracyMeters: widget.location.sample!.accuracyMeters,
                      quality: widget.location.quality,
                      isStale: isStale,
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Static map layer: renders neutral cartographic survey grid and realistic trail with direction chevrons.
/// Strictly avoids synthetic/decorative contour lines to ensure domain safety and integrity.
class _OfflineRoutePainter extends CustomPainter {
  _OfflineRoutePainter({
    required this.viewport,
    required this.route,
    required this.checkpoints,
    required this.panOffset,
    required this.zoomScale,
  }) : super(repaint: null);

  final OfflineMapViewport viewport;
  final OfflineRouteGeometry route;
  final List<OfflineMapCheckpoint> checkpoints;
  final Offset panOffset;
  final double zoomScale;

  @override
  void paint(Canvas canvas, Size size) {
    _paintNeutralSurveyBackground(canvas, size);
    _paintRoute(canvas, size);
    _paintCheckpointRadii(canvas, size);
  }

  void _paintNeutralSurveyBackground(Canvas canvas, Size size) {
    // 1. Soft neutral outdoor survey base
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = const Color(0xFFF7F8F4),
    );

    // 2. Cartographic survey grid with fine coordinate crosshairs
    final gridLinePaint = Paint()
      ..color = const Color(0xFFE5EADF)
      ..strokeWidth = 0.7
      ..style = PaintingStyle.stroke;

    final crosshairPaint = Paint()
      ..color = const Color(0xFFBAC5B0)
      ..strokeWidth = 0.9
      ..style = PaintingStyle.stroke;

    const spacing = 48.0;
    const tickLen = 3.5;

    // Draw coordinate survey grid lines
    for (double x = spacing; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridLinePaint);
    }
    for (double y = spacing; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridLinePaint);
    }

    // Draw survey crosshairs '+' at grid intersections
    for (double x = spacing; x < size.width; x += spacing) {
      for (double y = spacing; y < size.height; y += spacing) {
        canvas.drawLine(
          Offset(x - tickLen, y),
          Offset(x + tickLen, y),
          crosshairPaint,
        );
        canvas.drawLine(
          Offset(x, y - tickLen),
          Offset(x, y + tickLen),
          crosshairPaint,
        );
      }
    }
  }

  void _paintRoute(Canvas canvas, Size size) {
    final points = route.points;
    if (points.length < 2) return;

    final screenPoints = points
        .map(
          (p) => viewport.geoToScreen(
            p.latitude,
            p.longitude,
            panOffset: panOffset,
            zoomScale: zoomScale,
          ),
        )
        .toList();

    final path = Path();
    path.moveTo(screenPoints.first.dx, screenPoints.first.dy);
    for (int i = 1; i < screenPoints.length; i++) {
      path.lineTo(screenPoints[i].dx, screenPoints[i].dy);
    }

    // 1. Soft trail ground drop shadow for depth
    final shadowPaint = Paint()
      ..color = const Color(0x24000000)
      ..strokeWidth = 8.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2.5);
    canvas.drawPath(path, shadowPaint);

    // 2. High-contrast white casing
    final casingPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 6.2
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, casingPaint);

    // 3. Vibrant alpine trekking trail line (High-visibility Terracotta Trail)
    const trailColor = Color(0xFFD84315);
    final linePaint = Paint()
      ..color = trailColor
      ..strokeWidth = 3.8
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, linePaint);

    // 4. Dashed footpath centerline
    _paintDashedFootpath(canvas, screenPoints);

    // 5. Directional chevrons along segments pointing forward
    _paintDirectionChevrons(canvas, screenPoints, trailColor);

    // 6. Distinct Start & Finish nodes
    _paintStartFinishNodes(canvas, screenPoints.first, screenPoints.last);
  }

  void _paintDashedFootpath(Canvas canvas, List<Offset> points) {
    final dashPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.85)
      ..strokeWidth = 1.3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.butt;

    const dashLen = 4.0;
    const gapLen = 3.5;

    for (int i = 0; i < points.length - 1; i++) {
      final p1 = points[i];
      final p2 = points[i + 1];
      final dx = p2.dx - p1.dx;
      final dy = p2.dy - p1.dy;
      final dist = sqrt(dx * dx + dy * dy);
      if (dist <= 0) continue;

      final ux = dx / dist;
      final uy = dy / dist;

      double cur = 0;
      while (cur < dist) {
        final next = min(cur + dashLen, dist);
        canvas.drawLine(
          Offset(p1.dx + ux * cur, p1.dy + uy * cur),
          Offset(p1.dx + ux * next, p1.dy + uy * next),
          dashPaint,
        );
        cur += dashLen + gapLen;
      }
    }
  }

  void _paintDirectionChevrons(
    Canvas canvas,
    List<Offset> points,
    Color color,
  ) {
    final chevronCasing = Paint()
      ..color = Colors.white
      ..strokeWidth = 3.2
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.miter;

    final chevronPaint = Paint()
      ..color = color
      ..strokeWidth = 1.8
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.miter;

    const arrowWingLen = 5.5;
    const arrowAngle = 0.52; // ~30 degrees in radians

    for (int i = 0; i < points.length - 1; i++) {
      final p1 = points[i];
      final p2 = points[i + 1];
      final dx = p2.dx - p1.dx;
      final dy = p2.dy - p1.dy;
      final dist = sqrt(dx * dx + dy * dy);
      if (dist < 28.0) continue;

      final heading = atan2(dy, dx);
      final count = max(1, (dist / 48.0).floor());
      final step = dist / (count + 1);

      for (int k = 1; k <= count; k++) {
        final cx = p1.dx + (dx / dist) * (step * k);
        final cy = p1.dy + (dy / dist) * (step * k);

        final pLeft = Offset(
          cx - arrowWingLen * cos(heading - arrowAngle),
          cy - arrowWingLen * sin(heading - arrowAngle),
        );
        final pRight = Offset(
          cx - arrowWingLen * cos(heading + arrowAngle),
          cy - arrowWingLen * sin(heading + arrowAngle),
        );

        final arrowPath = Path()
          ..moveTo(pLeft.dx, pLeft.dy)
          ..lineTo(cx, cy)
          ..lineTo(pRight.dx, pRight.dy);

        canvas.drawPath(arrowPath, chevronCasing);
        canvas.drawPath(arrowPath, chevronPaint);
      }
    }
  }

  void _paintStartFinishNodes(Canvas canvas, Offset start, Offset finish) {
    // Start node (Forest Green)
    canvas.drawCircle(start, 6.0, Paint()..color = Colors.white);
    canvas.drawCircle(start, 4.2, Paint()..color = const Color(0xFF2E7D32));
    canvas.drawCircle(start, 1.8, Paint()..color = Colors.white);

    // Finish node (Crimson with concentric ring)
    canvas.drawCircle(finish, 6.5, Paint()..color = Colors.white);
    canvas.drawCircle(finish, 4.5, Paint()..color = const Color(0xFFC62828));
    canvas.drawCircle(finish, 2.0, Paint()..color = Colors.white);
  }

  void _paintCheckpointRadii(Canvas canvas, Size size) {
    for (final cp in checkpoints) {
      final center = viewport.geoToScreen(
        cp.latitude,
        cp.longitude,
        panOffset: panOffset,
        zoomScale: zoomScale,
      );

      final r = max(
        viewport.metersToPixels(cp.radiusMeters, zoomScale: zoomScale),
        8.0,
      );

      final fillPaint = Paint()
        ..color = const Color(0xFF2E7D32).withValues(alpha: 0.08)
        ..style = PaintingStyle.fill;
      canvas.drawCircle(center, r, fillPaint);

      final strokePaint = Paint()
        ..color = const Color(0xFF2E7D32).withValues(alpha: 0.35)
        ..strokeWidth = 1.0
        ..style = PaintingStyle.stroke;
      canvas.drawCircle(center, r, strokePaint);
    }
  }

  @override
  bool shouldRepaint(covariant _OfflineRoutePainter oldDelegate) {
    return oldDelegate.viewport != viewport ||
        oldDelegate.route != route ||
        oldDelegate.checkpoints != checkpoints ||
        oldDelegate.panOffset != panOffset ||
        oldDelegate.zoomScale != zoomScale;
  }
}

/// Dynamic foreground layer: paints fixed-pixel size markers (checkpoints, GPS dot, accuracy circle).
class _OfflineMarkerPainter extends CustomPainter {
  _OfflineMarkerPainter({
    required this.viewport,
    required this.checkpoints,
    required this.location,
    required this.isStale,
    required this.pulseValue,
    required this.panOffset,
    required this.zoomScale,
  });

  final OfflineMapViewport viewport;
  final List<OfflineMapCheckpoint> checkpoints;
  final OfflineMapLocationState location;
  final bool isStale;
  final double pulseValue;
  final Offset panOffset;
  final double zoomScale;

  @override
  void paint(Canvas canvas, Size size) {
    _paintCheckpoints(canvas, size);
    _paintGpsLocation(canvas, size);
  }

  void _paintCheckpoints(Canvas canvas, Size size) {
    final textPainter = TextPainter(textDirection: TextDirection.ltr);

    for (int i = 0; i < checkpoints.length; i++) {
      final cp = checkpoints[i];
      final pos = viewport.geoToScreen(
        cp.latitude,
        cp.longitude,
        panOffset: panOffset,
        zoomScale: zoomScale,
      );

      // Pin color coding
      final Color pinColor;
      final typeLower = cp.type.toLowerCase();
      if (i == 0 || typeLower.contains('start')) {
        pinColor = const Color(0xFF2E7D32); // Forest Green for Start
      } else if (i == checkpoints.length - 1 ||
          typeLower.contains('end') ||
          typeLower.contains('summit')) {
        pinColor = const Color(0xFFC62828); // Summit Crimson for Finish
      } else if (typeLower.contains('rest') || typeLower.contains('camp')) {
        pinColor = const Color(0xFFE65100); // Amber for Rest stop
      } else {
        pinColor = const Color(0xFF00695C); // Pine Teal for standard checkpoint
      }

      // Checkpoint pin icon background with drop shadow
      const pinRadius = 9.5;
      final shadowPaint = Paint()
        ..color = const Color(0x33000000)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2.0);
      canvas.drawCircle(
        Offset(pos.dx, pos.dy + 1.2),
        pinRadius + 1.0,
        shadowPaint,
      );

      // White halo
      canvas.drawCircle(pos, pinRadius + 1.5, Paint()..color = Colors.white);
      // Colored pin body
      canvas.drawCircle(pos, pinRadius, Paint()..color = pinColor);

      // Order index number
      final label = (i + 1).toString();
      textPainter.text = TextSpan(
        text: label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10.5,
          fontWeight: FontWeight.w900,
        ),
      );
      textPainter.layout();
      textPainter.paint(
        canvas,
        Offset(pos.dx - textPainter.width / 2, pos.dy - textPainter.height / 2),
      );

      // Checkpoint name label inside a clean frosted pill badge
      final formattedCpName = cp.name.replaceAllMapped(
        RegExp(r'\((\d+)\s*m\)'),
        (m) => '(độ cao ↑${m[1]} m)',
      );
      textPainter.text = TextSpan(
        text: formattedCpName,
        style: const TextStyle(
          color: AppColors.textPrimary,
          fontSize: 9.5,
          fontWeight: FontWeight.w700,
        ),
      );
      textPainter.layout(maxWidth: 125);

      final pillW = textPainter.width + 10.0;
      final pillH = textPainter.height + 4.0;
      final pillRect = Rect.fromLTWH(
        pos.dx - pillW / 2,
        pos.dy + pinRadius + 3.0,
        pillW,
        pillH,
      );
      final pillRRect = RRect.fromRectAndRadius(
        pillRect,
        const Radius.circular(4.0),
      );

      // Pill shadow, fill and border
      canvas.drawRRect(
        pillRRect,
        Paint()
          ..color = const Color(0x18000000)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.5),
      );
      canvas.drawRRect(
        pillRRect,
        Paint()..color = Colors.white.withValues(alpha: 0.94),
      );
      canvas.drawRRect(
        pillRRect,
        Paint()
          ..color = const Color(0xFFBACAA3)
          ..strokeWidth = 0.8
          ..style = PaintingStyle.stroke,
      );

      textPainter.paint(
        canvas,
        Offset(pos.dx - textPainter.width / 2, pos.dy + pinRadius + 5.0),
      );
    }
  }

  void _paintGpsLocation(Canvas canvas, Size size) {
    final sample = location.sample;
    if (sample == null || location.status != OfflineMapGpsStatus.ready) {
      return;
    }

    final pos = viewport.geoToScreen(
      sample.latitude,
      sample.longitude,
      panOffset: panOffset,
      zoomScale: zoomScale,
    );

    // Compute ground accuracy circle radius in pixels
    final baseRadius = max(
      viewport.metersToPixels(sample.accuracyMeters, zoomScale: zoomScale),
      12.0,
    );

    final isGood = location.quality == GpsSignalQuality.good;

    final Color accuracyColor;
    if (isStale) {
      accuracyColor = AppColors.statusNeutral;
    } else if (isGood) {
      accuracyColor = AppColors.statusSuccess;
    } else {
      accuracyColor = AppColors.statusWarning;
    }

    // 1. Accuracy circle fill
    final fillPaint = Paint()
      ..color = accuracyColor.withValues(alpha: isStale ? 0.08 : 0.16)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(pos, baseRadius, fillPaint);

    // 2. Accuracy circle stroke
    final strokePaint = Paint()
      ..color = accuracyColor.withValues(alpha: isStale ? 0.35 : 0.70)
      ..strokeWidth = isStale ? 1.0 : 1.5
      ..style = PaintingStyle.stroke;
    canvas.drawCircle(pos, baseRadius, strokePaint);

    // 3. Pulsing outer ring (when fresh)
    if (!isStale && pulseValue > 0) {
      final pulseRadius = 7.0 + pulseValue * 6.0;
      final pulsePaint = Paint()
        ..color = accuracyColor.withValues(alpha: (1.0 - pulseValue) * 0.40)
        ..style = PaintingStyle.fill;
      canvas.drawCircle(pos, pulseRadius, pulsePaint);
    }

    // 4. Center GPS dot (Fixed size in screen pixels)
    const dotRadius = 5.5;
    // White ring
    canvas.drawCircle(pos, dotRadius + 2.0, Paint()..color = Colors.white);
    // Colored center
    canvas.drawCircle(pos, dotRadius, Paint()..color = accuracyColor);
  }

  @override
  bool shouldRepaint(covariant _OfflineMarkerPainter oldDelegate) {
    return oldDelegate.viewport != viewport ||
        oldDelegate.checkpoints != checkpoints ||
        oldDelegate.location != location ||
        oldDelegate.isStale != isStale ||
        oldDelegate.pulseValue != pulseValue ||
        oldDelegate.panOffset != panOffset ||
        oldDelegate.zoomScale != zoomScale;
  }
}

/// Floating Compass Rose indicator in top-left corner.
class _CompassRose extends StatelessWidget {
  const _CompassRose();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.92),
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFFBACAA3), width: 1.0),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.navigation, size: 14, color: Color(0xFFC62828)),
            const Text(
              'N',
              style: TextStyle(
                color: Color(0xFFC62828),
                fontSize: 8.5,
                fontWeight: FontWeight.w900,
                height: 0.9,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Thông tin tính toán trạm kiểm tra kế tiếp và trạng thái đã tới trạm.
class NextCheckpointInfo {
  const NextCheckpointInfo({
    required this.checkpoint,
    required this.distanceMeters,
    this.isArrived = false,
    this.arrivedCheckpoint,
  });

  /// Checkpoint mục tiêu kế tiếp (hoặc trạm đích)
  final OfflineMapCheckpoint checkpoint;

  /// Khoảng cách từ vị trí hiện tại tới checkpoint mục tiêu
  final double distanceMeters;

  /// Đang đứng bên trong bán kính của một checkpoint
  final bool isArrived;

  /// Checkpoint mà người dùng đang đứng bên trong (nếu có)
  final OfflineMapCheckpoint? arrivedCheckpoint;
}

/// Floating HUD card indicating the next upcoming checkpoint on trail with live distance.
class _NextCheckpointHud extends StatelessWidget {
  const _NextCheckpointHud({required this.info, required this.onTap});

  final NextCheckpointInfo info;
  final VoidCallback onTap;

  /// Loại bỏ phần mở rộng trong ngoặc như độ cao để giữ chip siêu ngắn gọn, chống tràn chữ
  static String _shortName(String name) {
    return name.replaceAll(RegExp(r'\s*\([^)]*\)'), '').trim();
  }

  @override
  Widget build(BuildContext context) {
    final dist = info.distanceMeters;
    final distStr = dist < 1000
        ? '${dist.round()} m'
        : '${(dist / 1000.0).toStringAsFixed(1)} km';

    final isArrived = info.isArrived;
    final arrivedName = info.arrivedCheckpoint != null
        ? _shortName(info.arrivedCheckpoint!.name)
        : '';
    final nextName = _shortName(info.checkpoint.name);
    final isFinalDestination =
        isArrived && info.checkpoint == info.arrivedCheckpoint;

    final IconData iconData;
    final Color iconColor;
    final String titleText;
    final String? subtitleText;

    if (isFinalDestination) {
      iconData = Icons.flag_circle;
      iconColor = AppColors.brandPrimary;
      titleText = 'Gần điểm cuối: $arrivedName';
      subtitleText = null;
    } else if (isArrived) {
      iconData = Icons.check_circle;
      iconColor = const Color(0xFF2E7D32);
      titleText = 'Trong vùng: $arrivedName';
      subtitleText = ' · Kế tiếp: $nextName (~$distStr)';
    } else {
      iconData = Icons.near_me;
      iconColor = AppColors.brandPrimary;
      titleText = 'Trạm kế: $nextName';
      subtitleText = ' · ~$distStr';
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4.5),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isArrived
                ? const Color(0xFF81C784)
                : const Color(0xFFBACAA3),
            width: 1.0,
          ),
          boxShadow: AppColors.cardShadowSm,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(iconData, size: 13, color: iconColor),
            const SizedBox(width: AppSpacing.xs),
            Flexible(
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: titleText,
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        color: isArrived
                            ? const Color(0xFF1B5E20)
                            : AppColors.textPrimary,
                      ),
                    ),
                    if (subtitleText != null)
                      TextSpan(
                        text: subtitleText,
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          color: AppColors.brandPrimary,
                        ),
                      ),
                  ],
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Dynamic metric scale bar in bottom-right corner.
class _ScaleBar extends StatelessWidget {
  const _ScaleBar({required this.viewport, required this.zoomScale});

  final OfflineMapViewport viewport;
  final double zoomScale;

  @override
  Widget build(BuildContext context) {
    const candidateMeters = [25, 50, 100, 200, 500, 1000, 2000, 5000];
    int selectedMeters = 100;
    double bestWidth = 52.0;

    for (final m in candidateMeters) {
      final px = viewport.metersToPixels(m.toDouble(), zoomScale: zoomScale);
      if (px >= 36.0 && px <= 88.0) {
        selectedMeters = m;
        bestWidth = px;
        break;
      }
    }

    if (bestWidth < 30.0) {
      for (final m in candidateMeters.reversed) {
        final px = viewport.metersToPixels(m.toDouble(), zoomScale: zoomScale);
        if (px >= 30.0) {
          selectedMeters = m;
          bestWidth = px.clamp(30.0, 95.0);
          break;
        }
      }
    }

    final label = selectedMeters >= 1000
        ? '${(selectedMeters / 1000).toStringAsFixed(selectedMeters % 1000 == 0 ? 0 : 1)} km'
        : '$selectedMeters m';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(4.0),
        border: Border.all(color: const Color(0xFFBACAA3), width: 0.8),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 9.0,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
              height: 1.0,
            ),
          ),
          const SizedBox(height: 2),
          CustomPaint(size: Size(bestWidth, 5), painter: _ScaleBarPainter()),
        ],
      ),
    );
  }
}

class _ScaleBarPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.textPrimary
      ..strokeWidth = 1.3
      ..style = PaintingStyle.stroke;

    canvas.drawLine(
      Offset(0, size.height / 2),
      Offset(size.width, size.height / 2),
      paint,
    );
    canvas.drawLine(Offset(0, 0), Offset(0, size.height), paint);
    canvas.drawLine(
      Offset(size.width, 0),
      Offset(size.width, size.height),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Floating control buttons on the map canvas.
class _MapControlsOverlay extends StatelessWidget {
  const _MapControlsOverlay({
    required this.canRecenter,
    this.isAutoFollow = false,
    required this.onRecenter,
    required this.onFitRoute,
    required this.onZoomIn,
    required this.onZoomOut,
  });

  final bool canRecenter;
  final bool isAutoFollow;
  final VoidCallback onRecenter;
  final VoidCallback onFitRoute;
  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: const Color(0xFFBACAA3), width: 1.0),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _ControlButton(
            key: const Key('offline-map-btn-zoom-in'),
            icon: Icons.add,
            tooltip: 'Phóng to',
            onPressed: onZoomIn,
          ),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          _ControlButton(
            key: const Key('offline-map-btn-zoom-out'),
            icon: Icons.remove,
            tooltip: 'Thu nhỏ',
            onPressed: onZoomOut,
          ),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          _ControlButton(
            key: const Key('offline-map-btn-fit-route'),
            icon: Icons.crop_free_outlined,
            tooltip: 'Xem toàn tuyến',
            onPressed: onFitRoute,
          ),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          _ControlButton(
            key: const Key('offline-map-btn-recenter'),
            icon: isAutoFollow ? Icons.gps_fixed : Icons.my_location,
            tooltip: canRecenter
                ? (isAutoFollow ? 'Đang bám theo vị trí' : 'Về vị trí hiện tại')
                : 'Chưa có tín hiệu GPS',
            onPressed: canRecenter ? onRecenter : null,
            iconColor: canRecenter
                ? (isAutoFollow
                      ? AppColors.brandPrimary
                      : AppColors.brandSecondary)
                : AppColors.textMuted,
          ),
        ],
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  const _ControlButton({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.iconColor,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onPressed,
        borderRadius: AppRadius.controlBorderRadius,
        child: SizedBox(
          width: 34,
          height: 34,
          child: Icon(
            icon,
            size: 18,
            color: onPressed == null
                ? AppColors.textMuted.withValues(alpha: 0.4)
                : (iconColor ?? AppColors.textPrimary),
          ),
        ),
      ),
    );
  }
}

/// Compact GPS accuracy and freshness chip placed on top of the map.
class _GpsAccuracyBadge extends StatelessWidget {
  const _GpsAccuracyBadge({
    required this.accuracyMeters,
    required this.quality,
    required this.isStale,
  });

  final double accuracyMeters;
  final GpsSignalQuality? quality;
  final bool isStale;

  @override
  Widget build(BuildContext context) {
    final (label, icon, color, bg) = switch ((isStale, quality)) {
      (true, _) => (
        'Mẫu cũ (>30s) · ±${accuracyMeters.toStringAsFixed(1)} m',
        Icons.history_toggle_off,
        AppColors.statusNeutral,
        AppColors.statusNeutralBg,
      ),
      (false, GpsSignalQuality.good) => (
        'GPS ±${accuracyMeters.toStringAsFixed(1)} m (Tốt)',
        Icons.gps_fixed,
        AppColors.statusSuccess,
        AppColors.statusSuccessBg,
      ),
      (false, _) => (
        'GPS ±${accuracyMeters.toStringAsFixed(1)} m (Sai số > 20m)',
        Icons.gps_not_fixed,
        AppColors.statusWarning,
        AppColors.statusWarningBg,
      ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: AppRadius.pillBorderRadius,
        border: Border.all(color: color.withValues(alpha: 0.35), width: 1.0),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            style: AppTypography.caption.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
              fontSize: 10.5,
            ),
          ),
        ],
      ),
    );
  }
}
