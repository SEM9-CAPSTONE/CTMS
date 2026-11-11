import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../data/auth_repository.dart';
import 'forgot_password_strings.dart';

enum _ForgotStep { request, reset, success }

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _requestFormKey = GlobalKey<FormState>();
  final _resetFormKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  _ForgotStep _step = _ForgotStep.request;
  String _channel = 'email';
  String? _error;
  bool _isRequesting = false;
  bool _isResetting = false;
  bool _obscurePassword = true;

  static final _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
  static final _phonePattern = RegExp(r'^(0[35789])([0-9]{8})$');

  @override
  void dispose() {
    _identifierController.dispose();
    _codeController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  String? _validateIdentifier(String? value) {
    final trimmed = value?.trim() ?? '';
    if (_emailPattern.hasMatch(trimmed) || _phonePattern.hasMatch(trimmed)) {
      return null;
    }
    return ForgotPasswordStrings.identifierError;
  }

  bool get _hasLength =>
      _passwordController.text.length >= 8 &&
      _passwordController.text.length <= 128;
  bool get _hasLetter => RegExp(r'[A-Za-z]').hasMatch(_passwordController.text);
  bool get _hasNumber => RegExp(r'[0-9]').hasMatch(_passwordController.text);

  Future<void> _requestCode() async {
    if (_isRequesting || !_requestFormKey.currentState!.validate()) return;
    setState(() {
      _error = null;
      _isRequesting = true;
    });

    try {
      await ref
          .read(authRepositoryProvider)
          .forgotPassword(
            identifier: _identifierController.text.trim().toLowerCase(),
            channel: _channel,
          );
      setState(() => _step = _ForgotStep.reset);
    } catch (error) {
      setState(() => _error = _mapRequestError(error));
    } finally {
      if (mounted) setState(() => _isRequesting = false);
    }
  }

  Future<void> _resetPassword() async {
    if (_isResetting || !_resetFormKey.currentState!.validate()) return;
    if (!_hasLength || !_hasLetter || !_hasNumber) {
      setState(() => _error = ForgotPasswordStrings.passwordPolicyError);
      return;
    }
    if (_passwordController.text != _confirmPasswordController.text) {
      setState(() => _error = ForgotPasswordStrings.passwordMismatchError);
      return;
    }

    setState(() {
      _error = null;
      _isResetting = true;
    });

    try {
      await ref
          .read(authRepositoryProvider)
          .resetPassword(
            identifier: _identifierController.text.trim().toLowerCase(),
            code: _codeController.text.trim(),
            newPassword: _passwordController.text,
          );
      setState(() => _step = _ForgotStep.success);
      unawaited(
        Future<void>.delayed(const Duration(milliseconds: 1200), () {
          if (mounted) context.go('/login');
        }),
      );
    } catch (error) {
      setState(() => _error = _mapResetError(error));
    } finally {
      if (mounted) setState(() => _isResetting = false);
    }
  }

  String _mapRequestError(Object error) {
    if (error is ApiException && error.kind == ApiExceptionKind.response) {
      if (error.statusCode == 422) {
        return ForgotPasswordStrings.requestValidationError;
      }
      if (error.statusCode == 409) {
        return ForgotPasswordStrings.resendLimitError;
      }
    }
    if (error is ApiException &&
        (error.kind == ApiExceptionKind.network ||
            error.kind == ApiExceptionKind.timeout)) {
      return error.message;
    }
    return ForgotPasswordStrings.requestError;
  }

  String _mapResetError(Object error) {
    if (error is ApiException && error.kind == ApiExceptionKind.response) {
      if (error.statusCode == 409 || error.statusCode == 404) {
        return ForgotPasswordStrings.invalidOrExpiredCode;
      }
      if (error.statusCode == 422) {
        return ForgotPasswordStrings.resetValidationError;
      }
    }
    if (error is ApiException &&
        (error.kind == ApiExceptionKind.network ||
            error.kind == ApiExceptionKind.timeout)) {
      return error.message;
    }
    return ForgotPasswordStrings.resetError;
  }

  @override
  Widget build(BuildContext context) {
    if (_step == _ForgotStep.success) return _buildSuccess();

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/login'),
        ),
        title: const Text(ForgotPasswordStrings.backToLogin),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xxl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: Theme.of(
                      context,
                    ).colorScheme.primary.withValues(alpha: 0.1),
                    child: Icon(
                      Icons.lock_reset,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          ForgotPasswordStrings.title,
                          style: AppTypography.h1,
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          ForgotPasswordStrings.subtitle,
                          style: AppTypography.body.copyWith(
                            color: Theme.of(
                              context,
                            ).colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xxl),
              Row(
                children: [
                  Expanded(
                    child: _StepPill(
                      label: ForgotPasswordStrings.requestStep,
                      selected: _step == _ForgotStep.request,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _StepPill(
                      label: ForgotPasswordStrings.resetStep,
                      selected: _step == _ForgotStep.reset,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xl),
              if (_step == _ForgotStep.request)
                _buildRequestForm()
              else
                _buildResetForm(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRequestForm() {
    return Form(
      key: _requestFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CtmsAlertBanner(
            severity: CtmsAlertSeverity.info,
            title: ForgotPasswordStrings.requestStep,
            message: ForgotPasswordStrings.emptyState,
            icon: Icons.mark_email_unread_outlined,
          ),
          const SizedBox(height: AppSpacing.lg),
          TextFormField(
            controller: _identifierController,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            decoration: const InputDecoration(
              labelText: ForgotPasswordStrings.identifierLabel,
              prefixIcon: Icon(Icons.person_outline),
            ),
            validator: _validateIdentifier,
          ),
          const SizedBox(height: AppSpacing.lg),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(
                value: 'email',
                label: Text(ForgotPasswordStrings.emailChannel),
                icon: Icon(Icons.mail_outline),
              ),
              ButtonSegment(
                value: 'phone',
                label: Text(ForgotPasswordStrings.phoneChannel),
                icon: Icon(Icons.phone_outlined),
              ),
            ],
            selected: {_channel},
            onSelectionChanged: _isRequesting
                ? null
                : (value) => setState(() => _channel = value.first),
          ),
          if (_error != null) ...[
            const SizedBox(height: AppSpacing.lg),
            CtmsAlertBanner(
              severity: CtmsAlertSeverity.danger,
              title: 'Không thể gửi mã',
              message: _error!,
            ),
          ],
          const SizedBox(height: AppSpacing.xl),
          CtmsButton(
            label: _isRequesting
                ? ForgotPasswordStrings.sendingCode
                : ForgotPasswordStrings.sendCode,
            icon: Icons.arrow_forward,
            isLoading: _isRequesting,
            onPressed: _isRequesting ? null : _requestCode,
          ),
        ],
      ),
    );
  }

  Widget _buildResetForm() {
    return Form(
      key: _resetFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const CtmsAlertBanner(
            severity: CtmsAlertSeverity.info,
            title: ForgotPasswordStrings.resetStep,
            message: ForgotPasswordStrings.requestAccepted,
            icon: Icons.verified_outlined,
          ),
          const SizedBox(height: AppSpacing.lg),
          TextFormField(
            controller: _codeController,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: ForgotPasswordStrings.codeLabel,
              prefixIcon: Icon(Icons.pin_outlined),
            ),
            validator: (value) => (value == null || value.trim().isEmpty)
                ? ForgotPasswordStrings.codeError
                : null,
          ),
          const SizedBox(height: AppSpacing.lg),
          TextFormField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            textInputAction: TextInputAction.next,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: ForgotPasswordStrings.newPasswordLabel,
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                ),
                onPressed: () =>
                    setState(() => _obscurePassword = !_obscurePassword),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          _PolicyLine(
            ok: _hasLength,
            label: ForgotPasswordStrings.passwordLength,
          ),
          _PolicyLine(
            ok: _hasLetter,
            label: ForgotPasswordStrings.passwordLetter,
          ),
          _PolicyLine(
            ok: _hasNumber,
            label: ForgotPasswordStrings.passwordNumber,
          ),
          const SizedBox(height: AppSpacing.lg),
          TextFormField(
            controller: _confirmPasswordController,
            obscureText: _obscurePassword,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _resetPassword(),
            decoration: const InputDecoration(
              labelText: ForgotPasswordStrings.confirmPasswordLabel,
              prefixIcon: Icon(Icons.lock_outline),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: AppSpacing.lg),
            CtmsAlertBanner(
              severity: CtmsAlertSeverity.danger,
              title: 'Không thể đặt lại mật khẩu',
              message: _error!,
            ),
          ],
          const SizedBox(height: AppSpacing.xl),
          CtmsButton(
            label: _isResetting
                ? ForgotPasswordStrings.resetting
                : ForgotPasswordStrings.resetPassword,
            icon: Icons.arrow_forward,
            isLoading: _isResetting,
            onPressed: _isResetting ? null : _resetPassword,
          ),
          const SizedBox(height: AppSpacing.md),
          CtmsButton(
            label: ForgotPasswordStrings.requestNewCode,
            variant: CtmsButtonVariant.secondary,
            onPressed: _isResetting
                ? null
                : () => setState(() {
                    _error = null;
                    _step = _ForgotStep.request;
                  }),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccess() {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xxl),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(
                Icons.check_circle_outline,
                size: 72,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                ForgotPasswordStrings.successTitle,
                style: AppTypography.h1,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                ForgotPasswordStrings.successMessage,
                style: AppTypography.body.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xxl),
              CtmsButton(
                label: ForgotPasswordStrings.goToLogin,
                icon: Icons.login,
                onPressed: () => context.go('/login'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StepPill extends StatelessWidget {
  const _StepPill({required this.label, required this.selected});

  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    return Container(
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(
        vertical: AppSpacing.md,
        horizontal: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: selected ? color.withValues(alpha: 0.1) : Colors.transparent,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: selected ? color : Theme.of(context).dividerColor,
        ),
      ),
      child: Text(
        label,
        style: AppTypography.bodyStrong.copyWith(
          color: selected
              ? color
              : Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

class _PolicyLine extends StatelessWidget {
  const _PolicyLine({required this.ok, required this.label});

  final bool ok;
  final String label;

  @override
  Widget build(BuildContext context) {
    final color = ok
        ? Theme.of(context).colorScheme.primary
        : Theme.of(context).colorScheme.onSurfaceVariant;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        children: [
          Icon(
            ok ? Icons.check_circle_outline : Icons.radio_button_unchecked,
            size: 16,
            color: color,
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(label, style: AppTypography.caption.copyWith(color: color)),
        ],
      ),
    );
  }
}
