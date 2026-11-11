import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_radius.dart';
import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../../../../../core/widgets/ctms_empty_state.dart';
import '../../../../../core/widgets/ctms_status_badge.dart';
import '../../domain/camper_overview_models.dart';
import '../camper_overview_strings.dart';
import '../overview_severity_x.dart';

/// "Giao dịch gần đây" — pure white cards matching /camper/explore style.
class CamperOverviewTransactionsCard extends StatelessWidget {
  const CamperOverviewTransactionsCard({
    super.key,
    required this.transactions,
    this.onSeeAll,
  });

  final List<RecentTransaction> transactions;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              CamperOverviewStrings.transactionsTitle,
              style: AppTypography.h3.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
            TextButton(
              onPressed: onSeeAll,
              child: const Text(
                CamperOverviewStrings.transactionsSeeAll,
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        if (transactions.isEmpty)
          Container(
            padding: const EdgeInsets.all(AppSpacing.cardPadding),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: AppRadius.cardBorderRadius,
              border: Border.all(color: AppColors.border),
              boxShadow: AppColors.cardShadowSm,
            ),
            child: const CtmsEmptyState(
              icon: Icons.receipt_long_outlined,
              title: CamperOverviewStrings.emptyTransactionsTitle,
            ),
          )
        else
          for (var i = 0; i < transactions.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.md),
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
                transaction.code,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  color: AppColors.textPrimary,
                ),
              ),
              CtmsStatusBadge(
                label: transaction.statusLabel,
                status: transaction.severity.ctmsStatus,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${transaction.location} • ${transaction.guestCount} khách',
            style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.sm),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _dateFormat.format(transaction.stayDate),
                style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
              ),
              Text(
                '${_amountFormat.format(transaction.amountVnd).replaceAll(',', '.')} đ',
                style: AppTypography.h3.copyWith(
                  color: AppColors.brandPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
