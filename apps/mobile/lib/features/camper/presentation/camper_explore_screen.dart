import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../../offline_packages/application/package_download_controller.dart';
import '../../offline_packages/presentation/offline_package_screen.dart';
import '../data/camper_explore_api.dart';
import '../domain/published_trip.dart';

enum _TripFilter {
  all('Tất cả'),
  dayTrip('Trong ngày', tripType: 'day_trip'),
  overnight('Qua đêm', tripType: 'overnight'),
  easy('Dễ & Thư giãn', difficulty: 'easy'),
  hard('Thử thách', difficulty: 'hard');

  const _TripFilter(this.label, {this.tripType, this.difficulty});

  final String label;
  final String? tripType;
  final String? difficulty;
}

class CamperExploreScreen extends ConsumerStatefulWidget {
  const CamperExploreScreen({super.key});

  @override
  ConsumerState<CamperExploreScreen> createState() =>
      _CamperExploreScreenState();
}

class _CamperExploreScreenState extends ConsumerState<CamperExploreScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _searchDebounce;
  _TripFilter _filter = _TripFilter.all;
  String _search = '';
  int _page = 1;

  ExploreTripsQuery get _query => (
    search: _search,
    tripType: _filter.tripType,
    difficulty: _filter.difficulty,
    page: _page,
  );

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _applySearch(String input) {
    _searchDebounce?.cancel();
    final search = input.trim();
    if (_search == search) return;

    setState(() {
      _search = search;
      _page = 1;
    });
  }

  void _changePage(int page) {
    setState(() => _page = page);
    _scrollController.jumpTo(0);
  }

  Future<void> _refresh() async {
    final request = ref.refresh(exploreTripsProvider(_query).future);
    try {
      await request;
    } catch (_) {
      // The provider renders the request error and the retry action.
    }
  }

  @override
  Widget build(BuildContext context) {
    final trips = ref.watch(exploreTripsProvider(_query));
    final result = trips.valueOrNull;

    return CtmsScaffold(
      title: 'Khám phá',
      subtitle: 'Tìm tuyến trekking cho chuyến đi tiếp theo',
      actions: [
        IconButton(
          onPressed: trips.isLoading ? null : _refresh,
          icon: const Icon(Icons.refresh_rounded),
          tooltip: 'Làm mới chuyến đi',
        ),
      ],
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          controller: _scrollController,
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.xxl),
          children: [
            TextField(
              controller: _searchController,
              maxLength: 100,
              textInputAction: TextInputAction.search,
              onChanged: (value) {
                _searchDebounce?.cancel();
                _searchDebounce = Timer(
                  const Duration(milliseconds: 300),
                  () => _applySearch(value),
                );
              },
              onSubmitted: _applySearch,
              decoration: const InputDecoration(
                hintText: 'Tìm theo tên hoặc mô tả chuyến đi',
                prefixIcon: Icon(Icons.search_rounded),
                counterText: '',
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final filter in _TripFilter.values)
                    Padding(
                      padding: const EdgeInsets.only(right: AppSpacing.sm),
                      child: ChoiceChip(
                        label: Text(filter.label),
                        selected: filter == _filter,
                        showCheckmark: false,
                        onSelected: (_) => setState(() {
                          _filter = filter;
                          _page = 1;
                        }),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              result == null ? 'Chuyến đi' : 'Chuyến đi (${result.total})',
              style: AppTypography.h3.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: AppSpacing.md),
            ...trips.when(
              loading: () => const [Center(child: CircularProgressIndicator())],
              error: (_, _) => [
                CtmsEmptyState(
                  icon: Icons.cloud_off_outlined,
                  title: 'Không tải được chuyến đi',
                  action: CtmsButton(label: 'Thử lại', onPressed: _refresh),
                ),
              ],
              data: (result) => [
                if (result.items.isEmpty)
                  const CtmsEmptyState(
                    icon: Icons.search_off_rounded,
                    title: 'Không tìm thấy chuyến đi nào',
                  ),
                for (final trip in result.items)
                  _ExploreTripCard(key: ValueKey(trip.id), trip: trip),
                if (_page > 1 || _page < result.totalPages)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      TextButton(
                        onPressed: _page > 1
                            ? () => _changePage(_page - 1)
                            : null,
                        child: const Text('Trang trước'),
                      ),
                      Text('Trang $_page'),
                      TextButton(
                        onPressed: _page < result.totalPages
                            ? () => _changePage(_page + 1)
                            : null,
                        child: const Text('Trang sau'),
                      ),
                    ],
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

final _dateFormat = DateFormat('dd/MM/yyyy');
final _dateTimeFormat = DateFormat('dd/MM/yyyy HH:mm');
final _priceFormat = NumberFormat.decimalPattern('vi_VN');

String _dateLabel(DateTime date) => _dateFormat.format(date.toLocal());

String _priceLabel(PublishedTrip trip) =>
    '${_priceFormat.format(trip.pricePerPerson)} đ/người';

String _durationLabel(PublishedTrip trip) =>
    trip.durationNights == 0 ? 'Trong ngày' : '${trip.durationNights} đêm';

String _availabilityLabel(PublishedTrip trip) {
  if (trip.remainingSeats == 0) return 'Hết chỗ';
  if (!trip.isBookable) return 'Đã đóng đăng ký';
  final seats = trip.remainingSeats;
  return seats == null ? 'Đang nhận đăng ký' : 'Còn $seats chỗ';
}

(String, CtmsStatus)? _difficultyBadge(String? difficulty) =>
    switch (difficulty) {
      'easy' => ('Dễ', CtmsStatus.success),
      'moderate' => ('Trung bình', CtmsStatus.neutral),
      'hard' => ('Khó', CtmsStatus.warning),
      'expert' => ('Rất khó', CtmsStatus.danger),
      _ => null,
    };

class _ExploreTripCard extends StatelessWidget {
  const _ExploreTripCard({super.key, required this.trip});

  final PublishedTrip trip;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.lg),
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: Text(trip.title, style: AppTypography.h3)),
              if (_difficultyBadge(trip.difficulty) case (
                final label,
                final status,
              )) ...[
                const SizedBox(width: AppSpacing.sm),
                CtmsStatusBadge(label: label, status: status),
              ],
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Khởi hành ${_dateLabel(trip.startsAt)} · ${_durationLabel(trip)}',
          ),
          Text(_availabilityLabel(trip), style: AppTypography.caption),
          const SizedBox(height: AppSpacing.sm),
          const Divider(),
          Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                _priceLabel(trip),
                style: AppTypography.h3.copyWith(color: AppColors.brandPrimary),
              ),
              CtmsButton(
                label: 'Xem chi tiết',
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => _PublishedTripDetails(tripId: trip.id),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PublishedTripDetails extends ConsumerWidget {
  const _PublishedTripDetails({required this.tripId});

  final String tripId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final details = ref.watch(publishedTripDetailsProvider(tripId));
    final accountId = ref.watch(offlinePackageAccountProvider);

    return CtmsScaffold(
      title: 'Chi tiết chuyến đi',
      body: details.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => CtmsEmptyState(
          icon: Icons.cloud_off_outlined,
          title: 'Không tải được chi tiết chuyến đi',
          action: CtmsButton(
            label: 'Thử lại',
            onPressed: () =>
                ref.invalidate(publishedTripDetailsProvider(tripId)),
          ),
        ),
        data: (trip) => _buildDetails(context, trip, accountId),
      ),
    );
  }

  Widget _buildDetails(
    BuildContext context,
    PublishedTrip trip,
    String? accountId,
  ) {
    final description = trip.description?.trim();
    final rows = [
      ('Khởi hành', _dateTimeFormat.format(trip.startsAt.toLocal())),
      ('Kết thúc', _dateTimeFormat.format(trip.endsAt.toLocal())),
      ('Thời lượng', _durationLabel(trip)),
      if (_difficultyBadge(trip.difficulty) case (final label, _))
        ('Độ khó', label),
      ('Hạn đăng ký', _dateTimeFormat.format(trip.bookingDeadline.toLocal())),
      ('Tình trạng', _availabilityLabel(trip)),
      ('Giá', _priceLabel(trip)),
    ];

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.xxl),
      children: [
        Text(trip.title, style: AppTypography.h2),
        const SizedBox(height: AppSpacing.md),
        if (description != null && description.isNotEmpty) ...[
          Text(description, style: AppTypography.body),
          const SizedBox(height: AppSpacing.md),
        ],
        for (final (label, value) in rows)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(label, style: AppTypography.caption),
            subtitle: Text(value, style: AppTypography.bodyStrong),
          ),
        if (accountId != null)
          CtmsButton(
            label: 'Dữ liệu ngoại tuyến',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => OfflinePackageScreen(
                  tripId: trip.id,
                  accountId: accountId,
                  tripTitle: trip.title,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
