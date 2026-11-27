import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_button.dart';
import '../../../../core/widgets/ctms_loading_state.dart';
import '../../../../core/widgets/ctms_status_badge.dart';
import '../../application/terms_providers.dart';
import '../../domain/terms_models.dart';

class TermsVersionHistorySheet extends ConsumerWidget {
  const TermsVersionHistorySheet({
    super.key,
    required this.selectedVersion,
    required this.onSelectVersion,
  });

  final String selectedVersion;
  final ValueChanged<String> onSelectVersion;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final versionsAsync = ref.watch(termsVersionsProvider);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.xxl,
          AppSpacing.sm,
          AppSpacing.xxl,
          AppSpacing.xxl,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Lịch sử phiên bản điều khoản',
              style: AppTypography.h3.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Chọn một phiên bản để xem lại toàn văn nội dung đã công bố.',
              style: AppTypography.caption.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            versionsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacing.xxl),
                child: CtmsLoadingState(message: 'Đang tải lịch sử phiên bản...'),
              ),
              error: (_, _) => Column(
                children: [
                  Text(
                    'Không thể tải lịch sử phiên bản. Vui lòng thử lại.',
                    style: AppTypography.body.copyWith(
                      color: Theme.of(context).colorScheme.error,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  CtmsButton(
                    label: 'Thử lại',
                    variant: CtmsButtonVariant.secondary,
                    onPressed: () => ref.invalidate(termsVersionsProvider),
                  ),
                ],
              ),
              data: (versions) {
                if (versions.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
                    child: Text(
                      'Hiện chưa có phiên bản điều khoản nào được lưu trữ.',
                      style: AppTypography.body.copyWith(
                        color: AppColors.textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  );
                }
                return ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.sizeOf(context).height * 0.5,
                  ),
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: versions.length,
                    separatorBuilder: (_, _) => const Divider(
                      height: 1,
                      color: AppColors.border,
                    ),
                    itemBuilder: (context, index) {
                      final item = versions[index];
                      final isViewing = item.version == selectedVersion;
                      return InkWell(
                        onTap: () {
                          Navigator.of(context).pop();
                          onSelectVersion(item.version);
                        },
                        borderRadius: AppRadius.controlBorderRadius,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: AppSpacing.md,
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Wrap(
                                      spacing: AppSpacing.sm,
                                      runSpacing: AppSpacing.xs,
                                      crossAxisAlignment: WrapCrossAlignment.center,
                                      children: [
                                        Text(
                                          formatTermsVersionLabel(item.version),
                                          style: AppTypography.bodyStrong.copyWith(
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        CtmsStatusBadge(
                                          label: item.isActive ? 'hiện tại' : 'cũ',
                                          status: item.isActive
                                              ? CtmsStatus.success
                                              : CtmsStatus.neutral,
                                        ),
                                        if (isViewing)
                                          const CtmsStatusBadge(
                                            label: 'đang xem',
                                            status: CtmsStatus.info,
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: AppSpacing.xs),
                                    Text(
                                      'Hiệu lực: ${formatTermsDate(item.effectiveDate)}',
                                      style: AppTypography.caption.copyWith(
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                    if (item.summary != null &&
                                        item.summary!.trim().isNotEmpty) ...[
                                      const SizedBox(height: AppSpacing.xs),
                                      Text(
                                        item.summary!,
                                        style: AppTypography.caption.copyWith(
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const Icon(
                                Icons.chevron_right,
                                color: AppColors.textSecondary,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
