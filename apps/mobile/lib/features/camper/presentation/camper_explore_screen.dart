import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../overview/domain/camper_overview_models.dart';
import 'camper_trip_detail_screen.dart';

class _ExploreTripItem {
  _ExploreTripItem({
    required this.id,
    required this.name,
    required this.location,
    required this.durationText,
    required this.startDate,
    required this.difficulty,
    required this.price,
    required this.porterName,
    required this.category,
    required this.slotsLeft,
  });

  final String id;
  final String name;
  final String location;
  final String durationText;
  final DateTime startDate;
  final String difficulty;
  final String price;
  final String porterName;
  final String category; // 'all', 'day_trip', 'overnight', 'easy', 'hard'
  final int slotsLeft;
}

final _kExploreTrips = [
  _ExploreTripItem(
    id: 'a1736fee-62be-4991-9478-a62288e9b80a',
    name: 'Trekking Tà Năng – Phan Dũng',
    location: 'Lâm Đồng – Bình Thuận',
    durationText: '3 ngày 2 đêm',
    startDate: DateTime(2026, 7, 28),
    difficulty: 'Trung bình',
    price: '2.450.000 đ',
    porterName: 'Nguyễn Minh Sơn',
    category: 'overnight',
    slotsLeft: 4,
  ),
  _ExploreTripItem(
    id: 'b2847ffe-73cf-4002-8589-b73399e0c91b',
    name: 'Chinh phục Đỉnh Fansipan',
    location: 'Sa Pa, Lào Cai',
    durationText: '2 ngày 1 đêm',
    startDate: DateTime(2026, 8, 15),
    difficulty: 'Thử thách',
    price: '3.200.000 đ',
    porterName: 'Trần Văn Cường',
    category: 'hard',
    slotsLeft: 2,
  ),
  _ExploreTripItem(
    id: 'c395800f-84d0-5113-969a-c84400f1da2c',
    name: 'Cắm trại & Khám phá Rừng Cát Tiên',
    location: 'Tân Phú, Đồng Nai',
    durationText: 'Trong ngày',
    startDate: DateTime(2026, 8, 22),
    difficulty: 'Dễ & Thư giãn',
    price: '1.450.000 đ',
    porterName: 'Lê Hoàng Hải',
    category: 'day_trip',
    slotsLeft: 8,
  ),
  _ExploreTripItem(
    id: 'd4069110-95e1-6224-070b-d9551102eb3d',
    name: 'Trekking Bidoup Núi Bà',
    location: 'Lạc Dương, Lâm Đồng',
    durationText: '2 ngày 1 đêm',
    startDate: DateTime(2026, 9, 5),
    difficulty: 'Trung bình',
    price: '2.850.000 đ',
    porterName: 'Nguyễn Minh Sơn',
    category: 'overnight',
    slotsLeft: 6,
  ),
];

class CamperExploreScreen extends StatefulWidget {
  const CamperExploreScreen({super.key});

  @override
  State<CamperExploreScreen> createState() => _CamperExploreScreenState();
}

class _CamperExploreScreenState extends State<CamperExploreScreen> {
  final _searchController = TextEditingController();
  String _selectedCategory = 'all';

  static const _categories = [
    ('all', 'Tất cả'),
    ('day_trip', 'Trong ngày'),
    ('overnight', 'Qua đêm'),
    ('easy', 'Dễ & Thư giãn'),
    ('hard', 'Thử thách'),
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<_ExploreTripItem> get _filteredTrips {
    final query = _searchController.text.trim().toLowerCase();
    return _kExploreTrips.where((trip) {
      final matchesCategory = _selectedCategory == 'all' ||
          trip.category == _selectedCategory ||
          (_selectedCategory == 'easy' && trip.difficulty.contains('Dễ')) ||
          (_selectedCategory == 'hard' && trip.difficulty.contains('Thử thách'));

      final matchesQuery = query.isEmpty ||
          trip.name.toLowerCase().contains(query) ||
          trip.location.toLowerCase().contains(query);

      return matchesCategory && matchesQuery;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredTrips;

    return CtmsScaffold(
      title: 'Khám phá',
      subtitle: 'Tìm tuyến trekking cho chuyến đi tiếp theo',
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        children: [
          // 1. Search Box
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: AppRadius.controlBorderRadius,
              border: Border.all(color: AppColors.border, width: 1.0),
              boxShadow: AppColors.cardShadowSm,
            ),
            child: TextField(
              controller: _searchController,
              onChanged: (_) => setState(() {}),
              style: AppTypography.body.copyWith(color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: 'Tìm theo tên chuyến đi, địa danh...',
                hintStyle: AppTypography.body.copyWith(color: AppColors.textSecondary),
                prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textPrimary),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, size: 18, color: AppColors.textSecondary),
                        onPressed: () {
                          _searchController.clear();
                          setState(() {});
                        },
                      )
                    : null,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.md,
                ),
              ),
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          // 2. Filter Category Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _categories.map((cat) {
                final isSelected = _selectedCategory == cat.$1;
                return Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedCategory = cat.$1),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.brandPrimary : Colors.white,
                        borderRadius: AppRadius.pillBorderRadius,
                        border: Border.all(
                          color: isSelected ? AppColors.brandPrimary : AppColors.border,
                          width: 1.0,
                        ),
                        boxShadow: isSelected ? null : AppColors.cardShadowSm,
                      ),
                      child: Text(
                        cat.$2,
                        style: TextStyle(
                          color: isSelected ? Colors.white : AppColors.textPrimary,
                          fontSize: 13,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: AppSpacing.lg),

          // 3. Section Title
          Text(
            'Chuyến đi nổi bật (${filtered.length})',
            style: AppTypography.h3.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          // 4. Trip Cards
          if (filtered.isEmpty)
            Container(
              padding: const EdgeInsets.all(AppSpacing.xxl),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppRadius.cardBorderRadius,
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  const Icon(Icons.search_off_rounded, size: 48, color: AppColors.textSecondary),
                  const SizedBox(height: AppSpacing.md),
                  const Text('Không tìm thấy chuyến đi nào', style: AppTypography.bodyStrong),
                  const SizedBox(height: 4),
                  const Text(
                    'Hãy thử đổi từ khóa tìm kiếm hoặc chọn bộ lọc khác',
                    style: AppTypography.caption,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            )
          else
            ...filtered.map((trip) => _ExploreTripCard(
                  trip: trip,
                  onSelect: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => CamperTripDetailScreen(
                          tripId: trip.id,
                          trip: UpcomingTrip(
                                                        name: trip.name,
                            startDate: trip.startDate,
                            durationDays: trip.durationText.contains('3')
                                ? 3
                                : trip.durationText.contains('2')
                                    ? 2
                                    : 1,
                            memberCount: 8,
                            difficulty: trip.difficulty,
                            porterName: trip.porterName,
                            weatherRiskLabel: 'Thời tiết an toàn',
                            statusLabel: 'Sắp khởi hành',
                          ),
                        ),
                      ),
                    );
                  },
                )),
        ],
      ),
    );
  }
}

class _ExploreTripCard extends StatelessWidget {
  const _ExploreTripCard({required this.trip, required this.onSelect});

  final _ExploreTripItem trip;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.lg),
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: AppColors.border, width: 1.0),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  trip.name,
                  style: AppTypography.h3.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              CtmsStatusBadge(
                label: trip.difficulty,
                status: trip.difficulty.contains('Dễ')
                    ? CtmsStatus.success
                    : trip.difficulty.contains('Thử thách')
                        ? CtmsStatus.warning
                        : CtmsStatus.neutral,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Text(
                trip.location,
                style: AppTypography.body.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.schedule_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Text(
                'Thời lượng: ${trip.durationText} • Còn ${trip.slotsLeft} chỗ',
                style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Giá từ', style: AppTypography.label),
                  Text(
                    trip.price,
                    style: AppTypography.h3.copyWith(
                      color: AppColors.brandPrimary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              CtmsButton(
                label: 'Xem chi tiết',
                variant: CtmsButtonVariant.primary,
                onPressed: onSelect,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
