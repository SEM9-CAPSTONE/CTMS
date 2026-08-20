import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/camper/explore/domain/campsite_search_models.dart';
import 'package:mobile/features/camper/explore/presentation/widgets/campsite_pagination_bar.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  group('CampsitePaginationBar', () {
    testWidgets('shows the total count', (tester) async {
      await tester.pumpWidget(
        _wrap(
          CampsitePaginationBar(
            pagination: const CampsiteSearchPagination(page: 1, limit: 20, total: 37, totalPages: 2),
            disabled: false,
            onPageChanged: (_) {},
          ),
        ),
      );

      expect(find.textContaining('37'), findsOneWidget);
    });

    testWidgets('disables both buttons when disabled=true even mid-range (BR-241)', (tester) async {
      await tester.pumpWidget(
        _wrap(
          CampsitePaginationBar(
            pagination: const CampsiteSearchPagination(page: 2, limit: 20, total: 100, totalPages: 5),
            disabled: true,
            onPageChanged: (_) {},
          ),
        ),
      );

      final buttons = tester.widgetList<IconButton>(find.byType(IconButton));
      expect(buttons.every((b) => b.onPressed == null), isTrue);
    });

    testWidgets('enables both buttons mid-range when disabled=false', (tester) async {
      await tester.pumpWidget(
        _wrap(
          CampsitePaginationBar(
            pagination: const CampsiteSearchPagination(page: 2, limit: 20, total: 100, totalPages: 5),
            disabled: false,
            onPageChanged: (_) {},
          ),
        ),
      );

      final buttons = tester.widgetList<IconButton>(find.byType(IconButton));
      expect(buttons.every((b) => b.onPressed != null), isTrue);
    });

    testWidgets('disables prev on page 1 and next on the last page regardless of disabled', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          CampsitePaginationBar(
            pagination: const CampsiteSearchPagination(page: 1, limit: 20, total: 5, totalPages: 1),
            disabled: false,
            onPageChanged: (_) {},
          ),
        ),
      );

      final buttons = tester.widgetList<IconButton>(find.byType(IconButton)).toList();
      expect(buttons[0].onPressed, isNull); // prev
      expect(buttons[1].onPressed, isNull); // next
    });

    testWidgets('tapping next/prev calls onPageChanged with page+1/page-1', (tester) async {
      int? changedTo;
      await tester.pumpWidget(
        _wrap(
          CampsitePaginationBar(
            pagination: const CampsiteSearchPagination(page: 2, limit: 20, total: 100, totalPages: 5),
            disabled: false,
            onPageChanged: (page) => changedTo = page,
          ),
        ),
      );

      await tester.tap(find.byTooltip('Trang sau'));
      expect(changedTo, 3);

      await tester.tap(find.byTooltip('Trang trước'));
      expect(changedTo, 1);
    });

    testWidgets('shows page X / totalPages, floored at 1 when there are zero results', (tester) async {
      await tester.pumpWidget(
        _wrap(
          CampsitePaginationBar(
            pagination: const CampsiteSearchPagination(page: 1, limit: 20, total: 0, totalPages: 0),
            disabled: false,
            onPageChanged: (_) {},
          ),
        ),
      );

      expect(find.text('Trang 1 / 1'), findsOneWidget);
    });
  });
}
