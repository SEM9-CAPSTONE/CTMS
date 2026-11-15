import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../trip_reviews/presentation/review_bookings_tab.dart';
import '../data/camper_bookings_api.dart';
import 'booking_payment_section.dart';
import 'booking_refund_card.dart';

/// Payment (unpaid Booking) and refund cards for the Camper's "Đơn hàng" tab.
/// Renders nothing while loading or when neither applies, so the tab keeps
/// its existing layout.
class BookingOrderPanel extends ConsumerWidget {
  const BookingOrderPanel({super.key, required this.bookingId});

  final String bookingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final booking = ref.watch(camperBookingProvider(bookingId)).valueOrNull;
    if (booking == null) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (booking.awaitingPayment)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.lg),
            child: CtmsSectionCard(
              title: 'Thanh toán đơn đặt chỗ',
              child: BookingPaymentSection(
                booking: booking,
                onPaid: (_) {
                  ref.invalidate(camperBookingProvider(bookingId));
                  ref.invalidate(refundInfoProvider(bookingId));
                  ref.invalidate(reviewBookingsProvider);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Thanh toán thành công. Chỗ của bạn đã được xác nhận.')),
                  );
                },
              ),
            ),
          ),
        BookingRefundCard(booking: booking),
      ],
    );
  }
}
