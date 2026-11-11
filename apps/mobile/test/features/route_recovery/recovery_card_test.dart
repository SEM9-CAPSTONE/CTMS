import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/route_recovery/domain/recovery_state.dart';
import 'package:mobile/features/route_recovery/domain/recovery_geometry.dart';
import 'package:mobile/features/route_recovery/presentation/recovery_card.dart';

void main() {
  testWidgets(
    'offline warning can close and returns on a new offline episode',
    (tester) async {
      const target = RecoveryTarget(
        RecoveryPoint(.001, .005),
        RecoveryPoint(0, .005),
        111,
        180,
      );
      Future<void> show(RecoveryDisplay display) => tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: RecoveryCardContent(
              view: RecoveryView(display, target: target),
              onRetry: () {},
              onFocus: () {},
            ),
          ),
        ),
      );
      await show(RecoveryDisplay.offlineReady);
      await tester.tap(
        find.byKey(const Key('dismiss-recovery-offline-notice')),
      );
      await tester.pump();
      expect(
        find.textContaining('Chưa xác thực lại với máy chủ'),
        findsNothing,
      );
      expect(find.text('111 m'), findsOneWidget);
      await show(RecoveryDisplay.ready);
      await show(RecoveryDisplay.offlineReady);
      expect(
        find.byKey(const Key('dismiss-recovery-offline-notice')),
        findsOneWidget,
      );
    },
  );
  for (final state in RecoveryDisplay.values) {
    testWidgets('card renders $state without overflow or invented guidance', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final guides =
          state == RecoveryDisplay.ready ||
          state == RecoveryDisplay.offlineReady;
      final view = RecoveryView(
        state,
        target: guides
            ? const RecoveryTarget(
                RecoveryPoint(.001, .005),
                RecoveryPoint(0, .005),
                111.195,
                180,
              )
            : null,
      );
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: RecoveryCardContent(
                view: view,
                onRetry: () {},
                onFocus: () {},
              ),
            ),
          ),
        ),
      );
      expect(find.text('Quay lại tuyến'), findsOneWidget);
      expect(
        find.text('Xem điểm quay lại'),
        guides ? findsOneWidget : findsNothing,
      );
      if (guides) {
        expect(find.text('111 m'), findsOneWidget);
        expect(find.text('Nam · 180°'), findsOneWidget);
      }
      if (find.byKey(const Key('recovery-retry')).evaluate().isNotEmpty) {
        expect(
          tester.getSize(find.byKey(const Key('recovery-retry'))).height,
          greaterThanOrEqualTo(48),
        );
        expect(find.byType(OutlinedButton), findsOneWidget);
      }
      if (state == RecoveryDisplay.artifactInvalid) {
        expect(find.textContaining('thiếu hoặc hỏng'), findsOneWidget);
        expect(find.textContaining('không khớp'), findsNothing);
      }
      expect(tester.takeException(), isNull);
    });
  }
}
