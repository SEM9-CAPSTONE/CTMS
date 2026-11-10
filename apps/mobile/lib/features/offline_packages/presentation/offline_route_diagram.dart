import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../domain/offline_trip.dart';

class OfflineRouteDiagram extends StatelessWidget {
  const OfflineRouteDiagram({super.key, required this.trip});

  final OfflineTrip trip;

  @override
  Widget build(BuildContext context) => Semantics(
    image: true,
    label: 'Sơ đồ tuyến đường từ dữ liệu đã lưu',
    child: ClipRRect(
      borderRadius: AppRadius.cardBorderRadius,
      child: ColoredBox(
        color: AppColors.brandLight,
        child: SizedBox(
          width: double.infinity,
          height: 260,
          child: InteractiveViewer(
            maxScale: 8,
            child: CustomPaint(painter: _RoutePainter(trip)),
          ),
        ),
      ),
    ),
  );
}

class _RoutePainter extends CustomPainter {
  _RoutePainter(this.trip);

  final OfflineTrip trip;

  @override
  void paint(Canvas canvas, Size size) {
    const padding = AppSpacing.xl;
    if (size.shortestSide <= 2 * padding) return;

    final anchor = trip.route.first;
    final longitudeScale = math.max(
      0.000001,
      math.cos(anchor.latitude * math.pi / 180),
    );
    Offset project(OfflinePosition position, double reference) {
      final longitude = position.longitude;
      final nearest = reference + (longitude - reference + 180) % 360 - 180;
      return Offset(
        (nearest - anchor.longitude) * longitudeScale,
        anchor.latitude - position.latitude,
      );
    }

    var reference = anchor.longitude;
    final points = trip.route.map((position) {
      final point = project(position, reference);
      reference = anchor.longitude + point.dx / longitudeScale;
      return point;
    }).toList();
    final centerLongitude =
        anchor.longitude + points.last.dx / (2 * longitudeScale);
    final checkpoints = trip.checkpoints
        .map((checkpoint) => project(checkpoint.position, centerLongitude))
        .toList();
    var bounds = Rect.fromPoints(points.first, points.first);
    for (final point in points.followedBy(checkpoints)) {
      bounds = bounds.expandToInclude(Rect.fromPoints(point, point));
    }

    final scale = math.min(
      (size.width - 2 * padding) / math.max(bounds.width, 0.000001),
      (size.height - 2 * padding) / math.max(bounds.height, 0.000001),
    );
    Offset fit(Offset point) =>
        size.center(Offset.zero) + (point - bounds.center) * scale;

    final path = Path()..addPolygon(points.map(fit).toList(), false);
    canvas.drawPath(
      path,
      Paint()
        ..color = AppColors.brandAccent
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    for (final checkpoint in checkpoints) {
      final position = fit(checkpoint);
      canvas.drawCircle(position, 5, Paint()..color = AppColors.surface);
      canvas.drawCircle(position, 3, Paint()..color = AppColors.camperLake);
    }
  }

  @override
  bool shouldRepaint(_RoutePainter oldDelegate) => oldDelegate.trip != trip;
}
