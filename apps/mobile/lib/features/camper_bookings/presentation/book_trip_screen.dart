import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_error_state.dart';
import '../../../core/widgets/ctms_key_value_row.dart';
import '../../../core/widgets/ctms_loading_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../camper/domain/published_trip.dart';
import '../../trip_reviews/presentation/review_bookings_tab.dart';
import '../data/camper_bookings_api.dart';
import '../domain/camper_booking_models.dart';
import 'booking_members_card.dart';
import 'booking_payment_section.dart';
import 'camper_booking_format.dart';

/// Same rule as the API (`calculateRentalDays`): whole days, at least 1.
int rentalDaysFor(DateTime startsAt, DateTime endsAt) {
  final days = (endsAt.difference(startsAt).inMilliseconds / Duration.millisecondsPerDay).ceil();
  return days < 1 ? 1 : days;
}

enum _Step { people, equipment, payment, done }

/// Book a published Trip: number of people → rented equipment → pay.
/// The Booking is created when leaving step 1, so the seats are held while
/// the Camper picks equipment and pays.
class BookTripScreen extends ConsumerStatefulWidget {
  const BookTripScreen({super.key, required this.trip});

  final PublishedTrip trip;

  @override
  ConsumerState<BookTripScreen> createState() => _BookTripScreenState();
}

class _BookTripScreenState extends ConsumerState<BookTripScreen> {
  late final String _createKey = newIdempotencyKey('booking:${widget.trip.id}');
  _Step _step = _Step.people;
  int _people = 1;
  bool _healthProfileConsent = false;
  final Map<String, int> _quantities = {};
  CamperBooking? _booking;
  bool _busy = false;
  String? _error;

  int get _maxPeople {
    final seats = widget.trip.remainingSeats;
    if (seats == null) return 20;
    return seats.clamp(1, 20);
  }

  int get _rentalDays => rentalDaysFor(widget.trip.startsAt, widget.trip.endsAt);

  Future<void> _createBooking() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final booking = await ref
          .read(camperBookingsApiProvider)
          .createBooking(
            tripId: widget.trip.id,
            numPeople: _people,
            idempotencyKey: _createKey,
            healthProfileConsent: _healthProfileConsent,
          );
      ref.invalidate(reviewBookingsProvider);
      if (mounted) {
        setState(() {
          _booking = booking;
          _step = _Step.equipment;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = bookingErrorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _saveEquipment() async {
    final booking = _booking!;
    final selected = _quantities.values.any((quantity) => quantity > 0);
    if (!selected && booking.equipment.isEmpty) {
      setState(() => _step = _Step.payment);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final api = ref.read(camperBookingsApiProvider);
      await api.syncItems(booking.id, _quantities);
      // The details carry the equipment names for the confirmation step.
      final updated = await api.fetchBooking(booking.id);
      if (mounted) {
        setState(() {
          _booking = updated;
          _step = _Step.payment;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = bookingErrorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _paid(CamperBooking booking) {
    ref.invalidate(reviewBookingsProvider);
    setState(() {
      _booking = booking;
      _step = _Step.done;
    });
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_busy,
      child: CtmsScaffold(
        title: 'Đặt chỗ',
        subtitle: widget.trip.title,
        body: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            if (_step != _Step.done) ...[
              _StepHeader(step: _step),
              const SizedBox(height: AppSpacing.lg),
            ],
            if (_error != null) ...[
              CtmsAlertBanner(severity: CtmsAlertSeverity.danger, title: 'Không thực hiện được', message: _error!),
              const SizedBox(height: AppSpacing.lg),
            ],
            switch (_step) {
              _Step.people => _buildPeople(),
              _Step.equipment => _buildEquipment(),
              _Step.payment => _buildPayment(),
              _Step.done => _buildDone(),
            },
          ],
        ),
      ),
    );
  }

  Widget _buildPeople() {
    final trip = widget.trip;
    return CtmsSectionCard(
      title: 'Số người tham gia',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(child: Text('Số người', style: AppTypography.bodyStrong)),
              _QuantityStepper(
                value: _people,
                min: 1,
                max: _maxPeople,
                label: 'số người',
                onChanged: (value) => setState(() => _people = value),
              ),
            ],
          ),
          if (trip.remainingSeats != null)
            Text('Còn ${trip.remainingSeats} chỗ', style: AppTypography.caption.copyWith(color: AppColors.textMuted)),
          const SizedBox(height: AppSpacing.md),
          CtmsKeyValueRow(label: 'Giá mỗi người', value: formatVnd(trip.pricePerPerson.toDouble())),
          CtmsKeyValueRow(label: 'Tạm tính', value: formatVnd(trip.pricePerPerson.toDouble() * _people)),
          const SizedBox(height: AppSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Checkbox(
                key: const ValueKey('booking-health-consent-checkbox'),
                value: _healthProfileConsent,
                onChanged: _busy
                    ? null
                    : (value) => setState(() => _healthProfileConsent = value ?? false),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.sm),
                  child: GestureDetector(
                    onTap: _busy
                        ? null
                        : () => setState(() => _healthProfileConsent = !_healthProfileConsent),
                    child: Text(
                      'Tôi đồng ý chia sẻ Hồ sơ sức khỏe để nhận hỗ trợ an toàn tốt hơn (không bắt buộc).',
                      style: AppTypography.body.copyWith(color: AppColors.textPrimary),
                    ),
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Thông tin chia sẻ Hồ sơ sức khỏe',
                icon: const Icon(Icons.info_outline, size: 20, color: AppColors.textSecondary),
                onPressed: () {
                  showDialog<void>(
                    context: context,
                    builder: (dialogContext) => AlertDialog(
                      title: const Text('Chia sẻ Hồ sơ sức khỏe'),
                      content: const Text(
                        'Khi bạn đồng ý, thông tin nhóm máu, dị ứng, bệnh nền và liên hệ khẩn cấp trong Hồ sơ sức khỏe sẽ được chia sẻ cho đơn vị tổ chức và người dẫn đường phụ trách chuyến đi này. Tùy chọn này không bắt buộc và bạn có thể thay đổi bất cứ lúc nào trong Hồ sơ cá nhân.',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.of(dialogContext).pop(),
                          child: const Text('Đã hiểu'),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          CtmsButton(
            label: 'Tiếp tục',
            size: CtmsButtonSize.lg,
            isLoading: _busy,
            onPressed: _createBooking,
          ),
        ],
      ),
    );
  }

  Widget _buildEquipment() {
    final equipment = ref.watch(rentableEquipmentProvider(widget.trip.id));
    return CtmsSectionCard(
      title: 'Thuê thiết bị (không bắt buộc)',
      child: equipment.when(
        loading: () => const CtmsLoadingState(message: 'Đang tải thiết bị cho thuê...'),
        error: (error, _) => CtmsErrorState(
          message: bookingErrorText(error, fallback: 'Không tải được danh sách thiết bị.'),
          onRetry: () => ref.invalidate(rentableEquipmentProvider(widget.trip.id)),
        ),
        data: (items) {
          final estimate = items.fold<double>(
            0,
            (sum, item) => sum + item.rentalPricePerDay * (_quantities[item.id] ?? 0) * _rentalDays,
          );
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (items.isEmpty)
                const CtmsEmptyState(
                  icon: Icons.backpack_outlined,
                  title: 'Host chưa có thiết bị cho thuê',
                  message: 'Bạn có thể tiếp tục để thanh toán.',
                )
              else ...[
                Text(
                  'Giá thuê tính theo ngày, chuyến đi này tính $_rentalDays ngày.',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                ),
                const SizedBox(height: AppSpacing.sm),
                for (final item in items) _EquipmentRow(
                  item: item,
                  quantity: _quantities[item.id] ?? 0,
                  onChanged: (value) => setState(() => _quantities[item.id] = value),
                ),
                const Divider(height: AppSpacing.xxl),
                CtmsKeyValueRow(label: 'Tạm tính tiền thuê', value: formatVnd(estimate)),
              ],
              const SizedBox(height: AppSpacing.lg),
              CtmsButton(
                label: 'Tiếp tục',
                size: CtmsButtonSize.lg,
                isLoading: _busy,
                onPressed: _saveEquipment,
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildPayment() {
    final booking = _booking!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CtmsSectionCard(
          title: 'Xác nhận đơn đặt chỗ',
          child: Column(
            children: [
              CtmsKeyValueRow(label: 'Chuyến đi', value: widget.trip.title),
              CtmsKeyValueRow(label: 'Khởi hành', value: formatDateTime(widget.trip.startsAt)),
              CtmsKeyValueRow(label: 'Số người', value: '${booking.numPeople}'),
              CtmsKeyValueRow(label: 'Giá chuyến đi', value: formatVnd(booking.basePrice)),
              for (final item in booking.equipment)
                CtmsKeyValueRow(
                  label: 'Thuê thiết bị',
                  value: '${item.name} × ${item.quantity} · ${item.rentalDays} ngày · ${formatVnd(item.totalPrice)}',
                ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        CtmsSectionCard(
          title: 'Thanh toán',
          child: BookingPaymentSection(booking: booking, onPaid: _paid),
        ),
      ],
    );
  }

  Widget _buildDone() {
    final booking = _booking;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CtmsEmptyState(
          icon: Icons.check_circle_outline_rounded,
          title: 'Đặt chỗ thành công',
          message: (booking?.numPeople ?? 1) > 1
              ? 'Thanh toán đã được xác nhận. Bạn có thể mời các thành viên đi cùng ngay bên dưới hoặc bổ sung sau trong mục Đơn hàng.'
              : 'Thanh toán đã được xác nhận. Bạn có thể xem chuyến đi trong tab Chuyến đi.',
          action: CtmsButton(
            label: 'Xem chuyến đi của tôi',
            onPressed: () {
              Navigator.of(context).popUntil((route) => route.isFirst);
              context.go('/camper/trips');
            },
          ),
        ),
        if (booking != null && booking.numPeople > 1) ...[
          const SizedBox(height: AppSpacing.lg),
          BookingMembersCard(bookingId: booking.id),
        ],
      ],
    );
  }
}

class _StepHeader extends StatelessWidget {
  const _StepHeader({required this.step});

  final _Step step;

  static const _labels = ['Số người', 'Thiết bị', 'Thanh toán'];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var index = 0; index < _labels.length; index++) ...[
          if (index > 0) const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: index <= step.index ? AppColors.brandPrimary : AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${index + 1}. ${_labels[index]}',
                  style: AppTypography.caption.copyWith(
                    color: index == step.index ? AppColors.brandPrimary : AppColors.textMuted,
                    fontWeight: index == step.index ? FontWeight.w700 : FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _EquipmentRow extends StatelessWidget {
  const _EquipmentRow({required this.item, required this.quantity, required this.onChanged});

  final RentableEquipment item;
  final int quantity;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name, style: AppTypography.bodyStrong),
                Text(
                  '${formatVnd(item.rentalPricePerDay)}/ngày'
                  '${item.category.isEmpty ? '' : ' · ${item.category}'}',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          _QuantityStepper(
            value: quantity,
            min: 0,
            max: item.quantityTotal,
            label: item.name,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}

class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.value,
    required this.min,
    required this.max,
    required this.label,
    required this.onChanged,
  });

  final int value;
  final int min;
  final int max;
  final String label;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          tooltip: 'Giảm $label',
          onPressed: value > min ? () => onChanged(value - 1) : null,
          icon: const Icon(Icons.remove_circle_outline),
          color: AppColors.brandPrimary,
        ),
        SizedBox(
          width: 28,
          child: Text('$value', textAlign: TextAlign.center, style: AppTypography.bodyStrong),
        ),
        IconButton(
          tooltip: 'Tăng $label',
          onPressed: value < max ? () => onChanged(value + 1) : null,
          icon: const Icon(Icons.add_circle_outline),
          color: AppColors.brandPrimary,
        ),
      ],
    );
  }
}
