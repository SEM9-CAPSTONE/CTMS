import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/env/env.dart';
import 'package:mobile/features/camper/presentation/widgets/trip_cover_image.dart';

void main() {
  testWidgets('missing covers show a clear placeholder', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: TripCoverImage(
            tripTitle: 'Khám phá bán đảo Sơn Trà',
            imageUrl: '  ',
          ),
        ),
      ),
    );
    expect(find.text('Chưa có ảnh chuyến đi'), findsOneWidget);
    expect(find.byType(Image), findsNothing);
  });

  testWidgets(
    'relative covers use the API server and failed images stay readable',
    (tester) async {
      // Flutter's test HTTP client returns 400 so no external server is contacted.
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: TripCoverImage(
              tripTitle: 'Khám phá bán đảo Sơn Trà',
              imageUrl: ' /uploads/trips/son-tra.jpg ',
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final image = tester.widget<Image>(find.byType(Image));
      expect(
        (image.image as NetworkImage).url,
        Uri.parse(
          Env.apiBaseUrl,
        ).resolve('/uploads/trips/son-tra.jpg').toString(),
      );
      expect(image.semanticLabel, 'Ảnh chuyến đi: Khám phá bán đảo Sơn Trà');
      expect(find.text('Không tải được ảnh chuyến đi'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
