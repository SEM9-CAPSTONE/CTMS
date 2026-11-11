import 'dart:math';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart' show LatLng;
import '../domain/recovery_geometry.dart';

const recoveryColor = Color(0xFF512DA8);

class RecoveryDistanceLabel extends StatelessWidget {
  const RecoveryDistanceLabel(this.meters, {super.key});
  final double meters;
  @override
  Widget build(BuildContext context) => Container(
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: recoveryColor),
    ),
    child: Text(
      '${meters.round()} m',
      style: const TextStyle(color: recoveryColor, fontWeight: FontWeight.w800),
    ),
  );
}

class RecoveryMarker extends StatelessWidget {
  const RecoveryMarker({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Điểm quay lại tuyến, ký hiệu hình thoi',
    child: Transform.rotate(
      angle: pi / 4,
      child: Container(
        width: 24,
        height: 24,
        decoration: BoxDecoration(
          color: recoveryColor,
          border: Border.all(color: Colors.white, width: 3),
          borderRadius: BorderRadius.circular(2),
        ),
        child: Transform.rotate(
          angle: -pi / 4,
          child: const Icon(Icons.turn_left, color: Colors.white, size: 17),
        ),
      ),
    ),
  );
}

List<List<LatLng>> recoveryDashes(RecoveryTarget target) {
  final steps = (target.distanceMeters / 15).ceil().clamp(2, 160);
  final lonDelta =
      (target.point.longitude - target.origin.longitude + 180) % 360 - 180;
  LatLng at(double t) => LatLng(
    target.origin.latitude +
        t * (target.point.latitude - target.origin.latitude),
    (target.origin.longitude + t * lonDelta + 180) % 360 - 180,
  );
  return [
    for (var i = 0; i < steps; i += 2) [at(i / steps), at((i + 1) / steps)],
  ];
}

class RecoveryVectorPainter extends CustomPainter {
  RecoveryVectorPainter(this.target, this.project);
  final RecoveryTarget target;
  final Offset Function(RecoveryPoint) project;
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.clipRect(Offset.zero & size);
    final a = project(target.origin), b = project(target.point);
    final length = (b - a).distance;
    for (var d = 0.0; d < length; d += 14) {
      final start = Offset.lerp(a, b, d / length)!;
      final end = Offset.lerp(a, b, min(d + 8, length) / length)!;
      canvas.drawLine(
        start,
        end,
        Paint()
          ..color = Colors.white
          ..strokeWidth = 6,
      );
      canvas.drawLine(
        start,
        end,
        Paint()
          ..color = recoveryColor
          ..strokeWidth = 3,
      );
    }
    final diamond = Path()
      ..moveTo(b.dx, b.dy - 12)
      ..lineTo(b.dx + 12, b.dy)
      ..lineTo(b.dx, b.dy + 12)
      ..lineTo(b.dx - 12, b.dy)
      ..close();
    canvas.drawPath(diamond, Paint()..color = recoveryColor);
    canvas.drawPath(
      diamond,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant RecoveryVectorPainter oldDelegate) => true;
}
