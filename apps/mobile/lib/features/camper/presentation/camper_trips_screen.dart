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

class CamperTripsScreen extends StatelessWidget {
  const CamperTripsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: CtmsScaffold(
        title: 'Chuyến đi',
        subtitle: 'Quản lý các chuyến cắm trại và trekking của bạn',
        bottom: const TabBar(
          indicatorColor: AppColors.brandPrimary,
          indicatorWeight: 2.5,
          labelColor: AppColors.brandPrimary,
          unselectedLabelColor: AppColors.textSecondary,
          labelStyle: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
          unselectedLabelStyle: TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
          tabs: [
            Tab(text: 'Chuyến đi của tôi'),
            Tab(text: 'Đơn đặt chỗ'),
          ],
        ),
        body: TabBarView(
          children: [
            _MyTripsTab(),
            _BookingsTab(),
          ],
        ),
      ),
    );
  }
}

class _MyTripsTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.xxl),
      children: [
        // 1. Chuyến đi sắp tới
        Text(
          'Chuyến đi sắp tới',
          style: AppTypography.h3.copyWith(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Container(
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
                      'Trekking Tà Năng – Phan Dũng',
                      style: AppTypography.h3.copyWith(
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  const CtmsStatusBadge(
                    label: 'Đã xác nhận',
                    status: CtmsStatus.success,
                    showDot: true,
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.calendar_today_outlined, size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    '28/07/2026 • 3 ngày 2 đêm',
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
                  const Icon(Icons.person_pin_outlined, size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    'Porter phụ trách: Nguyễn Minh Sơn',
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
                  Expanded(
                    child: Text(
                      'Thời tiết: An toàn, nắng ráo',
                      style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  CtmsButton(
                    label: 'Xem chi tiết',
                    variant: CtmsButtonVariant.primary,
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => CamperTripDetailScreen(
                            tripId: 'a1736fee-62be-4991-9478-a62288e9b80a',
                            trip: UpcomingTrip(
                              name: 'Trekking Tà Năng – Phan Dũng',
                              startDate: DateTime(2026, 7, 28),
                              durationDays: 3,
                              memberCount: 8,
                              difficulty: 'Trung bình',
                              porterName: 'Nguyễn Minh Sơn',
                              weatherRiskLabel: 'Thời tiết an toàn',
                              statusLabel: 'Đã xác nhận',
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: AppSpacing.xxl),

        // 2. Lịch sử chuyến đi
        Text(
          'Lịch sử chuyến đi',
          style: AppTypography.h3.copyWith(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Container(
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
                      'Chinh phục Bidoup Núi Bà',
                      style: AppTypography.h3.copyWith(
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  const CtmsStatusBadge(
                    label: 'Hoàn thành',
                    status: CtmsStatus.neutral,
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.calendar_today_outlined, size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    '15/04/2026 • 2 ngày 1 đêm',
                    style: AppTypography.body.copyWith(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              const Divider(height: 1, thickness: 1, color: AppColors.border),
              const SizedBox(height: AppSpacing.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('8/8 thành viên an toàn', style: AppTypography.caption),
                  CtmsButton(
                    label: 'Đánh giá chuyến đi',
                    variant: CtmsButtonVariant.secondary,
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Tính năng đánh giá đang được xử lý')),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _BookingsTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.xxl),
      children: [
        Text(
          'Đơn đặt chỗ gần đây',
          style: AppTypography.h3.copyWith(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        _buildBookingCard(
          context: context,
          bookingCode: '#BK-8921',
          tripName: 'Trekking Tà Năng – Phan Dũng',
          date: '20/07/2026',
          price: '2.450.000 đ',
          status: 'Đã thanh toán',
          statusType: CtmsStatus.success,
        ),
        const SizedBox(height: AppSpacing.lg),
        _buildBookingCard(
          context: context,
          bookingCode: '#BK-7140',
          tripName: 'Chinh phục Bidoup Núi Bà',
          date: '10/04/2026',
          price: '2.850.000 đ',
          status: 'Hoàn tất',
          statusType: CtmsStatus.neutral,
        ),
      ],
    );
  }

  Widget _buildBookingCard({
    required BuildContext context,
    required String bookingCode,
    required String tripName,
    required String date,
    required String price,
    required String status,
    required CtmsStatus statusType,
  }) {
    return Container(
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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                bookingCode,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  color: AppColors.textPrimary,
                ),
              ),
              CtmsStatusBadge(label: status, status: statusType),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            tripName,
            style: AppTypography.bodyStrong.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Ngày đặt: $date',
            style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                price,
                style: AppTypography.h3.copyWith(
                  color: AppColors.brandPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              CtmsButton(
                label: 'Xem biên nhận',
                variant: CtmsButtonVariant.secondary,
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Đang mở biên nhận $bookingCode')),
                  );
                },
              ),
            ],
          ),
        ],
      ),
    );
  }
}
