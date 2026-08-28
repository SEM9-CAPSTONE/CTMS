import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/camper/explore/domain/campsite_search_models.dart';
import 'package:mobile/features/camper/explore/presentation/widgets/campsite_result_card.dart';

const _campsite = CampsiteSearchItem(
  id: '1',
  name: 'Đà Lạt Pine Camp',
  location: CampsiteLocation(province: 'Lam Dong', latitude: 11.9, longitude: 108.4),
  coverImage: 'https://example.com/cover.jpg',
  activeRoutes: [],
);

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  group('CampsiteResultCard', () {
    testWidgets('renders name and province -- no price field anywhere (BR-048/AC3)', (tester) async {
      await tester.pumpWidget(_wrap(const CampsiteResultCard(campsite: _campsite)));

      expect(find.text('Đà Lạt Pine Camp'), findsOneWidget);
      expect(find.text('Lam Dong'), findsOneWidget);
      expect(find.textContaining('đ'), findsNothing);
      expect(find.textContaining('VND'), findsNothing);
    });

    testWidgets('renders an Image pointed at the real coverImage URL when present', (tester) async {
      await tester.pumpWidget(_wrap(const CampsiteResultCard(campsite: _campsite)));

      final image = tester.widget<Image>(find.byType(Image));
      expect((image.image as NetworkImage).url, 'https://example.com/cover.jpg');
    });

    testWidgets('falls back to a placeholder icon (no Image widget) when coverImage is null', (
      tester,
    ) async {
      const withoutCover = CampsiteSearchItem(
        id: '1',
        name: 'No Cover Camp',
        location: CampsiteLocation(province: 'A', latitude: 1, longitude: 2),
        coverImage: null,
        activeRoutes: [],
      );
      await tester.pumpWidget(_wrap(const CampsiteResultCard(campsite: withoutCover)));

      expect(find.byType(Image), findsNothing);
      expect(find.byIcon(Icons.terrain_outlined), findsOneWidget);
    });

    testWidgets('renders nothing for activeRoutes -- no fabricated "routes" section', (tester) async {
      await tester.pumpWidget(_wrap(const CampsiteResultCard(campsite: _campsite)));

      expect(find.textContaining('route'), findsNothing);
      expect(find.textContaining('tuyến'), findsNothing);
    });
  });
}
