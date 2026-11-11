import 'package:flutter/material.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../offline_packages/presentation/saved_offline_packages_screen.dart';
import '../../trip_reviews/presentation/review_bookings_tab.dart';

class CamperTripsScreen extends StatelessWidget {
  const CamperTripsScreen({super.key});

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 3,
    child: CtmsScaffold(
      title: 'Chuyến đi',
      subtitle: 'Quản lý chuyến đi và đơn đặt chỗ của bạn',
      actions: const [SavedOfflinePackagesButton()],
      bottom: const TabBar(
        isScrollable: false,
        tabAlignment: TabAlignment.fill,
        tabs: [
          Tab(
            child: Text(
              'Chuyến đi của tôi',
              textAlign: TextAlign.center,
              maxLines: 2,
            ),
          ),
          Tab(
            child: Text(
              'Đơn đặt chỗ',
              textAlign: TextAlign.center,
              maxLines: 2,
            ),
          ),
          Tab(
            child: Text(
              'Lịch sử chuyến đi',
              textAlign: TextAlign.center,
              maxLines: 2,
            ),
          ),
        ],
      ),
      body: const TabBarView(
        children: [
          ReviewBookingsTab(upcomingTrips: true),
          ReviewBookingsTab(),
          ReviewBookingsTab(tripHistory: true),
        ],
      ),
    ),
  );
}
