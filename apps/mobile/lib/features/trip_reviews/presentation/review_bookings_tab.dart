import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/widgets/ctms_button.dart';
import '../data/reviews_api.dart';
import '../domain/review_models.dart';
import 'trip_reviews_screen.dart';

final reviewBookingsProvider = FutureProvider.autoDispose<List<ReviewBooking>>((
  ref,
) {
  return ref.watch(reviewsApiProvider).bookings();
});

final reviewSummaryProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(reviewsApiProvider).summary(),
);

enum HistoryFilter { all, pending, reviewed }

class ReviewBookingsTab extends ConsumerStatefulWidget {
  const ReviewBookingsTab({
    super.key,
    this.tripHistory = false,
    this.upcomingTrips = false,
  });
  final bool tripHistory;
  final bool upcomingTrips;
  @override
  ConsumerState<ReviewBookingsTab> createState() => _ReviewBookingsTabState();
}

class _ReviewBookingsTabState extends ConsumerState<ReviewBookingsTab> {
  int page = 0;
  HistoryFilter filter = HistoryFilter.all;
  static const pageSize = 10;
  @override
  Widget build(BuildContext context) {
    final query = ref.watch(reviewBookingsProvider);
    final summaryQuery = widget.tripHistory
        ? ref.watch(reviewSummaryProvider)
        : null;
    if (summaryQuery?.isLoading == true) {
      return const Center(child: CircularProgressIndicator());
    }
    if (summaryQuery?.hasError == true) {
      return Center(
        child: TextButton(
          onPressed: () => ref.invalidate(reviewSummaryProvider),
          child: const Text('Không tải được trạng thái đánh giá. Thử lại'),
        ),
      );
    }
    final summaries =
        summaryQuery?.value ?? <String, ({int count, bool canCreate})>{};
    return query.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Không tải được đơn đặt chỗ.'),
            TextButton(
              onPressed: () => ref.invalidate(reviewBookingsProvider),
              child: const Text('Thử lại'),
            ),
          ],
        ),
      ),
      data: (bookings) {
        final unfiltered = widget.tripHistory
            ? bookings.where((item) => item.status == 'completed').toList()
            : widget.upcomingTrips
            ? bookings.where((item) => item.status == 'confirmed').toList()
            : bookings;
        bool pending(ReviewBooking item) =>
            (summaries[item.id]?.count ?? 0) < 2 &&
            summaries[item.id]?.canCreate == true;
        bool reviewed(ReviewBooking item) =>
            (summaries[item.id]?.count ?? 0) == 2;
        final items = unfiltered
            .where(
              (item) =>
                  !widget.tripHistory ||
                  switch (filter) {
                    HistoryFilter.all => true,
                    HistoryFilter.pending => pending(item),
                    HistoryFilter.reviewed => reviewed(item),
                  },
            )
            .toList();
        final pages = (items.length / pageSize).ceil().clamp(1, 1000000);
        final current = page.clamp(0, pages - 1);
        return RefreshIndicator(
          onRefresh: () async {
            setState(() => page = 0);
            ref.invalidate(reviewBookingsProvider);
            if (widget.tripHistory) ref.invalidate(reviewSummaryProvider);
            await ref.read(reviewBookingsProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                widget.tripHistory
                    ? 'Lịch sử chuyến đi'
                    : widget.upcomingTrips
                    ? 'Chuyến đi đã xác nhận'
                    : 'Đơn đặt chỗ của bạn',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 16),
              if (widget.tripHistory)
                Row(
                  children: [
                    for (final entry in [
                      (
                        HistoryFilter.all,
                        Icons.history,
                        'Tất cả',
                        unfiltered.length,
                      ),
                      (
                        HistoryFilter.pending,
                        Icons.rate_review_outlined,
                        'Cần đánh giá',
                        unfiltered.where(pending).length,
                      ),
                      (
                        HistoryFilter.reviewed,
                        Icons.task_alt,
                        'Đã đánh giá',
                        unfiltered.where(reviewed).length,
                      ),
                    ])
                      Expanded(
                        child: Semantics(
                          selected: filter == entry.$1,
                          child: InkWell(
                            onTap: () => setState(() {
                              filter = entry.$1;
                              page = 0;
                            }),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: Column(
                                children: [
                                  Badge(
                                    label: Text('${entry.$4}'),
                                    child: Icon(
                                      entry.$2,
                                      size: 28,
                                      color: filter == entry.$1
                                          ? Theme.of(
                                              context,
                                            ).colorScheme.primary
                                          : null,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    entry.$3,
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontWeight: filter == entry.$1
                                          ? FontWeight.bold
                                          : FontWeight.normal,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              if (items.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('Chưa có chuyến đi trong mục này.'),
                ),
              const SizedBox(height: 16),
              for (final item in items.skip(current * pageSize).take(pageSize))
                Card(
                  margin: const EdgeInsets.only(bottom: 16),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.title,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${widget.tripHistory ? 'Khởi hành' : 'Ngày đặt'}: ${DateFormat('dd/MM/yyyy').format((widget.tripHistory ? item.startsAt ?? item.createdAt : item.createdAt).toUtc().add(const Duration(hours: 7)))}',
                        ),
                        if (widget.tripHistory)
                          Text(
                            reviewed(item)
                                ? 'Đã đánh giá'
                                : pending(item)
                                ? ((summaries[item.id]?.count ?? 0) > 0
                                      ? 'Còn thiếu một đánh giá'
                                      : 'Chưa đánh giá')
                                : 'Không thể gửi đánh giá mới',
                          ),
                        Text(switch (item.status) {
                          'completed' => 'Đã hoàn thành',
                          'confirmed' => 'Đã xác nhận',
                          'cancelled' => 'Đã hủy',
                          'expired' => 'Đã hết hạn',
                          'pending_payment' => 'Chờ thanh toán',
                          'pending_reconfirmation' => 'Chờ xác nhận lại',
                          _ => 'Chưa có trạng thái',
                        }),
                        if (widget.tripHistory &&
                            item.status == 'completed') ...[
                          const SizedBox(height: 16),
                          CtmsButton(
                            label: reviewed(item)
                                ? 'Xem đánh giá'
                                : (summaries[item.id]?.count ?? 0) > 0
                                ? 'Tiếp tục đánh giá'
                                : pending(item)
                                ? 'Đánh giá chuyến đi'
                                : 'Xem chi tiết đánh giá',
                            icon: Icons.star_outline_rounded,
                            onPressed: () async {
                              await Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) =>
                                      TripReviewsScreen(booking: item),
                                ),
                              );
                              if (mounted) {
                                ref.invalidate(reviewSummaryProvider);
                              }
                            },
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              if (pages > 1)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      tooltip: 'Trang trước',
                      onPressed: current > 0
                          ? () => setState(() => page = current - 1)
                          : null,
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Text('Trang ${current + 1}/$pages'),
                    IconButton(
                      tooltip: 'Trang sau',
                      onPressed: current + 1 < pages
                          ? () => setState(() => page = current + 1)
                          : null,
                      icon: const Icon(Icons.chevron_right),
                    ),
                  ],
                ),
            ],
          ),
        );
      },
    );
  }
}
