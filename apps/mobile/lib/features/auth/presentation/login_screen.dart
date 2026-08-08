import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../application/auth_controller.dart';
import '../data/auth_api.dart';
import '../domain/user_role.dart';
import 'login_strings.dart';
import 'widgets/login_divider.dart';
import 'widgets/login_hero_panel.dart';
import 'widgets/login_remember_row.dart';
import 'widgets/social_login_button.dart';

/// Backend (CTMS-03-T01) only ever sends these 2 message strings for a
/// login failure — see LoginStrings.accountNotActive's doc comment for why
/// there's nothing more specific to map "locked"/"unverified" to.
const _accountNotActiveMessage = 'Account is not active';

/// `/login` — §A.2 in `docs/design/FIGMA-SCREEN-INVENTORY.md`. The desktop
/// frame is a 50/50 split (mountain photo | white form); on a phone that
/// becomes [LoginHeroPanel] as a top banner over a scrollable form, per the
/// desktop→mobile rules agreed in PROMPT 1.
///
/// Two elements from the Figma frame have no mobile equivalent and are
/// intentionally dropped rather than copied:
/// - "🏠 Quay về trang chủ" — links to the public web landing page, which
///   doesn't exist in this app (mobile only serves signed-in Camper/Porter
///   flows).
/// - Loading/error/empty states: this is a submit form, not a data list, so
///   "loading" is the button spinner and "error" is [CtmsAlertBanner] above
///   the fields — a full-screen [CtmsErrorState]/[CtmsEmptyState] would be
///   the wrong tool here (there's no page data to retry-load or find empty).
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

  void _showComingSoon() {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text(LoginStrings.comingSoon)));
  }

  bool _isAccountNotActive(Object error) =>
      error is ApiException && error.message == _accountNotActiveMessage;

  /// CTMS-03-T03 checklist: "Handle offline, timeout, server-error, ...
  /// states" as distinct cases. [ApiExceptionKind.network]/`.timeout`
  /// messages are already Vietnamese copy set by [ApiClient] itself (every
  /// caller in the app wants the same wording for those); only
  /// `.response` (a real backend reply) needs mapping here, since only this
  /// screen knows what "Invalid credentials"/"Account is not active" mean.
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

  /// CTMS-03-T03 checklist: "navigation to ... Account Verification ...
  /// where applicable" — applicable here means the login failure was
  /// specifically "account not active". There is no id to hand off (a
  /// failed login never reveals it, on purpose — same anti-enumeration
  /// reasoning as the shared invalid-credentials message), so /verify
  /// receives only whichever of email/phone the user actually typed.
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
      body: Column(
        children: [
          const LoginHeroPanel(),
          Expanded(
            child: SafeArea(
              top: false,
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.xxl),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(LoginStrings.welcomeTitle, style: AppTypography.h1),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        LoginStrings.welcomeSubtitle,
                        style: AppTypography.body.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xxl),
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
                      TextFormField(
                        controller: _identifierController,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: LoginStrings.emailLabel,
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                        validator: _validateIdentifier,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _submit(),
                        decoration: InputDecoration(
                          labelText: LoginStrings.passwordLabel,
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                            ),
                            onPressed: () => setState(
                              () => _obscurePassword = !_obscurePassword,
                            ),
                          ),
                        ),
                        validator: _validatePassword,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      LoginRememberRow(
                        rememberMe: _rememberMe,
                        onRememberMeChanged: (value) =>
                            setState(() => _rememberMe = value),
                        onForgotPassword: () =>
                            context.push('/forgot-password'),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      CtmsButton(
                        label: LoginStrings.submit,
                        isLoading: authState.isLoading,
                        onPressed: authState.isLoading ? null : _submit,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      CtmsButton(
                        label: LoginStrings.createAccount,
                        variant: CtmsButtonVariant.secondary,
                        onPressed: () => context.push('/register'),
                      ),
                      const SizedBox(height: AppSpacing.xxl),
                      const LoginDivider(label: LoginStrings.orSignInWith),
                      const SizedBox(height: AppSpacing.lg),
                      Row(
                        children: [
                          Expanded(
                            child: SocialLoginButton(
                              label: LoginStrings.google,
                              icon: Icons.g_mobiledata,
                              onPressed: _showComingSoon,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: SocialLoginButton(
                              label: LoginStrings.lark,
                              icon: Icons.chat_bubble_outline,
                              onPressed: _showComingSoon,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.xxl),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            LoginStrings.noAccountYet,
                            style: AppTypography.body.copyWith(
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurfaceVariant,
                            ),
                          ),
                          TextButton(
                            onPressed: () => context.push('/register'),
                            child: const Text(LoginStrings.registerNow),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
