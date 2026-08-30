import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/camper/explore/application/campsite_search_controller.dart'
    show fixedExploreProvince;
import 'package:mobile/features/camper/explore/presentation/widgets/campsite_search_filters.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

Widget _filters({
  String amenities = '',
  String minPrice = '',
  String maxPrice = '',
  bool isLoading = false,
  ValueChanged<String>? onAmenitiesChanged,
  ValueChanged<String>? onMinPriceChanged,
  ValueChanged<String>? onMaxPriceChanged,
  VoidCallback? onSubmit,
  VoidCallback? onReset,
}) => _wrap(
  CampsiteSearchFilters(
    amenities: amenities,
    minPrice: minPrice,
    maxPrice: maxPrice,
    isLoading: isLoading,
    onAmenitiesChanged: onAmenitiesChanged ?? (_) {},
    onMinPriceChanged: onMinPriceChanged ?? (_) {},
    onMaxPriceChanged: onMaxPriceChanged ?? (_) {},
    onSubmit: onSubmit ?? () {},
    onReset: onReset ?? () {},
  ),
);

void main() {
  group('CampsiteSearchFilters', () {
    testWidgets(
      'renders the fixed Đà Nẵng scope line and exactly the 3 remaining contract fields',
      (tester) async {
        await tester.pumpWidget(_filters());

        expect(find.text('Khu vực: $fixedExploreProvince'), findsOneWidget);
        expect(find.text('Tỉnh/Thành'), findsNothing);
        expect(find.text('Thành phố'), findsNothing);
        expect(find.text('Tiện ích'), findsOneWidget);
        expect(find.text('Giá từ'), findsOneWidget);
        expect(find.text('Giá đến'), findsOneWidget);
        expect(find.textContaining('Trạng thái'), findsNothing);
        expect(find.textContaining('Ngày'), findsNothing);
        expect(find.textContaining('Số người'), findsNothing);
        expect(find.byType(TextField), findsNWidgets(3));
      },
    );

    testWidgets('isLoading=false: Search/Reset are enabled', (tester) async {
      await tester.pumpWidget(_filters());

      final searchButton = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      final resetButton = tester.widget<OutlinedButton>(find.byType(OutlinedButton));
      expect(searchButton.onPressed, isNotNull);
      expect(resetButton.onPressed, isNotNull);
    });

    testWidgets('isLoading=true: Search/Reset are disabled, but the 3 fields remain editable', (
      tester,
    ) async {
      await tester.pumpWidget(_filters(isLoading: true));

      final resetButton = tester.widget<OutlinedButton>(find.byType(OutlinedButton));
      expect(resetButton.onPressed, isNull);

      for (final field in find.byType(TextField).evaluate()) {
        expect((field.widget as TextField).enabled, isNot(false));
      }

      await tester.enterText(find.byType(TextField).first, 'wifi');
      expect(find.text('wifi'), findsOneWidget);
    });

    testWidgets('tapping Search calls onSubmit exactly once', (tester) async {
      var callCount = 0;
      await tester.pumpWidget(_filters(onSubmit: () => callCount++));

      await tester.tap(find.text('Tìm kiếm'));
      expect(callCount, 1);
    });

    testWidgets('tapping Reset calls onReset', (tester) async {
      var called = false;
      await tester.pumpWidget(_filters(onReset: () => called = true));

      await tester.tap(find.text('Đặt lại'));
      expect(called, isTrue);
    });

    testWidgets('typing into the amenities field calls its own onChanged with the raw value', (
      tester,
    ) async {
      String? amenitiesValue;
      await tester.pumpWidget(_filters(onAmenitiesChanged: (v) => amenitiesValue = v));

      await tester.enterText(find.byType(TextField).first, 'wifi, bbq');
      expect(amenitiesValue, 'wifi, bbq');
    });

    testWidgets('an external prop change (e.g. after resetFilters) overwrites the field', (
      tester,
    ) async {
      await tester.pumpWidget(_filters(amenities: 'wifi'));
      expect(find.text('wifi'), findsOneWidget);

      await tester.pumpWidget(_filters());
      expect(find.text('wifi'), findsNothing);
    });
  });
}
