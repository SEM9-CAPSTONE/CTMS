import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../data/camper_bookings_api.dart';
import '../domain/camper_booking_models.dart';
import 'camper_booking_format.dart';

/// Opens the PayOS checkout page outside the app. Overridden in tests.
final paymentPageLauncherProvider = Provider<Future<bool> Function(Uri)>(
  (ref) =>
      (uri) => launchUrl(uri, mode: LaunchMode.externalApplication),
);

/// Pay an unpaid Booking: start the PayOS payment, open the checkout page and,
/// back in the app, confirm the result with `sync-payment` (also done
/// automatically when the app comes back to the foreground).
class BookingPaymentSection extends ConsumerStatefulWidget {
  const BookingPaymentSection({super.key, required this.booking, required this.onPaid});

  final CamperBooking booking;
  final ValueChanged<CamperBooking> onPaid;

  @override
  ConsumerState<BookingPaymentSection> createState() => _BookingPaymentSectionState();
}

class _BookingPaymentSectionState extends ConsumerState<BookingPaymentSection>
    with WidgetsBindingObserver {
  /// One key per payment attempt on this screen: retries replay the same
  /// PayOS payment instead of creating a second one.
  late final String _payKey = newIdempotencyKey('pay:${widget.booking.id}');
  Uri? _checkoutUri;
  bool _busy = false;
  String? _error;
  String? _info;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _checkoutUri != null && !_busy) {
      _confirm(silent: true);
    }
  }

  Future<void> _start() async {
    setState(() {
      _busy = true;
      _error = null;
      _info = null;
    });
    try {
      final result = await ref.read(camperBookingsApiProvider).pay(widget.booking.id, idempotencyKey: _payKey);
      if (!mounted) return;
      if (result.isPaid) {
        await _confirm(silent: true);
        return;
      }
      final url = result.checkoutUrl;
      if (url == null || url.isEmpty) {
        setState(() => _error = 'Chưa tạo được trang thanh toán. Vui lòng thử lại sau.');
        return;
      }
      _checkoutUri = Uri.parse(url);
      await _openCheckout();
    } catch (error) {
      if (mounted) setState(() => _error = bookingErrorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openCheckout() async {
    final uri = _checkoutUri;
    if (uri == null) return;
    final opened = await ref.read(paymentPageLauncherProvider)(uri);
    if (!mounted) return;
    setState(() {
      _error = opened ? null : 'Không mở được trang thanh toán trên thiết bị này.';
    });
  }

  Future<void> _confirm({bool silent = false}) async {
    setState(() {
      _busy = true;
      if (!silent) _info = null;
      _error = null;
    });
    try {
      final booking = await ref.read(camperBookingsApiProvider).syncPayment(widget.booking.id);
      if (!mounted) return;
      if (booking.isPaid) {
        widget.onPaid(booking);
      } else if (!silent) {
        setState(
          () => _info =
              'Chưa nhận được thanh toán. Nếu bạn vừa chuyển khoản, vui lòng đợi vài giây rồi bấm lại.',
        );
      }
    } catch (error) {
      if (mounted && !silent) setState(() => _error = bookingErrorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final booking = widget.booking;
    final hold = booking.holdExpiresAt;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(child: Text('Tổng thanh toán', style: AppTypography.bodyStrong)),
            const SizedBox(width: AppSpacing.sm),
            Text(
              formatVnd(booking.totalAmount),
              style: AppTypography.h3.copyWith(color: AppColors.brandPrimary, fontWeight: FontWeight.w800),
            ),
          ],
        ),
        if (hold != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Chỗ của bạn được giữ đến ${formatDateTime(hold)}. Sau thời gian này đơn sẽ tự hết hạn.',
            style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        if (_checkoutUri != null) ...[
          const CtmsAlertBanner(
            severity: CtmsAlertSeverity.info,
            title: 'Hoàn tất thanh toán trên trang PayOS',
            message: 'Sau khi chuyển khoản xong, quay lại ứng dụng và bấm "Tôi đã thanh toán".',
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (_info != null) ...[
          CtmsAlertBanner(severity: CtmsAlertSeverity.warning, title: 'Chưa xác nhận', message: _info!),
          const SizedBox(height: AppSpacing.md),
        ],
        if (_error != null) ...[
          CtmsAlertBanner(severity: CtmsAlertSeverity.danger, title: 'Không thể thanh toán', message: _error!),
          const SizedBox(height: AppSpacing.md),
        ],
        if (_checkoutUri == null)
          CtmsButton(
            label: 'Thanh toán qua PayOS',
            icon: Icons.qr_code_2_rounded,
            size: CtmsButtonSize.lg,
            isLoading: _busy,
            onPressed: _start,
          )
        else ...[
          CtmsButton(
            label: 'Tôi đã thanh toán',
            icon: Icons.verified_outlined,
            size: CtmsButtonSize.lg,
            isLoading: _busy,
            onPressed: _confirm,
          ),
          const SizedBox(height: AppSpacing.sm),
          CtmsButton(
            label: 'Mở lại trang thanh toán',
            icon: Icons.open_in_new_rounded,
            variant: CtmsButtonVariant.secondary,
            onPressed: _busy ? null : _openCheckout,
          ),
        ],
      ],
    );
  }
}
