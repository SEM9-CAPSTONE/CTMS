import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../../camper/presentation/camper_trip_detail_screen.dart';
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
enum UpcomingFilter { all, upcoming, ongoing }
enum BookingFilter { all, confirmed, pendingPayment, completed, cancelled }

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
  HistoryFilter historyFilter = HistoryFilter.all;
  UpcomingFilter upcomingFilter = UpcomingFilter.all;
  BookingFilter bookingFilter = BookingFilter.all;
  String searchQuery = '';
  final TextEditingController searchController = TextEditingController();
  static const pageSize = 10;

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  Widget _buildFilterPill({
    required String label,
    required int count,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF164027) : const Color(0xFFF0F4F1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected ? const Color(0xFF164027) : const Color(0xFFDFE8DF),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected ? Colors.white : const Color(0xFF10221B),
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isSelected
                      ? Colors.white.withValues(alpha: 0.25)
                      : const Color(0xFFDFE8DF),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isSelected ? Colors.white : const Color(0xFF667A6D),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  (String, CtmsStatus) _statusBadge(String? status) => switch (status) {
    'completed' => ('Đã hoàn thành', CtmsStatus.success),
    'confirmed' => ('Đã xác nhận', CtmsStatus.success),
    'ongoing' => ('Đang diễn ra', CtmsStatus.info),
    'cancelled' => ('Đã hủy', CtmsStatus.neutral),
    'expired' => ('Đã hết hạn', CtmsStatus.neutral),
    'pending_payment' => ('Chờ thanh toán', CtmsStatus.warning),
    'pending_reconfirmation' => ('Chờ xác nhận', CtmsStatus.warning),
    _ => ('Đã ghi nhận', CtmsStatus.neutral),
  };

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
            const Text('Không tải được danh sách chuyến đi.'),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => ref.invalidate(reviewBookingsProvider),
              child: const Text('Thử lại'),
            ),
          ],
        ),
      ),
      data: (bookings) {
        final now = DateTime.now();

        // 1. Base list according to tab mode
        final unfiltered = widget.tripHistory
            ? bookings.where((item) => item.status == 'completed').toList()
            : widget.upcomingTrips
            ? bookings
                .where((item) => item.status == 'confirmed' || item.status == 'ongoing')
                .toList()
            : bookings;

        // Review helpers for history tab
        bool pendingReview(ReviewBooking item) =>
            (summaries[item.id]?.count ?? 0) < 2 &&
            summaries[item.id]?.canCreate == true;
        bool reviewedBoth(ReviewBooking item) =>
            (summaries[item.id]?.count ?? 0) == 2;

        // Upcoming helpers
        bool isOngoing(ReviewBooking item) {
          if (item.status == 'ongoing') return true;
          if (item.startsAt != null && item.startsAt!.isBefore(now)) {
            if (item.endsAt == null || item.endsAt!.isAfter(now)) return true;
          }
          return false;
        }

        bool isUpcomingOnly(ReviewBooking item) {
          if (item.startsAt == null) return true;
          return item.startsAt!.isAfter(now);
        }

        // 2. Category Filter
        List<ReviewBooking> filteredCategory;
        if (widget.tripHistory) {
          filteredCategory = unfiltered.where((item) => switch (historyFilter) {
            HistoryFilter.all => true,
            HistoryFilter.pending => pendingReview(item),
            HistoryFilter.reviewed => reviewedBoth(item),
          }).toList();
        } else if (widget.upcomingTrips) {
          filteredCategory = unfiltered.where((item) => switch (upcomingFilter) {
            UpcomingFilter.all => true,
            UpcomingFilter.upcoming => isUpcomingOnly(item),
            UpcomingFilter.ongoing => isOngoing(item),
          }).toList();
        } else {
          filteredCategory = unfiltered.where((item) => switch (bookingFilter) {
            BookingFilter.all => true,
            BookingFilter.confirmed => item.status == 'confirmed',
            BookingFilter.pendingPayment =>
              item.status == 'pending_payment' || item.status == 'pending_reconfirmation',
            BookingFilter.completed => item.status == 'completed',
            BookingFilter.cancelled =>
              item.status == 'cancelled' || item.status == 'expired',
          }).toList();
        }

        // 3. Search query filter
        final queryLower = searchQuery.toLowerCase().trim();
        final items = queryLower.isEmpty
            ? filteredCategory
            : filteredCategory.where((item) {
                final title = item.title.toLowerCase();
                final host = (item.hostName ?? '').toLowerCase();
                final id = item.id.toLowerCase();
                return title.contains(queryLower) ||
                    host.contains(queryLower) ||
                    id.contains(queryLower);
              }).toList();

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
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              Text(
                widget.tripHistory
                    ? 'Lịch sử chuyến đi'
                    : widget.upcomingTrips
                    ? 'Chuyến đi của tôi'
                    : 'Đơn đặt chỗ của bạn',
                style: AppTypography.h2.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.md),

              // Search Bar
              Container(
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: AppRadius.controlBorderRadius,
                  border: Border.all(color: AppColors.border),
                  boxShadow: AppColors.cardShadowSm,
                ),
                child: TextField(
                  controller: searchController,
                  decoration: InputDecoration(
                    hintText: 'Tìm kiếm theo tên tour, người dẫn đoàn...',
                    hintStyle: AppTypography.body.copyWith(color: AppColors.textSecondary),
                    prefixIcon: const Icon(Icons.search, size: 20, color: AppColors.textSecondary),
                    suffixIcon: searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              searchController.clear();
                              setState(() {
                                searchQuery = '';
                                page = 0;
                              });
                            },
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                  onChanged: (val) {
                    setState(() {
                      searchQuery = val;
                      page = 0;
                    });
                  },
                ),
              ),

              // Filter Pills
              if (widget.tripHistory)
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterPill(
                        label: 'Tất cả',
                        count: unfiltered.length,
                        isSelected: historyFilter == HistoryFilter.all,
                        onTap: () => setState(() {
                          historyFilter = HistoryFilter.all;
                          page = 0;
                        }),
                      ),
                      _buildFilterPill(
                        label: 'Cần đánh giá',
                        count: unfiltered.where(pendingReview).length,
                        isSelected: historyFilter == HistoryFilter.pending,
                        onTap: () => setState(() {
                          historyFilter = HistoryFilter.pending;
                          page = 0;
                        }),
                      ),
                      _buildFilterPill(
                        label: 'Đã đánh giá',
                        count: unfiltered.where(reviewedBoth).length,
                        isSelected: historyFilter == HistoryFilter.reviewed,
                        onTap: () => setState(() {
                          historyFilter = HistoryFilter.reviewed;
                          page = 0;
                        }),
                      ),
                    ],
                  ),
                )
              else if (widget.upcomingTrips)
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterPill(
                        label: 'Tất cả',
                        count: unfiltered.length,
                        isSelected: upcomingFilter == UpcomingFilter.all,
                        onTap: () => setState(() {
                          upcomingFilter = UpcomingFilter.all;
                          page = 0;
                        }),
                      ),
                      _buildFilterPill(
                        label: 'Sắp tới',
                        count: unfiltered.where(isUpcomingOnly).length,
                        isSelected: upcomingFilter == UpcomingFilter.upcoming,
                        onTap: () => setState(() {
                          upcomingFilter = UpcomingFilter.upcoming;
                          page = 0;
                        }),
                      ),
                      _buildFilterPill(
                        label: 'Đang diễn ra',
                        count: unfiltered.where(isOngoing).length,
                        isSelected: upcomingFilter == UpcomingFilter.ongoing,
                        onTap: () => setState(() {
                          upcomingFilter = UpcomingFilter.ongoing;
                          page = 0;
                        }),
                      ),
                    ],
                  ),
                )
              else
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterPill(
                        label: 'Tất cả',
                        count: unfiltered.length,
                        isSelected: bookingFilter == BookingFilter.all,
                        onTap: () => setState(() {
                          bookingFilter = BookingFilter.all;
                          page = 0;
                        }),
                      ),
                      _buildFilterPill(
                        label: 'Đã xác nhận',
                        count: unfiltered.where((item) => item.status == 'confirmed').length,
                        isSelected: bookingFilter == BookingFilter.confirmed,
                        onTap: () => setState(() {
                          bookingFilter = BookingFilter.confirmed;
                          page = 0;
                        }),
                      ),
                      _buildFilterPill(
                        label: 'Chờ thanh toán',
                        count: unfiltered
                            .where(
                              (item) =>
                                  item.status == 'pending_payment' ||
                                  item.status == 'pending_reconfirmation',
                            )
                            .length,
                        isSelected: bookingFilter == BookingFilter.pendingPayment,
                        onTap: () => setState(() {
                          bookingFilter = BookingFilter.pendingPayment;
                          page = 0;
                        }),
                      ),
                      _buildFilterPill(
                        label: 'Đã hoàn thành',
                        count: unfiltered.where((item) => item.status == 'completed').length,
                        isSelected: bookingFilter == BookingFilter.completed,
                        onTap: () => setState(() {
                          bookingFilter = BookingFilter.completed;
                          page = 0;
                        }),
                      ),
                      _buildFilterPill(
                        label: 'Đã hủy',
                        count: unfiltered
                            .where((item) => item.status == 'cancelled' || item.status == 'expired')
                            .length,
                        isSelected: bookingFilter == BookingFilter.cancelled,
                        onTap: () => setState(() {
                          bookingFilter = BookingFilter.cancelled;
                          page = 0;
                        }),
                      ),
                    ],
                  ),
                ),

              const SizedBox(height: AppSpacing.lg),

              if (items.isEmpty)
                Container(
                  padding: const EdgeInsets.all(AppSpacing.xxl),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: AppRadius.cardBorderRadius,
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Center(
                    child: Column(
                      children: [
                        const Icon(Icons.inbox_outlined, size: 40, color: AppColors.textSecondary),
                        const SizedBox(height: 8),
                        Text(
                          searchQuery.isNotEmpty
                              ? 'Không tìm thấy chuyến đi phù hợp với từ khóa.'
                              : 'Chưa có chuyến đi trong mục này.',
                          style: AppTypography.body.copyWith(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ),

              // Item Cards
              for (final item in items.skip(current * pageSize).take(pageSize))
                Card(
                  margin: const EdgeInsets.only(bottom: AppSpacing.md),
                  clipBehavior: Clip.antiAlias,
                  shape: RoundedRectangleBorder(
                    borderRadius: AppRadius.cardBorderRadius,
                    side: const BorderSide(color: AppColors.border),
                  ),
                  elevation: 0,
                  color: Colors.white,
                  child: InkWell(
                    onTap: () {
                      final tripId = item.tripId;
                      if (tripId == null || tripId.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Không tìm thấy mã chuyến đi.')),
                        );
                        return;
                      }
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => CamperTripDetailScreen(
                            booking: item,
                            tripId: tripId,
                          ),
                        ),
                      );
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.cardPadding),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  item.title,
                                  style: AppTypography.h3.copyWith(
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              CtmsStatusBadge(
                                label: _statusBadge(item.status).$1,
                                status: _statusBadge(item.status).$2,
                                showDot: true,
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(
                                Icons.calendar_today_outlined,
                                size: 14,
                                color: AppColors.textSecondary,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '${widget.tripHistory ? 'Khởi hành' : 'Ngày đặt'}: ${DateFormat('dd/MM/yyyy').format((widget.tripHistory ? item.startsAt ?? item.createdAt : item.createdAt).toLocal())}',
                                style: AppTypography.caption.copyWith(
                                  color: AppColors.textSecondary,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              if (item.hostName != null) ...[
                                const SizedBox(width: AppSpacing.md),
                                const Icon(
                                  Icons.person_pin_outlined,
                                  size: 14,
                                  color: AppColors.textSecondary,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    item.hostName!,
                                    style: AppTypography.caption.copyWith(
                                      color: AppColors.textSecondary,
                                      fontWeight: FontWeight.w500,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ],
                          ),
                          if (item.numPeople != null || item.totalAmount != null) ...[
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                if (item.numPeople != null) ...[
                                  const Icon(
                                    Icons.group_outlined,
                                    size: 14,
                                    color: AppColors.textSecondary,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${item.numPeople} người',
                                    style: AppTypography.caption.copyWith(
                                      color: AppColors.textSecondary,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                                if (item.totalAmount != null) ...[
                                  const SizedBox(width: AppSpacing.md),
                                  const Icon(
                                    Icons.payments_outlined,
                                    size: 14,
                                    color: AppColors.textSecondary,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${NumberFormat('#,###', 'vi_VN').format(double.tryParse(item.totalAmount!) ?? 0)} đ',
                                    style: AppTypography.caption.copyWith(
                                      color: AppColors.brandPrimary,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                          if (widget.tripHistory) ...[
                            const SizedBox(height: 6),
                            Text(
                              reviewedBoth(item)
                                  ? 'Đã gửi đánh giá'
                                  : pendingReview(item)
                                  ? ((summaries[item.id]?.count ?? 0) > 0
                                        ? 'Còn thiếu một đánh giá'
                                        : 'Chưa đánh giá')
                                  : 'Không thể gửi đánh giá mới',
                              style: AppTypography.caption.copyWith(
                                color: reviewedBoth(item)
                                    ? AppColors.statusSuccess
                                    : pendingReview(item)
                                    ? AppColors.statusWarning
                                    : AppColors.textSecondary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                          const SizedBox(height: AppSpacing.md),
                          const Divider(height: 1, thickness: 1, color: AppColors.border),
                          const SizedBox(height: AppSpacing.sm),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Bấm để xem chi tiết chuyến đi',
                                style: AppTypography.caption.copyWith(
                                  color: AppColors.brandPrimary,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const Icon(
                                Icons.arrow_forward_ios_rounded,
                                size: 14,
                                color: AppColors.brandPrimary,
                              ),
                            ],
                          ),
                          if (widget.tripHistory && item.status == 'completed') ...[
                            const SizedBox(height: AppSpacing.sm),
                            CtmsButton(
                              label: reviewedBoth(item)
                                  ? 'Xem đánh giá'
                                  : (summaries[item.id]?.count ?? 0) > 0
                                  ? 'Tiếp tục đánh giá'
                                  : pendingReview(item)
                                  ? 'Đánh giá chuyến đi'
                                  : 'Xem chi tiết đánh giá',
                              icon: Icons.star_outline_rounded,
                              onPressed: () async {
                                await Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                    builder: (_) => TripReviewsScreen(booking: item),
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
                ),

              if (pages > 1)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      tooltip: 'Trang trước',
                      onPressed: current > 0 ? () => setState(() => page = current - 1) : null,
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Text(
                      'Trang ${current + 1}/$pages',
                      style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600),
                    ),
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
