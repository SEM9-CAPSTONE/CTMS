import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_key_value_row.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../data/camper_bookings_api.dart';
import '../domain/camper_booking_models.dart';
import 'bank_accounts_screen.dart';
import 'camper_booking_format.dart';

/// Wording per refund case, the same as the web `refundFlow`.
class RefundFlowCopy {
  const RefundFlowCopy(this.title, this.description, this.action, this.reasonLabel, this.reasonHint);

  final String title;
  final String description;
  final String action;
  final String reasonLabel;
  final String reasonHint;

  static RefundFlowCopy of(String? origin, String bookingStatus) {
    if (origin == 'host_trip_cancellation' || origin == 'system_trip_cancellation') {
      return const RefundFlowCopy(
        'Hoàn tiền do chuyến đi bị hủy',
        'Chuyến đi đã bị hủy. Khoản hoàn cho đơn đặt chỗ được tạo tự động và theo dõi tại đây.',
        'Yêu cầu nhận tiền hoàn',
        'Thông tin cần đối chiếu',
        'Nêu khoản thanh toán cần đối chiếu sau khi chuyến đi bị hủy.',
      );
    }
    if (origin == 'camper_complaint' || bookingStatus == 'completed') {
      return const RefundFlowCopy(
        'Hoàn tiền sau chuyến đi',
        'Chuyến đi đã kết thúc. Nếu có khoản thu sai hoặc dịch vụ chưa được cung cấp như cam kết, '
            'bạn có thể gửi yêu cầu hoàn tiền để được xem xét.',
        'Yêu cầu hoàn tiền sau chuyến đi',
        'Vấn đề bạn gặp trong chuyến đi',
        'Ví dụ: Đã thanh toán thêm cho dịch vụ nhưng dịch vụ không được cung cấp.',
      );
    }
    if (origin == 'camper_cancellation' || bookingStatus == 'cancelled') {
      return const RefundFlowCopy(
        'Hoàn tiền sau khi hủy đặt chỗ',
        'Bạn đã hủy đặt chỗ. Số tiền hoàn được tính tự động theo chính sách hủy áp dụng cho đơn này.',
        'Yêu cầu nhận tiền hoàn',
        'Lý do yêu cầu nhận tiền hoàn',
        'Nêu lý do hủy đặt chỗ và thông tin cần đối chiếu để nhận tiền hoàn.',
      );
    }
    return const RefundFlowCopy(
      'Thông tin hoàn tiền',
      'Theo dõi yêu cầu và kết quả hoàn tiền của đơn đặt chỗ.',
      'Gửi yêu cầu hoàn tiền',
      'Lý do yêu cầu',
      'Mô tả khoản thanh toán cần hoàn và lý do yêu cầu.',
    );
  }
}

(String, CtmsStatus) refundStatusBadge(RefundRecord refund) {
  if (refund.reviewStatus == 'rejected') return ('Đã từ chối', CtmsStatus.danger);
  return switch (refund.status) {
    'pending' when refund.reviewStatus == 'pending_review' => ('Chờ duyệt', CtmsStatus.warning),
    'pending' when refund.reviewStatus == 'approved' => ('Đã duyệt, chờ chuyển tiền', CtmsStatus.info),
    'pending' => ('Đang xử lý', CtmsStatus.info),
    'succeeded' => ('Đã hoàn tiền', CtmsStatus.success),
    'failed' => ('Thất bại', CtmsStatus.danger),
    _ => ('Không rõ', CtmsStatus.neutral),
  };
}

/// Refund status and request for one Booking (shown in the "Đơn hàng" tab).
class BookingRefundCard extends ConsumerWidget {
  const BookingRefundCard({super.key, required this.booking});

  final CamperBooking booking;

  bool get _relevantBooking =>
      booking.isPaid || booking.status == 'cancelled' || booking.status == 'completed';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final info = ref.watch(refundInfoProvider(booking.id)).valueOrNull;
    if (info == null) return const SizedBox.shrink();
    // Same visibility rule as the web BookingRefundPanel.
    if (!_relevantBooking && info.refunds.isEmpty) return const SizedBox.shrink();
    if (booking.status == 'confirmed' && info.origin == null && info.refunds.isEmpty) {
      return const SizedBox.shrink();
    }

    final copy = RefundFlowCopy.of(info.origin, booking.status);
    final latest = info.pending ?? (info.refunds.isEmpty ? null : info.refunds.first);
    var unavailable = 'Hiện chưa thể gửi yêu cầu hoàn tiền cho đơn này.';
    if (info.windowExpired) unavailable = 'Đã hết thời hạn gửi yêu cầu hoàn tiền.';
    if (info.fullyRefunded) unavailable = 'Toàn bộ số tiền đã thanh toán đã được hoàn tất.';

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: CtmsSectionCard(
        title: copy.title,
        trailing: latest == null
            ? null
            : Builder(
                builder: (_) {
                  final (label, status) = refundStatusBadge(latest);
                  return CtmsStatusBadge(label: label, status: status);
                },
              ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              info.fullyRefunded
                  ? 'Khoản hoàn đã được xác nhận chuyển về tài khoản ngân hàng của bạn.'
                  : copy.description,
              style: AppTypography.body.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.md),
            CtmsKeyValueRow(label: 'Đã hoàn', value: formatVnd(info.totalRefunded)),
            CtmsKeyValueRow(label: 'Còn có thể hoàn', value: formatVnd(info.remainingRefundable)),
            if (info.deadline != null)
              CtmsKeyValueRow(label: 'Hạn gửi yêu cầu', value: formatDateTime(info.deadline!)),
            if (info.settlementBlocked && info.pending == null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Yêu cầu đang được kiểm tra. Bạn có thể theo dõi kết quả xử lý tại đây.',
                style: AppTypography.caption.copyWith(color: AppColors.statusWarning),
              ),
            ],
            if (info.refunds.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              Text('Lịch sử hoàn tiền', style: AppTypography.bodyStrong),
              for (final refund in info.refunds) _RefundRow(refund: refund),
            ],
            const SizedBox(height: AppSpacing.md),
            if (info.canRequest)
              CtmsButton(
                label: copy.action,
                icon: Icons.currency_exchange_rounded,
                onPressed: () async {
                  final sent = await showModalBottomSheet<bool>(
                    context: context,
                    isScrollControlled: true,
                    useSafeArea: true,
                    builder: (_) => RefundRequestSheet(booking: booking, info: info, copy: copy),
                  );
                  if (sent == true && context.mounted) {
                    ref.invalidate(refundInfoProvider(booking.id));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Đã gửi yêu cầu hoàn tiền. Vui lòng chờ xét duyệt.')),
                    );
                  }
                },
              )
            else if (info.pending == null)
              Text(unavailable, style: AppTypography.caption.copyWith(color: AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}

class _RefundRow extends StatelessWidget {
  const _RefundRow({required this.refund});

  final RefundRecord refund;

  @override
  Widget build(BuildContext context) {
    final (label, status) = refundStatusBadge(refund);
    final note = refund.failureReason ?? refund.note;
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(formatVnd(refund.amount), style: AppTypography.bodyStrong),
                Text(formatDateTime(refund.createdAt), style: AppTypography.caption.copyWith(color: AppColors.textMuted)),
                if (note != null && note.isNotEmpty)
                  Text(note, style: AppTypography.caption.copyWith(color: AppColors.textSecondary)),
              ],
            ),
          ),
          CtmsStatusBadge(label: label, status: status),
        ],
      ),
    );
  }
}

/// Bottom sheet: reason + receiving bank account, then send the request for
/// the full remaining amount (same as the web dialog).
class RefundRequestSheet extends ConsumerStatefulWidget {
  const RefundRequestSheet({super.key, required this.booking, required this.info, required this.copy});

  final CamperBooking booking;
  final RefundInfo info;
  final RefundFlowCopy copy;

  @override
  ConsumerState<RefundRequestSheet> createState() => _RefundRequestSheetState();
}

class _RefundRequestSheetState extends ConsumerState<RefundRequestSheet> {
  late final String _key = newIdempotencyKey('refund:${widget.booking.id}');
  final _reason = TextEditingController();
  String? _accountId;
  String? _reasonError;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit(List<BankAccount> accounts) async {
    final reason = _reason.text.trim();
    final error = reason.length < 5
        ? 'Lý do phải có ít nhất 5 ký tự'
        : reason.length > 255
        ? 'Lý do không được vượt quá 255 ký tự'
        : null;
    setState(() => _reasonError = error);
    if (error != null) return;
    final account = accounts.firstWhere((item) => item.id == _accountId, orElse: () => accounts.first);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(camperBookingsApiProvider).requestRefund(
        widget.booking.id,
        reason: reason,
        amount: widget.info.remainingRefundable,
        origin: widget.info.origin,
        account: account,
        idempotencyKey: _key,
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = bookingErrorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accounts = ref.watch(bankAccountsProvider);
    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.xl,
        right: AppSpacing.xl,
        top: AppSpacing.xl,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.xl,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.copy.action, style: AppTypography.h2),
            const SizedBox(height: AppSpacing.sm),
            CtmsKeyValueRow(label: 'Số tiền yêu cầu hoàn', value: formatVnd(widget.info.remainingRefundable)),
            const SizedBox(height: AppSpacing.lg),
            TextField(
              controller: _reason,
              maxLines: 3,
              maxLength: 255,
              enabled: !_busy,
              onChanged: (_) {
                if (_reasonError != null) setState(() => _reasonError = null);
              },
              decoration: InputDecoration(
                labelText: '${widget.copy.reasonLabel} *',
                hintText: widget.copy.reasonHint,
                errorText: _reasonError,
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text('Tài khoản nhận tiền hoàn', style: AppTypography.bodyStrong),
            const SizedBox(height: AppSpacing.sm),
            accounts.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(AppSpacing.md),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (error, _) => Text(
                bookingErrorText(error, fallback: 'Không tải được tài khoản ngân hàng.'),
                style: AppTypography.caption.copyWith(color: AppColors.statusDanger),
              ),
              data: (items) => items.isEmpty
                  ? _NoAccount(onAdd: () => _openAccounts(context))
                  : _accountChoices(items),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.md),
              CtmsAlertBanner(severity: CtmsAlertSeverity.danger, title: 'Không gửi được yêu cầu', message: _error!),
            ],
            const SizedBox(height: AppSpacing.lg),
            CtmsButton(
              label: 'Gửi yêu cầu',
              size: CtmsButtonSize.lg,
              isLoading: _busy,
              onPressed: (accounts.valueOrNull?.isNotEmpty ?? false) ? () => _submit(accounts.value!) : null,
            ),
          ],
        ),
      ),
    );
  }

  Widget _accountChoices(List<BankAccount> items) {
    final selected =
        _accountId ?? (items.where((item) => item.isDefault).firstOrNull ?? items.first).id;
    return RadioGroup<String>(
      groupValue: selected,
      onChanged: (value) => setState(() => _accountId = value),
      child: Column(
        children: [
          for (final account in items)
            RadioListTile<String>(
              value: account.id,
              contentPadding: EdgeInsets.zero,
              title: Text('${account.bankName} · ${account.maskedNumber}', style: AppTypography.bodyStrong),
              subtitle: Text(
                account.isDefault ? '${account.accountHolderName} · Mặc định' : account.accountHolderName,
                style: AppTypography.caption,
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _openAccounts(BuildContext context) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const BankAccountsScreen()));
    ref.invalidate(bankAccountsProvider);
  }
}

class _NoAccount extends StatelessWidget {
  const _NoAccount({required this.onAdd});

  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Bạn chưa có tài khoản ngân hàng nhận tiền. Thêm tài khoản để gửi yêu cầu hoàn tiền.',
          style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.sm),
        CtmsButton(
          label: 'Thêm tài khoản ngân hàng',
          icon: Icons.add_card_rounded,
          variant: CtmsButtonVariant.secondary,
          onPressed: onAdd,
        ),
      ],
    );
  }
}
