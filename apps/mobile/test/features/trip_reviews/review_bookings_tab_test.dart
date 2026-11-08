import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/camper/presentation/camper_trip_detail_screen.dart';
import 'package:mobile/features/trip_reviews/domain/review_models.dart';
import 'package:mobile/features/trip_reviews/presentation/review_bookings_tab.dart';

void main() {
  final sampleBookings = [
    ReviewBooking(
      id: 'bk-1',
      tripId: 'trip-1',
      title: 'Trekking Tà Năng - Phan Dũng',
      hostName: 'Nguyễn Văn Hướng Dẫn',
      status: 'confirmed',
      createdAt: DateTime.now().subtract(const Duration(days: 2)),
      startsAt: DateTime.now().add(const Duration(days: 5)),
      numPeople: 2,
      totalAmount: '2500000',
    ),
    ReviewBooking(
      id: 'bk-2',
      tripId: 'trip-2',
      title: 'Khám Phá Rừng Cát Tiên',
      hostName: 'Trần Văn Porter',
      status: 'pending_payment',
      createdAt: DateTime.now().subtract(const Duration(days: 1)),
      startsAt: DateTime.now().add(const Duration(days: 10)),
      numPeople: 1,
      totalAmount: '1200000',
    ),
    ReviewBooking(
      id: 'bk-3',
      tripId: 'trip-3',
      title: 'Chinh Phục Đỉnh Fansipan',
      hostName: 'Lê Minh Hướng Dẫn',
      status: 'completed',
      createdAt: DateTime.now().subtract(const Duration(days: 20)),
      startsAt: DateTime.now().subtract(const Duration(days: 15)),
      numPeople: 4,
      totalAmount: '8000000',
    ),
  ];

  Widget buildTestWidget({
    bool upcomingTrips = false,
    bool tripHistory = false,
  }) {
    return ProviderScope(
      overrides: [
        reviewBookingsProvider.overrideWith((ref) async => sampleBookings),
        reviewSummaryProvider.overrideWith((ref) async => {
          'bk-3': (count: 0, canCreate: true),
        }),
      ],
      child: MaterialApp(
        home: Scaffold(
          body: ReviewBookingsTab(
            upcomingTrips: upcomingTrips,
            tripHistory: tripHistory,
          ),
        ),
      ),
    );
  }

  testWidgets('renders Upcoming Trips tab with filters and search', (tester) async {
    await tester.pumpWidget(buildTestWidget(upcomingTrips: true));
    await tester.pumpAndSettle();

    // Verify title and search bar
    expect(find.text('Chuyến đi của tôi'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);

    // Verify upcoming filter pills
    expect(find.text('Tất cả'), findsOneWidget);
    expect(find.text('Sắp tới'), findsOneWidget);
    expect(find.text('Đang diễn ra'), findsOneWidget);

    // Only confirmed / ongoing trips show up in upcoming
    expect(find.text('Trekking Tà Năng - Phan Dũng'), findsOneWidget);
    expect(find.text('Khám Phá Rừng Cát Tiên'), findsNothing);
  });

  testWidgets('renders Bookings tab with status filter pills', (tester) async {
    await tester.pumpWidget(buildTestWidget());
    await tester.pumpAndSettle();

    expect(find.text('Đơn đặt chỗ của bạn'), findsOneWidget);
    expect(find.text('Tất cả'), findsOneWidget);
    expect(find.text('Đã xác nhận'), findsAtLeastNWidgets(1));
    expect(find.text('Chờ thanh toán'), findsAtLeastNWidgets(1));
    expect(find.text('Đã hoàn thành'), findsAtLeastNWidgets(1));

    // All bookings show up in all bookings tab
    expect(find.text('Trekking Tà Năng - Phan Dũng'), findsOneWidget);
    expect(find.text('Khám Phá Rừng Cát Tiên'), findsOneWidget);
    expect(find.text('Chinh Phục Đỉnh Fansipan'), findsOneWidget);
  });

  testWidgets('filters items when typing in search bar', (tester) async {
    await tester.pumpWidget(buildTestWidget());
    await tester.pumpAndSettle();

    // Type 'Fansipan' into search field
    await tester.enterText(find.byType(TextField), 'Fansipan');
    await tester.pumpAndSettle();

    expect(find.text('Chinh Phục Đỉnh Fansipan'), findsOneWidget);
    expect(find.text('Trekking Tà Năng - Phan Dũng'), findsNothing);
    expect(find.text('Khám Phá Rừng Cát Tiên'), findsNothing);
  });

  testWidgets('tapping booking card opens CamperTripDetailScreen with tabs', (tester) async {
    await tester.pumpWidget(buildTestWidget(upcomingTrips: true));
    await tester.pumpAndSettle();

    // Tap on the card
    await tester.tap(find.text('Trekking Tà Năng - Phan Dũng'));
    await tester.pumpAndSettle();

    // Expect CamperTripDetailScreen to be pushed
    expect(find.byType(CamperTripDetailScreen), findsOneWidget);
    expect(find.text('Chi tiết chuyến đi'), findsOneWidget);

    // Verify 4 tabs are present
    expect(find.text('Tổng quan'), findsOneWidget);
    expect(find.text('Lộ trình'), findsOneWidget);
    expect(find.text('Đồng bộ'), findsOneWidget);
    expect(find.text('Đơn hàng'), findsOneWidget);
  });
}
