import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';
import 'package:mobile/features/offline_packages/data/camper_package_preparation_api.dart';
import 'package:mobile/features/offline_packages/presentation/camper_package_preparation.dart';

void main() {
  const confirmLabel = 'Tiếp tục khi chưa tải';

  testWidgets('explains unavailable features after losing connectivity', (
    tester,
  ) async {
    const tripId = 'trip';
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          packageDownloadControllerProvider(tripId).overrideWith(
            (_) => PackageDownloadController(
              tripId,
              () async => throw StateError('Download was not requested'),
            ),
          ),
          camperPreparationProvider(tripId).overrideWith(
            (_) async =>
                throw ApiException('offline', kind: ApiExceptionKind.network),
          ),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: CamperPackagePreparationPanel(
              tripId: tripId,
              onDownload: null,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('chưa dùng được bản đồ tuyến'), findsOneWidget);
    expect(find.byType(CamperOfflineLimitationsDialog), findsNothing);
  });

  Future<void> openDialog(
    WidgetTester tester,
    Future<void> Function() confirm,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showDialog<bool>(
                context: context,
                builder: (_) => CamperOfflineLimitationsDialog(
                  onConfirm: confirm,
                  beforeDeparture: true,
                ),
              ),
              child: const Text('Mở xác nhận'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Mở xác nhận'));
    await tester.pumpAndSettle();
  }

  testWidgets(
    'postponement leaves acknowledgement for an explicit next action',
    (tester) async {
      const tripId = 'trip';
      final controller = PackageDownloadController(
        tripId,
        () async => throw StateError('Download was not requested'),
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            packageDownloadControllerProvider(
              tripId,
            ).overrideWith((_) => controller),
            camperPreparationProvider(tripId).overrideWith(
              (_) async => const CamperPackagePreparation(
                status: 'published',
                packageId: 'required',
                policyVersion: 'offline-limitations-v1',
                acknowledged: false,
              ),
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: CamperPackagePreparationPanel(
                tripId: tripId,
                onDownload: () {},
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Một chút chuẩn bị cho chuyến đi 🌿'), findsOneWidget);
      await tester.tap(find.text('Để sau nhé'));
      await tester.pumpAndSettle();
      expect(find.text(confirmLabel), findsOneWidget);
      expect(find.byType(CamperOfflineLimitationsDialog), findsNothing);
      expect(find.byType(CheckboxListTile), findsNothing);
    },
  );

  testWidgets('requires an explicit checkbox before saving confirmation', (
    tester,
  ) async {
    var calls = 0;
    await openDialog(tester, () async => calls++);
    final button = find.widgetWithText(FilledButton, confirmLabel);
    expect(tester.widget<FilledButton>(button).onPressed, isNull);
    await tester.tap(find.byType(CheckboxListTile));
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(button).onPressed, isNotNull);
    await tester.tap(button);
    await tester.pumpAndSettle();
    expect(calls, 1);
    expect(find.byType(CamperOfflineLimitationsDialog), findsNothing);
  });

  testWidgets('dismissal never records a confirmation', (tester) async {
    var calls = 0;
    await openDialog(tester, () async => calls++);
    await tester.tap(find.byType(CheckboxListTile));
    await tester.pumpAndSettle();
    await tester.tapAt(const Offset(8, 8));
    await tester.pumpAndSettle();
    expect(calls, 0);
    expect(find.byType(CamperOfflineLimitationsDialog), findsNothing);
  });

  testWidgets('keeps confirmation open if the backend cannot save it', (
    tester,
  ) async {
    await openDialog(tester, () async => throw StateError('offline'));
    await tester.tap(find.byType(CheckboxListTile));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, confirmLabel));
    await tester.pumpAndSettle();
    expect(find.byType(CamperOfflineLimitationsDialog), findsOneWidget);
    expect(
      find.text('Chưa lưu được xác nhận. Bạn có thể đóng hoặc thử lại.'),
      findsOneWidget,
    );
  });
}
