import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/camper/data/trip_images_api.dart';
import 'package:mobile/features/camper/presentation/widgets/trip_image_gallery.dart';

const _tripId = 'a1736fee-62be-4991-9478-a62288e9b80a';
const _title = 'Khám phá bán đảo Sơn Trà';
const _cover = 'https://ctms.local/trips/son-tra.jpg';
const _second = 'https://ctms.local/trips/son-tra-coast.jpg';

IconButton _navigationButton(WidgetTester tester, String label) =>
    tester.widget<IconButton>(
      find.byWidgetPredicate(
        (widget) => widget is IconButton && widget.tooltip == label,
      ),
    );

Future<void> _pumpGallery(
  WidgetTester tester,
  Future<List<String>> Function() load, {
  bool loadImages = false,
}) => tester.pumpWidget(
  ProviderScope(
    overrides: [tripImagesProvider(_tripId).overrideWith((ref) => load())],
    child: MaterialApp(
      home: Scaffold(
        body: SizedBox(
          width: 360,
          child: TripImageGallery(
            tripId: _tripId,
            tripTitle: _title,
            coverImageUrl: _cover,
            loadImages: loadImages,
          ),
        ),
      ),
    ),
  ),
);

void main() {
  test('different seed image sizes do not duplicate a gallery photo', () {
    expect(
      tripGalleryUrls('https://images.unsplash.com/photo-coast?w=1200&q=80', [
        'https://images.unsplash.com/photo-coast?w=1600&q=80',
        'https://images.unsplash.com/photo-forest?w=1600&q=80',
      ]),
      hasLength(2),
    );
  });

  testWidgets(
    'cover opens the full gallery on demand with next, previous and close',
    (tester) async {
      var loads = 0;
      await _pumpGallery(tester, () async {
        loads++;
        return [_cover, ' ', _second, _cover];
      });
      await tester.pumpAndSettle();
      expect(loads, 0);

      await tester.tap(find.text('Xem ảnh'));
      await tester.pumpAndSettle();
      expect(loads, 1);
      expect(find.text('1 / 2'), findsOneWidget);
      expect(_navigationButton(tester, 'Ảnh trước').onPressed, isNull);
      await tester.tap(find.byTooltip('Ảnh tiếp theo'));
      await tester.pumpAndSettle();
      expect(find.text('2 / 2'), findsOneWidget);
      expect(_navigationButton(tester, 'Ảnh tiếp theo').onPressed, isNull);
      await tester.tap(find.byTooltip('Ảnh trước'));
      await tester.pumpAndSettle();
      expect(find.text('1 / 2'), findsOneWidget);
      await tester.tap(find.byTooltip('Đóng ảnh'));
      await tester.pumpAndSettle();
      expect(find.text('Xem ảnh'), findsOneWidget);
    },
  );

  testWidgets('selecting a thumbnail opens that image', (tester) async {
    await _pumpGallery(tester, () async => [_cover, _second], loadImages: true);
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Xem ảnh 2 của $_title'));
    await tester.pumpAndSettle();
    expect(find.text('2 / 2'), findsOneWidget);
  });

  testWidgets(
    'a failed gallery keeps the cover and can retry without exposing API errors',
    (tester) async {
      var loads = 0;
      await _pumpGallery(tester, () async {
        if (loads++ == 0) throw StateError('Internal server error');
        return [_cover, _second];
      });
      await tester.tap(find.text('Xem ảnh'));
      await tester.pumpAndSettle();
      expect(
        find.text('Không tải được danh sách ảnh chuyến đi.'),
        findsOneWidget,
      );
      expect(find.textContaining('Internal server error'), findsNothing);
      expect(find.text('1 / 1'), findsOneWidget);
      await tester.tap(find.text('Thử lại'));
      await tester.pumpAndSettle();
      expect(find.text('1 / 2'), findsOneWidget);
      expect(
        find.text('Không tải được danh sách ảnh chuyến đi.'),
        findsNothing,
      );
    },
  );

  testWidgets('a cover-only trip disables image navigation', (tester) async {
    await _pumpGallery(tester, () async => []);
    await tester.tap(find.text('Xem ảnh'));
    await tester.pumpAndSettle();
    expect(find.text('1 / 1'), findsOneWidget);
    expect(_navigationButton(tester, 'Ảnh trước').onPressed, isNull);
    expect(_navigationButton(tester, 'Ảnh tiếp theo').onPressed, isNull);
  });
}
