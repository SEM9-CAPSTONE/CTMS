import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_alert_banner.dart';
import '../../../../core/widgets/ctms_button.dart';
import '../../../../core/widgets/ctms_loading_state.dart';
import '../../../../core/widgets/ctms_status_badge.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/terms_providers.dart';
import '../../data/terms_api.dart';
import '../../domain/terms_models.dart';

enum _ReconsentStep { prompt, review, confirmed }

class TermsReconsentDialog extends StatefulWidget {
  const TermsReconsentDialog({
    super.key,
    required this.status,
    required this.loadTerms,
    required this.onDefer,
    required this.onAccept,
    required this.onDone,
  });

  final MyTermsStatus status;
  final Future<TermsVersionDetail> Function() loadTerms;
  final VoidCallback onDefer;
  final Future<AcceptTermsResult> Function(String version) onAccept;
  final VoidCallback onDone;

  @override
  State<TermsReconsentDialog> createState() => _TermsReconsentDialogState();
}

class _TermsReconsentDialogState extends State<TermsReconsentDialog> {
  _ReconsentStep _step = _ReconsentStep.prompt;
  TermsVersionDetail? _termsDetail;
  bool _isLoadingTerms = false;
  bool _hasLoadError = false;
  bool _hasCheckedAgree = false;
  bool _isAccepting = false;
  String? _submitError;
  AcceptTermsResult? _receipt;

  Future<void> _openReview() async {
    setState(() {
      _step = _ReconsentStep.review;
      _submitError = null;
      _hasLoadError = false;
    });
    await _fetchTerms();
  }

  Future<void> _fetchTerms() async {
    setState(() {
      _isLoadingTerms = true;
      _hasLoadError = false;
    });
    try {
      final detail = await widget.loadTerms();
      if (!mounted) return;
      setState(() {
        _termsDetail = detail;
        _isLoadingTerms = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoadingTerms = false;
        _hasLoadError = true;
      });
    }
  }

  Future<void> _handleConfirmAccept() async {
    if (!_hasCheckedAgree || _isAccepting) return;
    final activeVersion = _termsDetail?.version ?? widget.status.currentVersion;
    setState(() {
      _isAccepting = true;
      _submitError = null;
    });

    try {
      final result = await widget.onAccept(activeVersion);
      if (!mounted) return;
      setState(() {
        _isAccepting = false;
        _receipt = result;
        _step = _ReconsentStep.confirmed;
      });
    } catch (error) {
      if (!mounted) return;
      if (isTermsVersionOutdatedError(error)) {
        setState(() {
          _isAccepting = false;
          _hasCheckedAgree = false;
          _submitError =
              'Điều khoản sử dụng vừa được cập nhật phiên bản mới hơn. Vui lòng đọc lại phiên bản mới nhất trước khi xác nhận.';
        });
        await _fetchTerms();
        return;
      }
      setState(() {
        _isAccepting = false;
        _submitError = 'Không thể lưu xác nhận điều khoản lúc này. Vui lòng thử lại.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeVersion = _termsDetail?.version ?? widget.status.currentVersion;
    final activeEffectiveDate =
        _termsDetail?.effectiveDate ?? widget.status.currentEffectiveDate;

    return Dialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.cardBorderRadius),
      insetPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.xxl,
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: switch (_step) {
          _ReconsentStep.prompt => _buildPrompt(),
          _ReconsentStep.review => _buildReview(
            activeVersion: activeVersion,
            activeEffectiveDate: activeEffectiveDate,
          ),
          _ReconsentStep.confirmed => _buildConfirmed(),
        },
      ),
    );
  }

  Widget _buildPrompt() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Align(
          alignment: Alignment.center,
          child: CircleAvatar(
            radius: 26,
            backgroundColor: AppColors.brandBg,
            child: Icon(
              Icons.description_outlined,
              color: AppColors.brandPrimary,
              size: 28,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          'Cập nhật Điều khoản sử dụng',
          style: AppTypography.h3.copyWith(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w800,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.sm),
        Center(
          child: CtmsStatusBadge(
            label:
                '${formatTermsVersionLabel(widget.status.currentVersion)} (mới)',
            status: CtmsStatus.info,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          'Chúng tôi đã cập nhật Điều khoản và Điều kiện sử dụng (phiên bản ${formatTermsVersionLabel(widget.status.currentVersion)}, hiệu lực ${formatTermsDate(widget.status.currentEffectiveDate)}) với một số thay đổi quan trọng.',
          style: AppTypography.body.copyWith(
            color: AppColors.textSecondary,
            height: 1.45,
          ),
          textAlign: TextAlign.center,
        ),
        if (widget.status.latestAcceptance != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Lần đồng ý gần nhất: ${formatTermsVersionLabel(widget.status.latestAcceptance!.version)} vào ${formatTermsDate(widget.status.latestAcceptance!.acceptedAt)}.',
            style: AppTypography.caption.copyWith(
              color: AppColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
        Row(
          children: [
            Expanded(
              child: CtmsButton(
                label: 'Để sau',
                variant: CtmsButtonVariant.secondary,
                onPressed: widget.onDefer,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: CtmsButton(
                label: 'Xem và đồng ý',
                onPressed: _openReview,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildReview({
    required String activeVersion,
    required String activeEffectiveDate,
  }) {
    final maxBodyHeight = MediaQuery.sizeOf(context).height * 0.42;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Điều khoản ${formatTermsVersionLabel(activeVersion)}',
          style: AppTypography.h3.copyWith(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Hiệu lực: ${formatTermsDate(activeEffectiveDate)}',
          style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.md),
        if (_isLoadingTerms)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.xxl),
            child: CtmsLoadingState(message: 'Đang tải nội dung điều khoản...'),
          )
        else if (_hasLoadError)
          Column(
            children: [
              const CtmsAlertBanner(
                severity: CtmsAlertSeverity.danger,
                title: 'Không thể tải điều khoản mới',
                message: 'Vui lòng kiểm tra mạng và thử lại.',
              ),
              const SizedBox(height: AppSpacing.md),
              CtmsButton(
                label: 'Thử lại',
                variant: CtmsButtonVariant.secondary,
                onPressed: _fetchTerms,
              ),
            ],
          )
        else if (_termsDetail != null)
          ConstrainedBox(
            constraints: BoxConstraints(maxHeight: maxBodyHeight),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.brandBg,
                borderRadius: AppRadius.controlBorderRadius,
                border: Border.all(color: AppColors.border),
              ),
              child: ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount: _termsDetail!.sections.length,
                separatorBuilder: (_, _) => const Divider(
                  height: AppSpacing.lg,
                  color: AppColors.border,
                ),
                itemBuilder: (_, index) {
                  final section = _termsDetail!.sections[index];
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${section.number}. ${section.title}',
                        style: AppTypography.bodyStrong.copyWith(
                          color: AppColors.brandPrimary,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      ...section.subsections.map(
                        (sub) => Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                          child: Text(
                            '${sub.code}. ${sub.title}: ${sub.body}',
                            style: AppTypography.caption.copyWith(
                              color: AppColors.textPrimary,
                              height: 1.45,
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
        const SizedBox(height: AppSpacing.md),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(
              value: _hasCheckedAgree,
              onChanged: (_isLoadingTerms || _hasLoadError || _isAccepting)
                  ? null
                  : (v) => setState(() => _hasCheckedAgree = v ?? false),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: GestureDetector(
                  onTap: (_isLoadingTerms || _hasLoadError || _isAccepting)
                      ? null
                      : () => setState(() => _hasCheckedAgree = !_hasCheckedAgree),
                  child: Text(
                    'Tôi đã đọc và đồng ý với Điều khoản và Điều kiện sử dụng CTMS (${formatTermsVersionLabel(activeVersion)}).',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        if (_submitError != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            _submitError!,
            style: AppTypography.caption.copyWith(
              color: Theme.of(context).colorScheme.error,
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            Expanded(
              child: CtmsButton(
                label: 'Để sau',
                variant: CtmsButtonVariant.secondary,
                onPressed: _isAccepting ? null : widget.onDefer,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: CtmsButton(
                label: 'Xác nhận đồng ý',
                isLoading: _isAccepting,
                onPressed:
                    (_hasCheckedAgree && !_isLoadingTerms && !_hasLoadError && !_isAccepting)
                    ? _handleConfirmAccept
                    : null,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildConfirmed() {
    final receipt = _receipt;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Align(
          alignment: Alignment.center,
          child: CircleAvatar(
            radius: 28,
            backgroundColor: AppColors.brandBg,
            child: Icon(
              Icons.check_circle_rounded,
              color: AppColors.brandPrimary,
              size: 36,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          'Đã đồng ý điều khoản',
          style: AppTypography.h3.copyWith(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w800,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          receipt != null
              ? 'Bạn đã chấp thuận Điều khoản và Điều kiện sử dụng CTMS (phiên bản ${formatTermsVersionLabel(receipt.version)}) vào ${formatTermsDate(receipt.acceptedAt)}.'
              : 'Trạng thái chấp thuận điều khoản đã được lưu cho tài khoản của bạn.',
          style: AppTypography.body.copyWith(
            color: AppColors.textSecondary,
            height: 1.45,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.xl),
        CtmsButton(
          label: 'Tiếp tục sử dụng',
          onPressed: widget.onDone,
        ),
      ],
    );
  }
}

/// Wraps authenticated shell screens so any signed-in Camper/Porter needing
/// re-consent sees the update dialog once per version/session.
class TermsReconsentGate extends ConsumerStatefulWidget {
  const TermsReconsentGate({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<TermsReconsentGate> createState() => _TermsReconsentGateState();
}

class _TermsReconsentGateState extends ConsumerState<TermsReconsentGate> {
  bool _dialogShowing = false;

  void _maybeShowDialog(MyTermsStatus status, String userId) {
    if (_dialogShowing || !mounted) return;
    final key = '$userId:${status.currentVersion}';
    final deferred = ref.read(deferredTermsVersionsProvider);
    if (!status.needsReconsent || deferred.contains(key)) return;

    _dialogShowing = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) {
        _dialogShowing = false;
        return;
      }
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => TermsReconsentDialog(
          status: status,
          loadTerms: () => ref.read(termsApiProvider).getCurrent(),
          onDefer: () {
            ref.read(deferredTermsVersionsProvider.notifier).update(
              (set) => {...set, key},
            );
            Navigator.of(dialogContext).pop();
          },
          onAccept: (version) async {
            final res = await ref
                .read(termsApiProvider)
                .acceptTerms(version: version, platform: 'mobile');
            ref.invalidate(myTermsStatusProvider);
            return res;
          },
          onDone: () {
            Navigator.of(dialogContext).pop();
          },
        ),
      );
      _dialogShowing = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).valueOrNull;
    final statusAsync = ref.watch(myTermsStatusProvider);

    final status = statusAsync.valueOrNull;
    if (user != null && status != null && status.needsReconsent) {
      _maybeShowDialog(status, user.id);
    }

    return widget.child;
  }
}
