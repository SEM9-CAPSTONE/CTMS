import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_loading_state.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../application/terms_providers.dart';
import '../domain/terms_models.dart';

class TermsScreen extends ConsumerStatefulWidget {
  const TermsScreen({super.key});

  @override
  ConsumerState<TermsScreen> createState() => _TermsScreenState();
}

class _TermsScreenState extends ConsumerState<TermsScreen> {
  final Set<int> _expandedSections = <int>{1};

  void _toggleSection(int number) {
    setState(() {
      if (_expandedSections.contains(number)) {
        _expandedSections.remove(number);
      } else {
        _expandedSections.add(number);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final currentAsync = ref.watch(currentTermsProvider);

    return Scaffold(
      backgroundColor: AppColors.brandBg,
      appBar: AppBar(
        title: const Text('Điều khoản và Chính sách'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: currentAsync.when(
        loading: () =>
            const CtmsLoadingState(message: 'Đang tải Điều khoản và Chính sách...'),
        error: (_, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xxl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.description_outlined,
                  size: 40,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Không thể tải nội dung Điều khoản và Chính sách sử dụng.',
                  style: AppTypography.bodyStrong.copyWith(
                    color: AppColors.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Vui lòng kiểm tra kết nối mạng và thử lại.',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.lg),
                CtmsButton(
                  label: 'Thử lại',
                  onPressed: () => ref.invalidate(currentTermsProvider),
                ),
              ],
            ),
          ),
        ),
        data: (terms) => _buildContent(terms: terms),
      ),
    );
  }

  Widget _buildContent({required TermsVersionDetail terms}) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        // Header banner
        Container(
          padding: const EdgeInsets.all(AppSpacing.cardPadding),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: AppRadius.cardBorderRadius,
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                terms.title,
                style: AppTypography.h2.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  CtmsStatusBadge(
                    label: 'Phiên bản: ${formatTermsVersionLabel(terms.version)}',
                    status: CtmsStatus.success,
                  ),
                  CtmsStatusBadge(
                    label: 'Hiệu lực: ${formatTermsDate(terms.effectiveDate)}',
                    status: CtmsStatus.info,
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: AppSpacing.lg),

        // 12 collapsible / expandable accordion sections
        ...terms.sections.map((section) {
          final isExpanded = _expandedSections.contains(section.number);
          return Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.sm),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: AppRadius.cardBorderRadius,
              border: Border.all(
                color: isExpanded
                    ? AppColors.brandPrimary.withValues(alpha: 0.35)
                    : AppColors.border,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                InkWell(
                  key: ValueKey('terms-section-header-${section.number}'),
                  borderRadius: AppRadius.cardBorderRadius,
                  onTap: () => _toggleSection(section.number),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg,
                      vertical: AppSpacing.md,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${section.number}. ${section.title}',
                            style: AppTypography.bodyStrong.copyWith(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        Icon(
                          isExpanded
                              ? Icons.keyboard_arrow_up_rounded
                              : Icons.keyboard_arrow_down_rounded,
                          color: AppColors.textSecondary,
                        ),
                      ],
                    ),
                  ),
                ),
                if (isExpanded) ...[
                  const Divider(height: 1, color: AppColors.border),
                  Padding(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ...section.subsections.map(
                          (sub) => Padding(
                            padding: const EdgeInsets.only(bottom: AppSpacing.md),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${sub.code}. ${sub.title}',
                                  style: AppTypography.bodyStrong.copyWith(
                                    color: AppColors.brandPrimary,
                                  ),
                                ),
                                const SizedBox(height: AppSpacing.xs),
                                Text(
                                  sub.body,
                                  style: AppTypography.body.copyWith(
                                    color: AppColors.textPrimary,
                                    height: 1.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        if (section.callout != null &&
                            section.callout!.trim().isNotEmpty)
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(AppSpacing.md),
                            decoration: BoxDecoration(
                              color: AppColors.brandBg,
                              borderRadius: AppRadius.controlBorderRadius,
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Text(
                              section.callout!,
                              style: AppTypography.caption.copyWith(
                                color: AppColors.brandPrimary,
                                height: 1.45,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          );
        }),

        const SizedBox(height: AppSpacing.xxl),
      ],
    );
  }
}
