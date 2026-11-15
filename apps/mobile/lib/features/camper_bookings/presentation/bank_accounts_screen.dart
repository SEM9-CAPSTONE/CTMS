import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_error_state.dart';
import '../../../core/widgets/ctms_loading_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../data/camper_bookings_api.dart';
import '../domain/camper_booking_models.dart';
import 'camper_booking_format.dart';

/// Same list as the web (features/booking-refund/constants.ts).
const vietnamPopularBanks = [
  'Vietcombank',
  'MB Bank (Ngân hàng Quân đội)',
  'Techcombank',
  'BIDV',
  'VietinBank',
  'ACB (Ngân hàng Á Châu)',
  'VPBank',
  'TPBank',
  'Agribank',
  'Sacombank',
  'HDBank',
  'OCB (Phương Đông)',
  'SHB',
  'VIB (Quốc Tế)',
  'MSB (Hàng Hải)',
  'SeABank',
  'Nam A Bank',
  'Bac A Bank',
  'Kienlongbank',
];
const otherBank = 'Khác (Ngân hàng khác)';

const _accents = {
  'a': 'àáạảãâầấậẩẫăằắặẳẵ',
  'e': 'èéẹẻẽêềếệểễ',
  'i': 'ìíịỉĩ',
  'o': 'òóọỏõôồốộổỗơờớợởỡ',
  'u': 'ùúụủũưừứựửữ',
  'y': 'ỳýỵỷỹ',
  'd': 'đ',
};

/// `Nguyễn Văn A` → `NGUYEN VAN A`, the form banks print (same as the web
/// `normalizeVietnameseName`).
String normalizeAccountHolderName(String name) {
  final buffer = StringBuffer();
  for (final char in name.toLowerCase().split('')) {
    final plain = _accents.entries.where((entry) => entry.value.contains(char)).firstOrNull?.key;
    buffer.write(plain ?? char);
  }
  return buffer.toString().trim().toUpperCase().replaceAll(RegExp(r'\s+'), ' ');
}

/// Profile entry: opens the bank account list.
class BankAccountsEntryTile extends StatelessWidget {
  const BankAccountsEntryTile({super.key});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: AppColors.brandLight,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.brandLightBorder),
        ),
        child: const Icon(Icons.account_balance_outlined, color: AppColors.brandPrimary, size: 20),
      ),
      title: Text('Tài khoản ngân hàng', style: AppTypography.bodyStrong.copyWith(color: AppColors.textPrimary)),
      subtitle: Text(
        'Tài khoản nhận tiền hoàn khi huỷ đặt chỗ hoặc khiếu nại',
        style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
      ),
      trailing: const Icon(Icons.chevron_right, color: AppColors.textSecondary),
      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const BankAccountsScreen())),
    );
  }
}

class BankAccountsScreen extends ConsumerStatefulWidget {
  const BankAccountsScreen({super.key});

  @override
  ConsumerState<BankAccountsScreen> createState() => _BankAccountsScreenState();
}

class _BankAccountsScreenState extends ConsumerState<BankAccountsScreen> {
  String? _busyId;

  Future<void> _run(String id, Future<void> Function() action, String done) async {
    setState(() => _busyId = id);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
      ref.invalidate(bankAccountsProvider);
      messenger
        ..removeCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(done)));
    } catch (error) {
      messenger
        ..removeCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(bookingErrorText(error))));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _confirmDelete(BankAccount account) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Xoá tài khoản ngân hàng?'),
        content: Text('${account.bankName} · ${account.maskedNumber} sẽ không còn dùng để nhận tiền hoàn.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Huỷ')),
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('Xoá')),
        ],
      ),
    );
    if (confirmed != true) return;
    await _run(
      account.id,
      () => ref.read(camperBookingsApiProvider).deleteBankAccount(account.id),
      'Đã xoá tài khoản ngân hàng.',
    );
  }

  Future<void> _add() async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => const AddBankAccountSheet(),
    );
    if (added == true && mounted) {
      ref.invalidate(bankAccountsProvider);
      ScaffoldMessenger.of(context)
        ..removeCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Đã thêm tài khoản ngân hàng.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final accounts = ref.watch(bankAccountsProvider);
    return CtmsScaffold(
      title: 'Tài khoản ngân hàng',
      subtitle: 'Nhận tiền hoàn cho đơn đặt chỗ',
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add,
        backgroundColor: AppColors.brandPrimary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Thêm tài khoản'),
      ),
      body: accounts.when(
        loading: () => const CtmsLoadingState(message: 'Đang tải tài khoản ngân hàng...'),
        error: (error, _) => CtmsErrorState(
          message: bookingErrorText(error, fallback: 'Không tải được tài khoản ngân hàng.'),
          onRetry: () => ref.invalidate(bankAccountsProvider),
        ),
        data: (items) => RefreshIndicator(
          onRefresh: () => ref.refresh(bankAccountsProvider.future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, 96),
            children: [
              if (items.isEmpty)
                const CtmsEmptyState(
                  icon: Icons.account_balance_outlined,
                  title: 'Chưa có tài khoản ngân hàng',
                  message: 'Thêm tài khoản để nhận tiền hoàn khi huỷ đặt chỗ hoặc khiếu nại sau chuyến đi.',
                )
              else
                for (final account in items)
                  _AccountCard(
                    account: account,
                    busy: _busyId == account.id,
                    onSetDefault: () => _run(
                      account.id,
                      () => ref.read(camperBookingsApiProvider).setDefaultBankAccount(account.id),
                      'Đã đặt làm tài khoản mặc định.',
                    ),
                    onDelete: () => _confirmDelete(account),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AccountCard extends StatelessWidget {
  const _AccountCard({
    required this.account,
    required this.busy,
    required this.onSetDefault,
    required this.onDelete,
  });

  final BankAccount account;
  final bool busy;
  final VoidCallback onSetDefault;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: account.isDefault ? AppColors.brandPrimary : AppColors.border),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(account.bankName, style: AppTypography.h3)),
              if (account.isDefault) const CtmsStatusBadge(label: 'Mặc định', status: CtmsStatus.success),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(account.accountNumber, style: AppTypography.bodyStrong),
          Text(account.accountHolderName, style: AppTypography.caption.copyWith(color: AppColors.textSecondary)),
          const SizedBox(height: AppSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (!account.isDefault)
                TextButton(onPressed: busy ? null : onSetDefault, child: const Text('Đặt mặc định')),
              TextButton(
                onPressed: busy ? null : onDelete,
                style: TextButton.styleFrom(foregroundColor: AppColors.statusDanger),
                child: const Text('Xoá'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class AddBankAccountSheet extends ConsumerStatefulWidget {
  const AddBankAccountSheet({super.key});

  @override
  ConsumerState<AddBankAccountSheet> createState() => _AddBankAccountSheetState();
}

class _AddBankAccountSheetState extends ConsumerState<AddBankAccountSheet> {
  final _formKey = GlobalKey<FormState>();
  final _otherBank = TextEditingController();
  final _number = TextEditingController();
  final _holder = TextEditingController();
  String? _bank;
  bool _isDefault = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _otherBank.dispose();
    _number.dispose();
    _holder.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final bankName = _bank == otherBank ? _otherBank.text.trim() : _bank!;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(camperBookingsApiProvider).addBankAccount(
        bankName: bankName,
        accountNumber: _number.text.trim(),
        accountHolderName: normalizeAccountHolderName(_holder.text),
        isDefault: _isDefault,
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
    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.xl,
        right: AppSpacing.xl,
        top: AppSpacing.xl,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.xl,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Thêm tài khoản ngân hàng', style: AppTypography.h2),
              const SizedBox(height: AppSpacing.lg),
              DropdownButtonFormField<String>(
                initialValue: _bank,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Ngân hàng *', border: OutlineInputBorder()),
                items: [
                  for (final bank in [...vietnamPopularBanks, otherBank])
                    DropdownMenuItem(value: bank, child: Text(bank, overflow: TextOverflow.ellipsis)),
                ],
                onChanged: _busy ? null : (value) => setState(() => _bank = value),
                validator: (value) => value == null ? 'Vui lòng chọn ngân hàng' : null,
              ),
              if (_bank == otherBank) ...[
                const SizedBox(height: AppSpacing.md),
                TextFormField(
                  controller: _otherBank,
                  enabled: !_busy,
                  maxLength: 100,
                  decoration: const InputDecoration(labelText: 'Tên ngân hàng *', border: OutlineInputBorder()),
                  validator: (value) => (value ?? '').trim().isEmpty ? 'Vui lòng nhập tên ngân hàng' : null,
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _number,
                enabled: !_busy,
                maxLength: 50,
                keyboardType: TextInputType.visiblePassword,
                decoration: const InputDecoration(labelText: 'Số tài khoản *', border: OutlineInputBorder()),
                validator: (value) {
                  final text = (value ?? '').trim();
                  if (text.isEmpty) return 'Vui lòng nhập số tài khoản';
                  if (!RegExp(r'^[0-9A-Za-z]+$').hasMatch(text)) {
                    return 'Số tài khoản chỉ gồm chữ và số, không có khoảng trắng';
                  }
                  return null;
                },
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _holder,
                enabled: !_busy,
                maxLength: 100,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(
                  labelText: 'Tên chủ tài khoản *',
                  helperText: 'Phải trùng với họ tên trong hồ sơ của bạn',
                  border: OutlineInputBorder(),
                ),
                validator: (value) => (value ?? '').trim().isEmpty ? 'Vui lòng nhập tên chủ tài khoản' : null,
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _isDefault,
                onChanged: _busy ? null : (value) => setState(() => _isDefault = value),
                title: const Text('Đặt làm tài khoản mặc định'),
              ),
              if (_error != null) ...[
                CtmsAlertBanner(severity: CtmsAlertSeverity.danger, title: 'Không thêm được tài khoản', message: _error!),
                const SizedBox(height: AppSpacing.md),
              ],
              CtmsButton(label: 'Lưu tài khoản', size: CtmsButtonSize.lg, isLoading: _busy, onPressed: _submit),
            ],
          ),
        ),
      ),
    );
  }
}
