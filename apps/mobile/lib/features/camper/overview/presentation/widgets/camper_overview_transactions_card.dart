import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_radius.dart';
import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../../../../../core/widgets/ctms_empty_state.dart';
import '../../../../../core/widgets/ctms_key_value_row.dart';
import '../../../../../core/widgets/ctms_status_badge.dart';
import '../../domain/camper_overview_models.dart';
import '../camper_overview_strings.dart';
import '../overview_severity_x.dart';

/// "Giao dịch gần đây" — the desktop `DataTable` turned into one card per
/// row: line 1 = mã đơn (`brand.primary`) + status badge, line 2 = địa
/// điểm, then label/value pairs, per the DataTable→card conversion rule.
class CamperOverviewTransactionsCard extends StatelessWidget {
  const CamperOverviewTransactionsCard({super.key, required this.transactions, this.onSeeAll});

  final List<RecentTransaction> transactions;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(CamperOverviewStrings.transactionsTitle, style: AppTypography.h3),
            ),
            TextButton(
              onPressed: onSeeAll,
              child: const Text(CamperOverviewStrings.transactionsSeeAll),
            ),
          ],
        ),
        if (transactions.isEmpty)
          const CtmsEmptyState(
            icon: Icons.receipt_long_outlined,
            title: CamperOverviewStrings.emptyTransactionsTitle,
          )
        else
          for (var i = 0; i < transactions.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.sm),
            _TransactionTile(transaction: transactions[i]),
          ],
      ],
    );
  }
}

class _TransactionTile extends StatelessWidget {
  const _TransactionTile({required this.transaction});

  final RecentTransaction transaction;

  static final _dateFormat = DateFormat('dd/MM/yyyy');
  static final _amountFormat = NumberFormat('#,###', 'en_US');

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: scheme.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  transaction.code,
                  style: AppTypography.bodyStrong.copyWith(color: AppColors.brandPrimary),
                ),
              ),
              CtmsStatusBadge(
                label: transaction.statusLabel,
                status: transaction.severity.ctmsStatus,
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            transaction.location,
            style: AppTypography.body.copyWith(color: scheme.onSurface),
          ),
          const SizedBox(height: AppSpacing.sm),
          CtmsKeyValueRow(
            label: CamperOverviewStrings.transactionStayDateLabel,
            value: _dateFormat.format(transaction.stayDate),
          ),
          CtmsKeyValueRow(
            label: CamperOverviewStrings.transactionGuestsLabel,
            value: CamperOverviewStrings.guestCount(transaction.guestCount),
          ),
          CtmsKeyValueRow(
            label: CamperOverviewStrings.transactionAmountLabel,
            value: '${_amountFormat.format(transaction.amountVnd).replaceAll(',', '.')}đ',
          ),
        ],
      ),
    );
  }
}
