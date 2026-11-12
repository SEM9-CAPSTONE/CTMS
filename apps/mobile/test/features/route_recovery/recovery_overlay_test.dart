import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/offline_map/presentation/widgets/offline_map_canvas.dart';
import 'package:mobile/features/route_recovery/domain/recovery_geometry.dart';
import 'package:mobile/features/route_recovery/presentation/recovery_overlay.dart';
import 'recovery_fixtures.dart';

void main() {
  testWidgets(
    'vector fallback renders recovery overlay and removes it when guidance is withheld',
    (tester) async {
      final key = GlobalKey<OfflineMapCanvasState>();
      Widget app(RecoveryTarget? target) => MaterialApp(
        home: Scaffold(
          body: OfflineMapCanvas(
            key: key,
            route: recoveryContext().route,
            recoveryTarget: target,
            recoveryNotice: target == null
                ? 'Thiếu/hỏng dữ liệu tuyến · Tạm ẩn hướng'
                : null,
          ),
        ),
      );
      final target = nearestRecoveryTarget(
        const RecoveryPoint(.001, .005),
        const [RecoveryPoint(0, 0), RecoveryPoint(0, .01)],
      )!;
      await tester.pumpWidget(app(target));
      await tester.pump();
      final overlay = find.byWidgetPredicate(
        (w) => w is CustomPaint && w.painter is RecoveryVectorPainter,
      );
      expect(overlay, findsOneWidget);
      key.currentState!.focusOnRecovery(const Size(360, 280));
      await tester.pump();
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(app(null));
      await tester.pump();
      expect(overlay, findsNothing);
      expect(find.byKey(const Key('recovery-map-notice')), findsOneWidget);
      expect(
        find.text('Thiếu/hỏng dữ liệu tuyến · Tạm ẩn hướng'),
        findsOneWidget,
      );
      await tester.pumpWidget(const SizedBox());
    },
  );
}
