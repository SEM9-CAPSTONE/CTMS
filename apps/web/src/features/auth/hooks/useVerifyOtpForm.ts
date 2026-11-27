import { useEffect, useState } from "react";
import { HttpError } from "../../../core/api";
import { authService } from "../services/auth.service";
import type { OtpChannel } from "../types";
import { type ApiSubmitError, toApiSubmitError } from "../utils/auth.utils";
import {
	type VerifyRegistrationContext,
	clearVerifyRegistration,
	getVerifyRegistration,
} from "../utils/verifyRegistrationStorage";

/**
 * Cosmetic UX cooldown only (Phase 2 Decision Gate: client-side timer, not
 * backend-driven — the API response carries no "attempts remaining" info).
 * The real resend limit is still enforced server-side (409, BR-007).
 */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * How long the success message stays on screen before auto-navigating to
 * Login. UX fix: verifying used to call onVerifySuccess() immediately,
 * leaving the user with no confirmation that anything happened before being
 * yanked to a different page. A manual "go now" action is still offered
 * (VerifyOtpPage renders its own button calling onNavigateToLogin directly),
 * this delay only governs the automatic redirect.
 */
const VERIFY_SUCCESS_REDIRECT_DELAY_MS = 2500;

/**
 * SMS codes go through Twilio, still a trial account that cannot deliver to unverified
 * numbers, so the SMS option is hidden unless the build sets VITE_OTP_SMS_ENABLED=true.
 */
export function otpSmsEnabled(): boolean {
	return import.meta.env.VITE_OTP_SMS_ENABLED === "true";
}

/** Vietnamese copy for a failed send/resend; backend messages stay English. */
export function sendOtpErrorMessage(
	error: unknown,
	channel: OtpChannel,
	isResend: boolean
): string {
	if (error instanceof HttpError) {
		const body = error.errorData as { code?: unknown } | undefined;
		if (error.status === 503 && body?.code === "OTP_DELIVERY_FAILED") {
			return channel === "phone"
				? "Không gửi được mã qua SMS lúc này. Vui lòng chọn nhận mã qua Email."
				: "Không gửi được email chứa mã lúc này. Vui lòng thử lại sau ít phút.";
		}
		if (error.status === 409) {
			return "Bạn đã yêu cầu gửi mã quá nhiều lần. Vui lòng thử lại sau.";
		}
	} else {
		return "Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.";
	}
	return isResend
		? "Gửi lại mã OTP thất bại. Vui lòng thử lại."
		: "Gửi mã OTP thất bại. Vui lòng thử lại.";
}

/**
 * First-OTP-trigger Decision Gate (resolved, Option B): no spec, BR, or
 * backend contract assigns any component the responsibility of auto-issuing
 * the first OTP — register() doesn't call issueOtp(), and the send/resend
 * endpoints only prove they *can* serve a first send, not that anything
 * should call it automatically. VerifyOtpPage never calls the API on mount;
 * a send only fires from an explicit user click, after the user has also
 * explicitly chosen a channel (Phone or Email) — never inferred.
 */
export function useVerifyOtpForm(onNoContext: () => void, onVerifySuccess: () => void) {
	const [context, setContext] = useState<VerifyRegistrationContext | null>(null);
	const [code, setCode] = useState("");
	const [selectedChannel, setSelectedChannel] = useState<OtpChannel | null>(null);
	const [isVerifying, setIsVerifying] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [hasSentCode, setHasSentCode] = useState(false);
	const [submitError, setSubmitError] = useState<ApiSubmitError | null>(null);
	const [countdown, setCountdown] = useState(0);
	const [verifySuccess, setVerifySuccess] = useState(false);

	// Read the register-flow context once on mount. If it's missing (direct
	// URL visit, or sessionStorage cleared), there is nothing to verify —
	// redirect back to RegisterPage per Phase 2 Decision Gate. No API call
	// happens here — only reading local context.
	useEffect(() => {
		const stored = getVerifyRegistration();
		if (!stored) {
			onNoContext();
			return;
		}
		setContext(stored);
		// Pre-select the channel that can actually deliver: e-mail when there is one.
		setSelectedChannel(stored.email ? "email" : otpSmsEnabled() && stored.phone ? "phone" : null);
	}, [onNoContext]);

	useEffect(() => {
		if (countdown <= 0) {
			return;
		}
		const timer = window.setInterval(() => {
			setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
		}, 1000);
		return () => window.clearInterval(timer);
	}, [countdown]);

	const handleVerifySubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// Prevent double submit while a request is already in flight, and
		// guard against a race where context somehow isn't ready yet, or the
		// user hasn't requested a code at all (input is disabled until then,
		// this is just a defensive backstop matching the BR-241 guard style).
		if (isVerifying || !context || !hasSentCode) {
			return;
		}

		setSubmitError(null);
		setIsVerifying(true);

		try {
			await authService.verifyOtp({ userId: context.userId, code });
			clearVerifyRegistration();
			// Show the success message first -- the auto-navigation is delayed,
			// not instant, so the user actually sees confirmation. A manual
			// "go now" button (VerifyOtpPage) can still call onVerifySuccess
			// immediately, bypassing this timer.
			setVerifySuccess(true);
			window.setTimeout(onVerifySuccess, VERIFY_SUCCESS_REDIRECT_DELAY_MS);
		} catch (error) {
			// Entered code is left untouched (same convention as BR-242 on
			// register) — only the error is captured, code stays for retry.
			setSubmitError(toApiSubmitError(error, "Xác minh thất bại. Vui lòng thử lại."));
		} finally {
			setIsVerifying(false);
		}
	};

	// Sends the OTP via the user's chosen channel. The first send and every
	// later resend both go through this one explicit, user-clicked action
	// (Decision Gate: Option B) — hasSentCode decides which route the
	// underlying service call uses; both accept the identical payload shape.
	const handleSendCode = async () => {
		if (isSending || countdown > 0 || !context || !selectedChannel) {
			return;
		}

		setSubmitError(null);
		setIsSending(true);

		try {
			const payload = { userId: context.userId, channel: selectedChannel };
			if (hasSentCode) {
				await authService.resendOtp(payload);
			} else {
				await authService.sendOtp(payload);
			}
			setHasSentCode(true);
			setCountdown(RESEND_COOLDOWN_SECONDS);
		} catch (error) {
			setSubmitError({
				status: error instanceof HttpError ? error.status : undefined,
				message: sendOtpErrorMessage(error, selectedChannel, hasSentCode),
			});
		} finally {
			setIsSending(false);
		}
	};

	return {
		context,
		code,
		setCode,
		selectedChannel,
		setSelectedChannel,
		isVerifying,
		isSending,
		hasSentCode,
		submitError,
		countdown,
		verifySuccess,
		handleVerifySubmit,
		handleSendCode,
	};
}
