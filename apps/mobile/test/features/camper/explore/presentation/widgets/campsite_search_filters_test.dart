import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/camper/explore/presentation/widgets/campsite_search_filters.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  group('CampsiteSearchFilters', () {
    testWidgets('renders exactly the 5 contract fields -- no status/date/guests/type', (tester) async {
      await tester.pumpWidget(
        _wrap(
          CampsiteSearchFilters(
            province: '',
            city: '',
            amenities: '',
            minPrice: '',
            maxPrice: '',
            isLoading: false,
            onProvinceChanged: (_) {},
            onCityChanged: (_) {},
            onAmenitiesChanged: (_) {},
            onMinPriceChanged: (_) {},
            onMaxPriceChanged: (_) {},
            onSubmit: () {},
            onReset: () {},
          ),
        ),
      );

      expect(find.text('Tỉnh/Thành'), findsOneWidget);
      expect(find.text('Thành phố'), findsOneWidget);
      expect(find.text('Tiện ích'), findsOneWidget);
      expect(find.text('Giá từ'), findsOneWidget);
      expect(find.text('Giá đến'), findsOneWidget);
      expect(find.textContaining('Trạng thái'), findsNothing);
      expect(find.textContaining('Ngày'), findsNothing);
      expect(find.textContaining('Số người'), findsNothing);
      expect(find.byType(TextField), findsNWidgets(5));
    });

    testWidgets('isLoading=false: Search/Reset are enabled', (tester) async {
      await tester.pumpWidget(
        _wrap(
          CampsiteSearchFilters(
            province: '',
            city: '',
            amenities: '',
            minPrice: '',
            maxPrice: '',
            isLoading: false,
            onProvinceChanged: (_) {},
            onCityChanged: (_) {},
            onAmenitiesChanged: (_) {},
            onMinPriceChanged: (_) {},
            onMaxPriceChanged: (_) {},
            onSubmit: () {},
            onReset: () {},
          ),
        ),
      );

      final searchButton = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      final resetButton = tester.widget<OutlinedButton>(find.byType(OutlinedButton));
      expect(searchButton.onPressed, isNotNull);
      expect(resetButton.onPressed, isNotNull);
    });

    testWidgets(
      'isLoading=true: Search/Reset are disabled, but all 5 fields remain editable',
      (tester) async {
        await tester.pumpWidget(
          _wrap(
            CampsiteSearchFilters(
              province: '',
              city: '',
              amenities: '',
              minPrice: '',
              maxPrice: '',
              isLoading: true,
              onProvinceChanged: (_) {},
              onCityChanged: (_) {},
              onAmenitiesChanged: (_) {},
              onMinPriceChanged: (_) {},
              onMaxPriceChanged: (_) {},
              onSubmit: () {},
              onReset: () {},
            ),
          ),
        );

        final resetButton = tester.widget<OutlinedButton>(find.byType(OutlinedButton));
        expect(resetButton.onPressed, isNull);

        for (final field in find.byType(TextField).evaluate()) {
          expect((field.widget as TextField).enabled, isNot(false));
        }

        await tester.enterText(find.byType(TextField).first, 'Lam Dong');
        expect(find.text('Lam Dong'), findsOneWidget);
      },
    );

    testWidgets('tapping Search calls onSubmit exactly once', (tester) async {
      var callCount = 0;
      await tester.pumpWidget(
        _wrap(
          CampsiteSearchFilters(
            province: '',
            city: '',
            amenities: '',
            minPrice: '',
            maxPrice: '',
            isLoading: false,
            onProvinceChanged: (_) {},
            onCityChanged: (_) {},
            onAmenitiesChanged: (_) {},
            onMinPriceChanged: (_) {},
            onMaxPriceChanged: (_) {},
            onSubmit: () => callCount++,
            onReset: () {},
          ),
        ),
      );

      await tester.tap(find.text('Tìm kiếm'));
      expect(callCount, 1);
    });

    testWidgets('tapping Reset calls onReset', (tester) async {
      var called = false;
      await tester.pumpWidget(
        _wrap(
          CampsiteSearchFilters(
            province: '',
            city: '',
            amenities: '',
            minPrice: '',
            maxPrice: '',
            isLoading: false,
            onProvinceChanged: (_) {},
            onCityChanged: (_) {},
            onAmenitiesChanged: (_) {},
            onMinPriceChanged: (_) {},
            onMaxPriceChanged: (_) {},
            onSubmit: () {},
            onReset: () => called = true,
          ),
        ),
      );

      await tester.tap(find.text('Đặt lại'));
      expect(called, isTrue);
    });

    testWidgets('typing into a field calls its own onChanged with the raw value', (tester) async {
      String? provinceValue;
      await tester.pumpWidget(
        _wrap(
          CampsiteSearchFilters(
            province: '',
            city: '',
            amenities: '',
            minPrice: '',
            maxPrice: '',
            isLoading: false,
            onProvinceChanged: (v) => provinceValue = v,
            onCityChanged: (_) {},
            onAmenitiesChanged: (_) {},
            onMinPriceChanged: (_) {},
            onMaxPriceChanged: (_) {},
            onSubmit: () {},
            onReset: () {},
          ),
        ),
      );

      await tester.enterText(find.byType(TextField).first, 'Lam Dong');
      expect(provinceValue, 'Lam Dong');
    });

    testWidgets('an external prop change (e.g. after resetFilters) overwrites the field', (tester) async {
      Widget build(String province) => _wrap(
        CampsiteSearchFilters(
          province: province,
          city: '',
          amenities: '',
          minPrice: '',
          maxPrice: '',
          isLoading: false,
          onProvinceChanged: (_) {},
          onCityChanged: (_) {},
          onAmenitiesChanged: (_) {},
          onMinPriceChanged: (_) {},
          onMaxPriceChanged: (_) {},
          onSubmit: () {},
          onReset: () {},
        ),
      );

      await tester.pumpWidget(build('Lam Dong'));
      expect(find.text('Lam Dong'), findsOneWidget);

      await tester.pumpWidget(build(''));
      expect(find.text('Lam Dong'), findsNothing);
    });
  });
}
