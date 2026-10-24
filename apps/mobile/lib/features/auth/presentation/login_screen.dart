import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_logo.dart';
import '../application/auth_controller.dart';
import '../data/auth_api.dart';
import '../domain/user_role.dart';
import 'login_strings.dart';
import 'widgets/login_remember_row.dart';

/// Backend (CTMS-03-T01) only ever sends these 2 message strings for a
/// login failure.
const _accountNotActiveMessage = 'Account is not active';

/// `/login` — Clean, modern White theme with Green brand accents.
/// Social auth (Google/Lark) and the 4 feature chips are removed per user specs.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _obscurePassword = true;
  bool _rememberMe = false;

  static final _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
  static final _phonePattern = RegExp(r'^[0-9+\s]{9,}$');

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String? _validateIdentifier(String? value) {
    final trimmed = value?.trim() ?? '';
    if (_emailPattern.hasMatch(trimmed) || _phonePattern.hasMatch(trimmed)) {
      return null;
    }
    return LoginStrings.emailError;
  }

  String? _validatePassword(String? value) {
    return (value == null || value.length < 6)
        ? LoginStrings.passwordError
        : null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await ref
        .read(authControllerProvider.notifier)
        .login(
          identifier: _identifierController.text.trim(),
          password: _passwordController.text,
        );
  }

  bool _isAccountNotActive(Object error) =>
      error is ApiException && error.message == _accountNotActiveMessage;

  String _mapLoginError(Object error) {
    if (error is! ApiException) return LoginStrings.genericError;

    switch (error.kind) {
      case ApiExceptionKind.network:
      case ApiExceptionKind.timeout:
        return error.message;
      case ApiExceptionKind.response:
        if (error.message == _accountNotActiveMessage) {
          return LoginStrings.accountNotActive;
        }
        if (error.statusCode == 401) return LoginStrings.invalidCredentials;
        if ((error.statusCode ?? 0) >= 500) return LoginStrings.serverError;
        return LoginStrings.genericError;
      case ApiExceptionKind.unknown:
        return LoginStrings.genericError;
    }
  }

  void _navigateToVerify() {
    final identifier = _identifierController.text.trim();
    final isEmail = _emailPattern.hasMatch(identifier);
    context.push(
      '/verify',
      extra: RegisterResult(
        id: '',
        email: isEmail ? identifier : null,
        phone: isEmail ? null : identifier,
        role: UserRole.camper,
        status: 'pending_verification',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final error = authState.hasError ? authState.error : null;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xxl,
              vertical: AppSpacing.xl,
            ),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // 1. Logo CTMS
                  const Center(
                    child: CtmsLogo(size: 46, showText: true),
                  ),
                  const SizedBox(height: AppSpacing.xl),

                  // 2. Welcome Title & Subtitle
                  Text(
                    LoginStrings.welcomeTitle,
                    style: AppTypography.h1.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w800,
                      fontSize: 26,
                      letterSpacing: -0.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    LoginStrings.welcomeSubtitle,
                    style: AppTypography.body.copyWith(
                      color: AppColors.textSecondary,
                      fontSize: 14,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),

                  // 3. Error Alert (if any)
                  if (error != null) ...[
                    CtmsAlertBanner(
                      severity: CtmsAlertSeverity.danger,
                      title: LoginStrings.loginErrorTitle,
                      message: _mapLoginError(error),
                      actions: _isAccountNotActive(error)
                          ? [
                              CtmsButton(
                                label: LoginStrings.verifyAccountAction,
                                size: CtmsButtonSize.md,
                                onPressed: _navigateToVerify,
                              ),
                            ]
                          : const [],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],

                  // 4. Identifier Field (Email / Phone)
                  TextFormField(
                    controller: _identifierController,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 15,
                    ),
                    cursorColor: AppColors.textPrimary,
                    decoration: InputDecoration(
                      labelText: LoginStrings.emailLabel,
                      labelStyle: const TextStyle(color: AppColors.textSecondary),
                      floatingLabelStyle: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                      prefixIcon: const Icon(
                        Icons.person_outline,
                        color: AppColors.textPrimary,
                      ),
                      filled: true,
                      fillColor: Colors.white,
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                          color: AppColors.border,
                          width: 1.2,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                          color: AppColors.brandPrimary,
                          width: 1.8,
                        ),
                      ),
                    ),
                    validator: _validateIdentifier,
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // 5. Password Field
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _submit(),
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 15,
                    ),
                    cursorColor: AppColors.textPrimary,
                    decoration: InputDecoration(
                      labelText: LoginStrings.passwordLabel,
                      labelStyle: const TextStyle(color: AppColors.textSecondary),
                      floatingLabelStyle: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                      prefixIcon: const Icon(
                        Icons.lock_outline,
                        color: AppColors.textPrimary,
                      ),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                          color: AppColors.textMuted,
                        ),
                        onPressed: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                      ),
                      filled: true,
                      fillColor: Colors.white,
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                          color: AppColors.border,
                          width: 1.2,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                          color: AppColors.brandPrimary,
                          width: 1.8,
                        ),
                      ),
                    ),
                    validator: _validatePassword,
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  // 6. Remember Me & Forgot Password
                  LoginRememberRow(
                    rememberMe: _rememberMe,
                    onRememberMeChanged: (value) =>
                        setState(() => _rememberMe = value),
                    onForgotPassword: () =>
                        context.push('/forgot-password'),
                  ),
                  const SizedBox(height: 24),

                  // 7. Submit Action Button
                  CtmsButton(
                    label: LoginStrings.submit,
                    size: CtmsButtonSize.lg,
                    isLoading: authState.isLoading,
                    onPressed: authState.isLoading ? null : _submit,
                  ),
                  const SizedBox(height: AppSpacing.xl),

                  // 8. Bottom Register Text Link
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        LoginStrings.noAccountYet,
                        style: AppTypography.body.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                      TextButton(
                        onPressed: () => context.push('/register'),
                        style: TextButton.styleFrom(
                          foregroundColor: AppColors.brandPrimary,
                        ),
                        child: const Text(
                          LoginStrings.registerNow,
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
