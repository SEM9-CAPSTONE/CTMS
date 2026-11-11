import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../data/auth_api.dart';
import '../data/auth_repository.dart';

/// Cosmetic UX cooldown only (mirrors Web's useVerifyOtpForm.ts) -- the API
/// response carries no "attempts remaining" info. The real resend limit is
/// still enforced server-side (409, BR-007).
const _resendCooldownSeconds = 60;

/// CTMS-02 [Mobile]. UI state for `/verify`'s real send/resend/verify flow
/// -- [VerifyScreen] itself already holds the account context
/// ([RegisterResult] from the register step), so this state only tracks
/// what the user is doing on THIS screen, not which account it's for.
class VerifyOtpState {
  const VerifyOtpState({
    this.selectedChannel,
    this.code = '',
    this.isSending = false,
    this.isVerifying = false,
    this.hasSentCode = false,
    this.countdown = 0,
    this.errorMessage,
    this.verifySuccess = false,
  });

  final OtpChannel? selectedChannel;
  final String code;
  final bool isSending;
  final bool isVerifying;
  final bool hasSentCode;
  final int countdown;
  final String? errorMessage;
  final bool verifySuccess;

  VerifyOtpState copyWith({
    OtpChannel? selectedChannel,
    String? code,
    bool? isSending,
    bool? isVerifying,
    bool? hasSentCode,
    int? countdown,
    String? errorMessage,
    bool clearError = false,
    bool? verifySuccess,
  }) {
    return VerifyOtpState(
      selectedChannel: selectedChannel ?? this.selectedChannel,
      code: code ?? this.code,
      isSending: isSending ?? this.isSending,
      isVerifying: isVerifying ?? this.isVerifying,
      hasSentCode: hasSentCode ?? this.hasSentCode,
      countdown: countdown ?? this.countdown,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      verifySuccess: verifySuccess ?? this.verifySuccess,
    );
  }
}

/// Same "relay the backend's own message" convention as
/// RegisterController's `_toRegisterSubmitError` -- the fallback is only
/// ever shown for a genuine non-HTTP failure (no network, etc.), never
/// invented per-status-code copy the spec/backend doesn't define.
String _mapOtpError(Object error, String fallback) {
  if (error is ApiException) return error.message;
  return fallback;
}

class VerifyOtpController extends Notifier<VerifyOtpState> {
  Timer? _countdownTimer;

  @override
  VerifyOtpState build() {
    ref.onDispose(() {
      _countdownTimer?.cancel();
    });
    return const VerifyOtpState();
  }

  /// Disabled while a send is in flight or the cooldown is still running --
  /// same guard Web's `selectChannel` uses.
  void selectChannel(OtpChannel channel) {
    if (state.isSending || state.countdown > 0) return;
    state = state.copyWith(selectedChannel: channel);
  }

  void setCode(String value) => state = state.copyWith(code: value);

  /// First send and every later resend both go through this one explicit,
  /// user-clicked action (Web's Decision Gate, Option B) -- no OTP is ever
  /// sent automatically on screen entry. [hasSentCode] decides whether the
  /// underlying call is `sendOtp` or `resendOtp`; both accept the identical
  /// payload shape.
  Future<void> sendCode(String userId) async {
    if (state.isSending || state.countdown > 0 || state.selectedChannel == null) return;

    state = state.copyWith(isSending: true, clearError: true);
    final channel = state.selectedChannel!;
    try {
      final repository = ref.read(authRepositoryProvider);
      if (state.hasSentCode) {
        await repository.resendOtp(userId: userId, channel: channel);
      } else {
        await repository.sendOtp(userId: userId, channel: channel);
      }
      state = state.copyWith(isSending: false, hasSentCode: true, countdown: _resendCooldownSeconds);
      _startCountdown();
    } catch (error) {
      state = state.copyWith(
        isSending: false,
        errorMessage: _mapOtpError(
          error,
          state.hasSentCode
              ? 'Gửi lại mã OTP thất bại. Vui lòng thử lại.'
              : 'Gửi mã OTP thất bại. Vui lòng thử lại.',
        ),
      );
    }
  }

  void _startCountdown() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (state.countdown <= 1) {
        timer.cancel();
        state = state.copyWith(countdown: 0);
      } else {
        state = state.copyWith(countdown: state.countdown - 1);
      }
    });
  }

  /// Requires a code to already have been sent -- the OTP input stays
  /// disabled on the screen until then, this is a defensive backstop
  /// matching the same BR-241 guard style used everywhere else.
  Future<void> verify(String userId) async {
    if (state.isVerifying || !state.hasSentCode) return;

    state = state.copyWith(isVerifying: true, clearError: true);
    try {
      await ref.read(authRepositoryProvider).verifyOtp(userId: userId, code: state.code);
      // Entered code is left untouched on failure (BR-242 convention, same
      // as Register) -- only cleared implicitly by verifySuccess navigating
      // the user away.
      state = state.copyWith(isVerifying: false, verifySuccess: true);
    } catch (error) {
      state = state.copyWith(
        isVerifying: false,
        errorMessage: _mapOtpError(error, 'Xác minh thất bại. Vui lòng thử lại.'),
      );
    }
  }
}

final verifyOtpControllerProvider = NotifierProvider<VerifyOtpController, VerifyOtpState>(
  VerifyOtpController.new,
);
